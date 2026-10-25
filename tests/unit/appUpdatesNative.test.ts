import { beforeEach, expect, it, vi } from "vitest";
import { useUpdates } from "../../src/store/updates";
import {
  maintainAppUpdates,
  downloadAppUpdate,
  installAppUpdate,
} from "../../src/services/appUpdates.native";
const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  fetch: vi.fn(),
  reload: vi.fn(),
  listener: vi.fn(),
  remove: vi.fn(),
  drafts: false,
  flush: vi.fn(async () => {}),
}));
vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
  AppState: { addEventListener: mocks.listener },
}));
vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: {} } } }));
vi.mock("expo-application", () => ({ nativeApplicationVersion: "1.8.0" }));
vi.mock("expo-updates", () => ({
  isEnabled: true,
  checkForUpdateAsync: mocks.check,
  fetchUpdateAsync: mocks.fetch,
  reloadAsync: mocks.reload,
}));
vi.mock("expo-file-system/legacy", () => ({}));
vi.mock("expo-file-system", () => ({ File: class {}, FileMode: {} }));
vi.mock("expo-intent-launcher", () => ({}));
vi.mock("../../src/store/drafts", () => ({
  hasUnsavedDrafts: () => mocks.drafts,
}));
vi.mock("../../src/store/app", () => ({ flushPendingWrites: mocks.flush }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.drafts = false;
  useUpdates.setState({
    status: "idle",
    kind: "ota",
    error: null,
    availableVersion: null,
  });
  mocks.check.mockResolvedValue({ isAvailable: true });
  mocks.fetch.mockResolvedValue({ isNew: true });
  mocks.listener.mockReturnValue({ remove: mocks.remove });
});
it("checks immediately on every launch, including launches within the previous check interval", async () => {
  const first = maintainAppUpdates();
  await vi.waitFor(() =>
    expect(useUpdates.getState().status).toBe("available"),
  );
  first();
  const second = maintainAppUpdates();
  await vi.waitFor(() => expect(mocks.check).toHaveBeenCalledTimes(2));
  await vi.waitFor(() =>
    expect(useUpdates.getState().status).toBe("available"),
  );
  second();
  expect(mocks.reload).not.toHaveBeenCalled();
});
it("shows downloading until the update is ready, and only applies after an explicit action", async () => {
  useUpdates.setState({ status: "available" });
  let finish!: (result: { isNew: boolean }) => void;
  mocks.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const download = downloadAppUpdate();
  expect(useUpdates.getState().status).toBe("downloading");
  expect(mocks.reload).not.toHaveBeenCalled();
  finish({ isNew: true });
  await download;
  expect(useUpdates.getState().status).toBe("ready");
  mocks.drafts = true;
  await expect(installAppUpdate()).rejects.toThrow(/Save or discard/);
  mocks.drafts = false;
  await installAppUpdate();
  expect(mocks.reload).toHaveBeenCalledOnce();
});
