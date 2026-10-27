import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { lockStorageKey } from "../../src/domain/appLock";
import { lockStorage } from "../../src/services/lockStorage";

const mocks = vi.hoisted(() => ({
  platform: { OS: "web" },
  mac: vi.fn(),
  macRequest: vi.fn(),
  windows: vi.fn(),
  readSecure: vi.fn(),
  writeSecure: vi.fn(),
  readWeb: vi.fn(),
  writeWeb: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: mocks.platform }));
vi.mock("expo-secure-store", () => ({
  getItemAsync: mocks.readSecure,
  setItemAsync: mocks.writeSecure,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "device-only",
}));
vi.mock("../../src/services/macosBridge", () => ({
  macosBridge: mocks.mac,
  macosRequest: mocks.macRequest,
}));
vi.mock("../../src/services/windowsBridge", () => ({
  windowsBridge: mocks.windows,
}));
beforeEach(() => {
  mocks.platform.OS = "web";
  mocks.mac.mockReturnValue(null);
  mocks.windows.mockReturnValue(null);
  vi.stubGlobal("localStorage", {
    getItem: mocks.readWeb,
    setItem: mocks.writeWeb,
  });
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

it("uses browser storage only for ordinary web sessions", async () => {
  mocks.readWeb.mockReturnValue("web-lock");
  expect(await lockStorage.read()).toBe("web-lock");
  await lockStorage.write("next-lock");
  expect(mocks.readWeb).toHaveBeenCalledWith(lockStorageKey);
  expect(mocks.writeWeb).toHaveBeenCalledWith(lockStorageKey, "next-lock");
  expect(mocks.readSecure).not.toHaveBeenCalled();
});
it.each(["ios", "android"])(
  "keeps %s lock configuration in device secure storage",
  async (platform) => {
    mocks.platform.OS = platform;
    mocks.readSecure.mockResolvedValue("native-lock");
    expect(await lockStorage.read()).toBe("native-lock");
    await lockStorage.write("next-lock");
    expect(mocks.readSecure).toHaveBeenCalledWith(lockStorageKey);
    expect(mocks.writeSecure).toHaveBeenCalledWith(
      lockStorageKey,
      "next-lock",
      { keychainAccessible: "device-only" },
    );
    expect(mocks.readWeb).not.toHaveBeenCalled();
    expect(mocks.writeWeb).not.toHaveBeenCalled();
  },
);
it("routes Mac protection through its bounded Keychain bridge", async () => {
  mocks.mac.mockReturnValue({ version: 1 });
  mocks.macRequest.mockResolvedValueOnce("keychain-lock");
  expect(await lockStorage.read()).toBe("keychain-lock");
  await lockStorage.write("next-lock");
  expect(mocks.macRequest.mock.calls).toEqual([
    ["security.read"],
    ["security.write", { value: "next-lock" }],
  ]);
  expect(mocks.readWeb).not.toHaveBeenCalled();
});
it("never silently falls back to unprotected storage on a Mac Keychain failure", async () => {
  mocks.mac.mockReturnValue({ version: 1 });
  mocks.macRequest.mockRejectedValue(new Error("Keychain unavailable"));
  await expect(lockStorage.read()).rejects.toThrow("Keychain unavailable");
  await expect(lockStorage.write("next-lock")).rejects.toThrow(
    "Keychain unavailable",
  );
  expect(mocks.readWeb).not.toHaveBeenCalled();
  expect(mocks.writeWeb).not.toHaveBeenCalled();
});
it("uses Windows encrypted storage and preserves its errors", async () => {
  const security = {
    read: vi.fn().mockResolvedValue("windows-lock"),
    write: vi.fn().mockRejectedValue(new Error("DPAPI unavailable")),
  };
  mocks.windows.mockReturnValue({ security });
  expect(await lockStorage.read()).toBe("windows-lock");
  await expect(lockStorage.write("next-lock")).rejects.toThrow(
    "DPAPI unavailable",
  );
  expect(mocks.readWeb).not.toHaveBeenCalled();
  expect(mocks.writeWeb).not.toHaveBeenCalled();
});
it("requires a compatible Windows bridge instead of falling back to browser storage", async () => {
  mocks.windows.mockReturnValue({ version: 1 });
  await expect(lockStorage.read()).rejects.toThrow("Update the Windows app");
  await expect(lockStorage.write("next-lock")).rejects.toThrow(
    "Update the Windows app",
  );
  expect(mocks.readWeb).not.toHaveBeenCalled();
  expect(mocks.writeWeb).not.toHaveBeenCalled();
});
it("serializes browser credential changes through an origin-wide Web Lock", async () => {
  const request = vi.fn(async (_name: string, action: () => Promise<string>) =>
    action(),
  );
  vi.stubGlobal("navigator", { locks: { request } });
  const action = vi.fn(async () => "verified");
  expect(await lockStorage.exclusive(action)).toBe("verified");
  expect(request).toHaveBeenCalledWith(lockStorageKey, action);
});
it("does not run a credential change when the browser cannot serialize it safely", async () => {
  vi.stubGlobal("navigator", {});
  const action = vi.fn(async () => "unsafe");
  await expect(lockStorage.exclusive(action)).rejects.toThrow(
    "updated secure browser",
  );
  expect(action).not.toHaveBeenCalled();
});
