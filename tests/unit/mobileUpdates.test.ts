import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const m = vi.hoisted(() => ({
  channel: "store",
  enabled: true,
  draft: false,
  data: new Uint8Array([1, 2, 3]),
  check: vi.fn(),
  fetch: vi.fn(),
  reload: vi.fn(),
  feed: vi.fn(),
  intent: vi.fn(),
  flush: vi.fn(),
  deleted: vi.fn(),
  download: vi.fn(),
}));
vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  AppState: { addEventListener: () => ({ remove() {} }) },
}));
vi.mock("expo-constants", () => ({
  default: {
    get expoConfig() {
      return { extra: { androidUpdateChannel: m.channel } };
    },
  },
}));
vi.mock("expo-application", () => ({
  nativeApplicationVersion: "1.5.1",
  applicationId: "com.subloom.app",
}));
vi.mock("expo-updates", () => ({
  get isEnabled() {
    return m.enabled;
  },
  checkForUpdateAsync: m.check,
  fetchUpdateAsync: m.fetch,
  reloadAsync: m.reload,
}));
vi.mock("../../src/services/releaseManifest", () => ({
  fetchReleaseManifest: m.feed,
}));
vi.mock("../../src/store/drafts", () => ({ hasUnsavedDrafts: () => m.draft }));
vi.mock("../../src/store/app", () => ({ flushPendingWrites: m.flush }));
vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  makeDirectoryAsync: vi.fn(),
  createDownloadResumable: () => ({ downloadAsync: m.download }),
  deleteAsync: m.deleted,
  getContentUriAsync: async () => "content://verified-apk",
}));
vi.mock("expo-file-system", () => ({
  FileMode: { ReadOnly: "r" },
  File: class {
    exists = true;
    get size() {
      return m.data.length;
    }
    open() {
      let offset = 0;
      return {
        readBytes: (size: number) => {
          const bytes = m.data.slice(offset, offset + size);
          offset += size;
          return bytes;
        },
        close() {},
      };
    }
  },
}));
vi.mock("expo-intent-launcher", () => ({
  startActivityAsync: m.intent,
  ActivityAction: { MANAGE_UNKNOWN_APP_SOURCES: "settings" },
}));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  m.channel = "store";
  m.enabled = true;
  m.draft = false;
  m.data = new Uint8Array([1, 2, 3]);
  m.check.mockResolvedValue({ isAvailable: true });
  m.fetch.mockResolvedValue({ isNew: true });
  m.flush.mockResolvedValue(undefined);
  m.reload.mockResolvedValue(undefined);
  m.deleted.mockResolvedValue(undefined);
  m.download.mockResolvedValue({ status: 200 });
  m.intent.mockResolvedValue({});
});
afterEach(() => vi.useRealTimers());
async function start() {
  const client = await import("../../src/services/appUpdates.native");
  const { useUpdates } = await import("../../src/store/updates");
  const stop = client.maintainAppUpdates();
  stop();
  return { ...client, state: () => useUpdates.getState() };
}
it("store builds use runtime-matched Expo updates and only restart after saving", async () => {
  const client = await start();
  await client.checkAppUpdates();
  expect(m.feed).not.toHaveBeenCalled();
  expect(client.state().status).toBe("available");
  await client.downloadAppUpdate();
  expect(m.reload).not.toHaveBeenCalled();
  m.draft = true;
  await expect(client.installAppUpdate()).rejects.toThrow(/Save/);
  m.draft = false;
  await client.installAppUpdate();
  expect(m.flush).toHaveBeenCalled();
  expect(m.reload).toHaveBeenCalledOnce();
});
it("leaves the installed app usable after an offline check", async () => {
  m.check.mockRejectedValueOnce(new Error("Offline. Try again."));
  const client = await start();
  await client.checkAppUpdates();
  expect(client.state().status).toBe("error");
  expect(m.reload).not.toHaveBeenCalled();
  await client.checkAppUpdates();
  expect(client.state().status).toBe("available");
});
it("can apply Expo's recovery directive to the embedded app without clearing data", async () => {
  m.check.mockResolvedValue({ isAvailable: false, isRollBackToEmbedded: true });
  m.fetch.mockResolvedValue({ isNew: false, isRollBackToEmbedded: true });
  const client = await start();
  await client.checkAppUpdates();
  expect(client.state().status).toBe("available");
  await client.downloadAppUpdate();
  expect(client.state().status).toBe("ready");
  await client.installAppUpdate();
  expect(m.flush).toHaveBeenCalled();
  expect(m.reload).toHaveBeenCalledOnce();
  expect(m.deleted).not.toHaveBeenCalled();
});
it("offers only newer test APKs and verifies downloaded bytes again before Android confirmation", async () => {
  m.channel = "github-test";
  m.enabled = false;
  m.feed.mockResolvedValue({
    version: "1.6.0",
    assets: [
      {
        platform: "android-test",
        name: "Subloom-1.6.0-android-test.apk",
        size: 3,
        sha256: createHash("sha256").update(m.data).digest("hex"),
        url: "https://github.com/Baltii/Subloom/releases/download/v1.6.0/Subloom-1.6.0-android-test.apk",
      },
    ],
  });
  const client = await start();
  await client.checkAppUpdates();
  await client.downloadAppUpdate();
  expect(client.state().status).toBe("ready");
  expect(m.intent).not.toHaveBeenCalled();
  m.data[0] = 9;
  await expect(client.installAppUpdate()).rejects.toThrow(/verified/);
  expect(m.intent).not.toHaveBeenCalled();
  m.data[0] = 1;
  await client.installAppUpdate();
  expect(m.intent).toHaveBeenCalledWith(
    "android.intent.action.VIEW",
    expect.objectContaining({ data: "content://verified-apk", flags: 1 }),
  );
  expect(client.state().status).toBe("ready"); // Canceling Android's prompt remains retryable.
  expect(m.check).not.toHaveBeenCalled();
});
it("never downgrades or substitutes an unsigned older release", async () => {
  m.channel = "github-test";
  m.feed.mockResolvedValue({ version: "1.5.0", assets: [] });
  const client = await start();
  await client.checkAppUpdates();
  expect(client.state().status).toBe("current");
  expect(m.download).not.toHaveBeenCalled();
});
