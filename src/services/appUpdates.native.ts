import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import * as Application from "expo-application";
import * as Updates from "expo-updates";
import * as LegacyFS from "expo-file-system/legacy";
import { File, FileMode } from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { newerVersion, type ReleaseAsset } from "../../updates/protocol.cjs";
import { useUpdates, updateFailure } from "../store/updates";
import { hasUnsavedDrafts } from "../store/drafts";
import { flushPendingWrites } from "../store/app";
import { fetchReleaseManifest } from "./releaseManifest";

// Only the direct GitHub APK uses the repository's test signer. Store/EAS builds
// must never be offered that APK; the OS also enforces package signatures.
const apkChannel =
  Platform.OS === "android" &&
  Constants.expoConfig?.extra?.androidUpdateChannel === "github-test";
const currentVersion = Application.nativeApplicationVersion || "Unknown";
let asset: ReleaseAsset | null = null,
  apkUri: string | null = null;
let work: Promise<void> | null = null;
let lastCheck = 0;
function serial(action: () => Promise<void>) {
  if (work) return work;
  work = action()
    .catch(updateFailure)
    .finally(() => {
      work = null;
    });
  return work;
}
export function maintainAppUpdates() {
  useUpdates.setState({
    currentVersion,
    kind: apkChannel ? "apk" : Updates.isEnabled ? "ota" : "none",
    supported: apkChannel || Updates.isEnabled,
  });
  const check = () => {
    if (
      Date.now() - lastCheck > 60 * 60 * 1000 &&
      !["ready", "available", "downloading", "installing"].includes(
        useUpdates.getState().status,
      )
    )
      void checkAppUpdates();
  };
  void checkAppUpdates();
  const listener = AppState.addEventListener("change", (state) => {
    if (state === "active") check();
  });
  return () => {
    listener.remove();
  };
}
export function checkAppUpdates() {
  return serial(async () => {
    if (useUpdates.getState().status === "ready") return;
    lastCheck = Date.now();
    useUpdates.setState({ status: "checking", error: null, progress: null });
    if (apkChannel) {
      const release = await fetchReleaseManifest();
      asset =
        release && newerVersion(release.version, currentVersion)
          ? release.assets.find((a) => a.platform === "android-test")!
          : null;
      useUpdates.setState({
        status: asset ? "available" : "current",
        availableVersion: asset ? release!.version : null,
      });
    } else if (Updates.isEnabled) {
      const result = await Updates.checkForUpdateAsync();
      useUpdates.setState({
        status:
          result.isAvailable || result.isRollBackToEmbedded
            ? "available"
            : "current",
        availableVersion: null,
      });
    } else useUpdates.setState({ status: "unavailable", supported: false });
  });
}
async function verifyApk(uri: string, expected: ReleaseAsset) {
  const file = new File(uri);
  if (!file.exists || file.size !== expected.size)
    throw new Error(
      "The update download is incomplete. Check for updates and download it again.",
    );
  const handle = file.open(FileMode.ReadOnly),
    hash = sha256.create();
  try {
    for (let offset = 0; offset < expected.size;) {
      const bytes = handle.readBytes(Math.min(65536, expected.size - offset));
      if (!bytes.length) throw new Error("The update download is incomplete.");
      hash.update(bytes);
      offset += bytes.length;
      if (offset % (1024 * 1024) === 0)
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    if (bytesToHex(hash.digest()) !== expected.sha256)
      throw new Error(
        "This download could not be verified. Check for updates and download it again.",
      );
  } finally {
    handle.close();
    hash.destroy();
  }
}
export function downloadAppUpdate() {
  return serial(async () => {
    if (useUpdates.getState().status !== "available") return;
    useUpdates.setState({ status: "downloading", error: null, progress: null });
    if (apkChannel && asset) {
      if (!LegacyFS.cacheDirectory)
        throw new Error("Update storage is unavailable on this device.");
      const directory = LegacyFS.cacheDirectory + "subloom-updates/";
      await LegacyFS.makeDirectoryAsync(directory, { intermediates: true });
      const uri = directory + asset.name;
      const download = LegacyFS.createDownloadResumable(
        asset.url,
        uri,
        {},
        (event) =>
          useUpdates.setState({
            progress: Math.min(
              100,
              Math.round((event.totalBytesWritten / asset!.size) * 100),
            ),
          }),
      );
      try {
        const result = await download.downloadAsync();
        if (!result || result.status !== 200)
          throw new Error("The update download did not finish. Try again.");
        await verifyApk(uri, asset);
        apkUri = uri;
      } catch (error) {
        await LegacyFS.deleteAsync(uri, { idempotent: true }).catch(() => {});
        throw error;
      }
    } else {
      const result = await Updates.fetchUpdateAsync();
      if (!result.isNew && !result.isRollBackToEmbedded)
        throw new Error("This update is no longer available. Check again.");
    }
    useUpdates.setState({ status: "ready", progress: 100 });
  });
}
export async function installAppUpdate() {
  if (work || useUpdates.getState().status !== "ready") return;
  if (hasUnsavedDrafts())
    throw new Error("Save or discard your open changes before updating.");
  await flushPendingWrites();
  if (apkChannel) {
    if (!asset || !apkUri)
      throw new Error("Check for updates and download the update again.");
    await verifyApk(apkUri, asset);
    const uri = await LegacyFS.getContentUriAsync(apkUri);
    // Android owns confirmation, trusted-source permission, and signer checks.
    await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
      data: uri,
      type: "application/vnd.android.package-archive",
      flags: 1,
    });
  } else if (Updates.isEnabled) {
    useUpdates.setState({ status: "installing" });
    await Updates.reloadAsync();
  }
}
export async function openUpdateInstallSettings() {
  if (apkChannel)
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.MANAGE_UNKNOWN_APP_SOURCES,
      { data: `package:${Application.applicationId}` },
    );
}
