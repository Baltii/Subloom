import { beforeEach, expect, it, vi } from "vitest";
import { useUpdates } from "../../src/store/updates";
import {
  checkAppUpdates,
  maintainAppUpdates,
  installAppUpdate,
} from "../../src/services/appUpdates";
const mocks = vi.hoisted(() => ({
  drafts: false,
  flush: vi.fn(async () => {}),
  reload: vi.fn(),
  fetch: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../../src/services/macosBridge", () => ({ macosBridge: () => null }));
vi.mock("../../src/services/windowsBridge", () => ({
  windowsBridge: () => null,
}));
vi.mock("../../src/store/drafts", () => ({
  hasUnsavedDrafts: () => mocks.drafts,
}));
vi.mock("../../src/store/app", () => ({ flushPendingWrites: mocks.flush }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.drafts = false;
  useUpdates.setState({
    status: "idle",
    kind: "web",
    error: null,
    availableVersion: null,
  });
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubGlobal("location", { reload: mocks.reload });
  vi.stubGlobal("addEventListener", mocks.add);
  vi.stubGlobal("removeEventListener", mocks.remove);
});
it("checks on launch and offers newer web releases without reloading automatically", async () => {
  mocks.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ version: "99.0.0" }),
  });
  const cleanup = maintainAppUpdates();
  await vi.waitFor(() =>
    expect(useUpdates.getState().status).toBe("available"),
  );
  expect(useUpdates.getState().availableVersion).toBe("99.0.0");
  expect(mocks.reload).not.toHaveBeenCalled();
  cleanup();
  expect(mocks.remove).toHaveBeenCalledWith("focus", expect.any(Function));
});
it("keeps the app usable when update metadata cannot be loaded", async () => {
  mocks.fetch.mockRejectedValue(new Error("Offline"));
  await checkAppUpdates();
  expect(useUpdates.getState()).toMatchObject({
    status: "error",
    error: "Offline",
  });
  expect(mocks.reload).not.toHaveBeenCalled();
});
it("preserves drafts and flushes pending writes before an explicitly requested refresh", async () => {
  mocks.drafts = true;
  await expect(installAppUpdate()).rejects.toThrow(/Save or discard/);
  expect(mocks.reload).not.toHaveBeenCalled();
  mocks.drafts = false;
  await installAppUpdate();
  expect(mocks.flush).toHaveBeenCalledOnce();
  expect(mocks.reload).toHaveBeenCalledOnce();
});
