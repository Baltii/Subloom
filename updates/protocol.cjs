// No Node APIs: shared by the native clients, desktop main process and release tools.
const VERSION = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/;
const PLATFORMS = ["windows-x64", "macos-arm64", "macos-x64", "android-test"];
const REPOSITORY = "Baltii/Subloom";
const FEED_URL = `https://github.com/${REPOSITORY}/releases/latest/download/subloom-updates.json`;
function newerVersion(candidate, installed) {
  if (!VERSION.test(candidate) || !VERSION.test(installed)) return false;
  const a = candidate.split(".").map(Number),
    b = installed.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}
function validateRelease(input) {
  if (
    !input ||
    input.schema !== 1 ||
    !VERSION.test(input.version) ||
    !/^[a-f0-9]{40}$/.test(input.commit) ||
    !Number.isFinite(Date.parse(input.publishedAt)) ||
    !Array.isArray(input.assets) ||
    input.assets.length !== PLATFORMS.length
  )
    throw new Error("The update information is invalid. Try again later.");
  const seen = new Set();
  for (const asset of input.assets) {
    if (
      !asset ||
      !PLATFORMS.includes(asset.platform) ||
      seen.has(asset.platform) ||
      typeof asset.name !== "string" ||
      !/^Subloom-[A-Za-z0-9.-]+$/.test(asset.name) ||
      !Number.isSafeInteger(asset.size) ||
      asset.size <= 0 ||
      asset.size > 1024 * 1024 * 1024 ||
      !/^[a-f0-9]{64}$/.test(asset.sha256) ||
      !/^[a-f0-9]{128}$/.test(asset.signature)
    )
      throw new Error("The update download information is invalid.");
    const extension =
      asset.platform === "windows-x64"
        ? ".exe"
        : asset.platform === "android-test"
          ? ".apk"
          : ".zip";
    if (
      !asset.name.endsWith(extension) ||
      !asset.name.includes(input.version) ||
      asset.url !==
        `https://github.com/${REPOSITORY}/releases/download/v${input.version}/${asset.name}`
    )
      throw new Error(
        "The update download is not an official Subloom release.",
      );
    seen.add(asset.platform);
  }
  return input;
}
function parseEnvelope(text) {
  if (typeof text !== "string" || text.length > 65536)
    throw new Error("The update information is too large.");
  const envelope = JSON.parse(text);
  if (
    !envelope ||
    typeof envelope.payload !== "string" ||
    !/^[a-f0-9]{128}$/.test(envelope.signature)
  )
    throw new Error("This update could not be verified. Try again later.");
  return envelope;
}
module.exports = {
  REPOSITORY,
  FEED_URL,
  VERSION,
  PLATFORMS,
  newerVersion,
  validateRelease,
  parseEnvelope,
};
