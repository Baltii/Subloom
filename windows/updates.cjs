const { existsSync } = require("node:fs");
const path = require("node:path");
const root = existsSync(path.join(__dirname, "updates/trust.json"))
  ? "./updates/"
  : "../updates/";
const { FEED_URL, newerVersion } = require(root + "protocol.cjs");
const { verifyRelease, verifyAsset } = require(root + "node.cjs");
const trust = require(root + "trust.json");
function createUpdateBroker({
  updater,
  version,
  fetch = globalThis.fetch,
  notify = () => {},
  enabled = true,
  verificationKey = trust.publicKey,
  canInstall = () => true,
}) {
  let state = {
    supported: enabled,
    status: "idle",
    currentVersion: version,
    availableVersion: null,
    progress: null,
    error: null,
  };
  let pending = null,
    file = null,
    work = null;
  function set(patch) {
    state = { ...state, ...patch };
    notify(state);
    return state;
  }
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.allowDowngrade = false;
  updater.allowPrerelease = false;
  updater.disableWebInstaller = true;
  updater.disableDifferentialDownload = true;
  updater.on("error", () => {}); // A rejected check/download is reported through the bounded promise below.
  updater.on("download-progress", (p) =>
    set({ progress: Math.max(0, Math.min(100, Number(p.percent) || 0)) }),
  );
  async function check() {
    if (!enabled || state.status === "ready") return state;
    if (work) return work;
    work = (async () => {
      set({ status: "checking", error: null, progress: null });
      try {
        const response = await fetch(FEED_URL, {
          signal: AbortSignal.timeout(20000),
          cache: "no-store",
        });
        if (response.status === 404)
          return set({ status: "current", error: null });
        if (
          !response.ok ||
          Number(response.headers.get("content-length") || 0) > 65536
        )
          throw new Error(
            "Update checks are unavailable. Connect and try again.",
          );
        const release = verifyRelease(await response.text(), verificationKey);
        if (!newerVersion(release.version, version))
          return set({ status: "current", availableVersion: null });
        pending = release.assets.find((a) => a.platform === "windows-x64");
        updater.setFeedURL({
          provider: "generic",
          url: `https://github.com/Baltii/Subloom/releases/download/v${release.version}/`,
        });
        const result = await updater.checkForUpdates();
        const info = result?.updateInfo;
        if (
          !info ||
          info.version !== release.version ||
          !Array.isArray(info.files) ||
          info.files.length !== 1 ||
          ![pending.name, pending.url].includes(info.files[0]?.url)
        )
          throw new Error(
            "The update metadata does not match the signed Subloom release.",
          );
        set({
          status: "downloading",
          availableVersion: release.version,
          progress: 0,
        });
        const paths = await updater.downloadUpdate();
        if (!Array.isArray(paths) || paths.length !== 1)
          throw new Error("The update download was incomplete.");
        file = paths[0];
        verifyAsset(file, pending, verificationKey);
        return set({ status: "ready", progress: 100 });
      } catch (error) {
        file = null;
        return set({
          status: "error",
          progress: null,
          error:
            error instanceof Error
              ? error.message
              : "The update failed. Try again.",
        });
      } finally {
        work = null;
      }
    })();
    return work;
  }
  function install() {
    if (!canInstall())
      throw new Error(
        "Save or discard your changes before installing an update.",
      );
    if (!enabled || work || state.status !== "ready" || !file || !pending)
      throw new Error("Download and verify an update before restarting.");
    // Cached installers can change between download and restart. Verify the actual bytes again.
    verifyAsset(file, pending, verificationKey);
    set({ status: "installing", error: null });
    updater.quitAndInstall(true, true);
  }
  return { status: () => state, check, install };
}
module.exports = { createUpdateBroker };
