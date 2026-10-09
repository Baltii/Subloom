import { beforeEach, describe, expect, it, vi } from "vitest";
import { userA, userB } from "../fixtures";
import * as SecureStore from "expo-secure-store";
import {
  disableDevice,
  installNotificationNavigation,
  maintainPushRegistration,
  registerPush,
  safeNotificationPath,
  sendTestPush,
} from "../../src/services/notifications";
const mocks = vi.hoisted(() => {
  const state = {
    identity: "",
    hydrated: true,
    data: { preferences: { pushEnabled: true } },
    pushError: null as string | null,
    pushDeviceEnabled: null as boolean | null,
  };
  return {
    state,
    platform: { OS: "ios" },
    constants: { easConfig: { projectId: "project-fixture" } },
    storage: new Map<string, string>(),
    rpc: vi.fn(),
    invoke: vi.fn(),
    accountClient: vi.fn(),
    getPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    getExpoToken: vi.fn(),
    channel: vi.fn(),
    pushListener: vi.fn(),
    foreground: vi.fn(),
    remove: vi.fn(),
    responseListener: vi.fn(),
    lastResponse: vi.fn(),
    clearResponse: vi.fn(),
  };
});
vi.mock("react-native", () => ({
  Platform: mocks.platform,
  AppState: { addEventListener: mocks.foreground },
}));
vi.mock("expo-constants", () => ({ default: mocks.constants }));
vi.mock("expo-crypto", () => ({
  randomUUID: () => "10000000-0000-4000-8000-000000000001",
}));
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => mocks.storage.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    mocks.storage.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    mocks.storage.delete(key);
  }),
}));
vi.mock("../../src/store/app", () => ({
  useApp: {
    getState: () => mocks.state,
    setState: (update: object) => Object.assign(mocks.state, update),
  },
}));
vi.mock("../../src/services/supabase", () => ({
  supabase: {},
  accountClient: mocks.accountClient,
}));
vi.mock("expo-notifications", () => ({
  AndroidImportance: { DEFAULT: 3 },
  setNotificationChannelAsync: mocks.channel,
  getPermissionsAsync: mocks.getPermissions,
  requestPermissionsAsync: mocks.requestPermissions,
  getExpoPushTokenAsync: mocks.getExpoToken,
  addPushTokenListener: mocks.pushListener,
  setNotificationHandler: vi.fn(),
  addNotificationResponseReceivedListener: mocks.responseListener,
  getLastNotificationResponseAsync: mocks.lastResponse,
  clearLastNotificationResponseAsync: mocks.clearResponse,
}));
const consent = () => "subloom.push-consent." + userA;
const installation = () => "subloom.installation." + userA;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockReset();
  mocks.accountClient.mockReset();
  mocks.storage.clear();
  vi.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => {
    mocks.storage.set(key, value);
  });
  Object.assign(mocks.state, {
    identity: userA,
    hydrated: true,
    pushError: null,
    pushDeviceEnabled: null,
    data: { preferences: { pushEnabled: true } },
  });
  mocks.platform.OS = "ios";
  mocks.constants.easConfig.projectId = "project-fixture";
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.invoke.mockResolvedValue({ data: { queued: true }, error: null });
  mocks.accountClient.mockImplementation(async () => ({
    rpc: mocks.rpc,
    functions: { invoke: mocks.invoke },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: { enabled: true }, error: null }),
      };
      return query;
    },
  }));
  mocks.getPermissions.mockResolvedValue({ granted: true, canAskAgain: true });
  mocks.requestPermissions.mockResolvedValue({
    granted: true,
    canAskAgain: true,
  });
  mocks.getExpoToken.mockResolvedValue({ data: "ExpoPushToken[fixture]" });
  mocks.channel.mockResolvedValue(undefined);
  mocks.pushListener.mockReturnValue({ remove: mocks.remove });
  mocks.foreground.mockReturnValue({ remove: mocks.remove });
  mocks.responseListener.mockReturnValue({ remove: mocks.remove });
  mocks.lastResponse.mockResolvedValue(null);
});
describe("mobile notification registration and safe navigation", () => {
  it("accepts only supported internal routes", () => {
    for (const path of [
      "/settings",
      "/",
      "/subscription/" + userA,
      "/detection/" + userA,
    ])
      expect(safeNotificationPath(path)).toBe(path);
    for (const path of [
      "https://attacker.invalid",
      "//attacker.invalid",
      "/settings?next=evil",
      "/subscription/invalid",
      null,
    ])
      expect(safeNotificationPath(path)).toBeNull();
  });
  it("keeps Mac and browser push disabled", async () => {
    mocks.platform.OS = "web";
    await expect(registerPush()).rejects.toThrow(/Mac notifications/);
    expect(mocks.getExpoToken).not.toHaveBeenCalled();
  });
  it("requires the EAS project before prompting permission", async () => {
    mocks.constants.easConfig.projectId = "";
    await expect(registerPush()).rejects.toThrow(/EAS project/);
    expect(mocks.getPermissions).not.toHaveBeenCalled();
  });
  it("silent refresh never prompts and disables registration when permission is revoked", async () => {
    mocks.storage.set(installation(), "installation-A");
    mocks.getPermissions.mockResolvedValue({
      granted: false,
      canAskAgain: true,
    });
    await expect(registerPush(false)).rejects.toThrow(/device settings/);
    expect(mocks.requestPermissions).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("disable_push_device", {
      installation_id: "installation-A",
    });
    expect(mocks.getExpoToken).not.toHaveBeenCalled();
  });
  it("creates Android channel before requesting permission and stores only the Expo token", async () => {
    mocks.platform.OS = "android";
    mocks.getPermissions.mockResolvedValue({
      granted: false,
      canAskAgain: true,
    });
    await registerPush();
    expect(mocks.channel.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.requestPermissions.mock.invocationCallOrder[0]!,
    );
    expect(mocks.rpc).toHaveBeenCalledWith(
      "register_push_device",
      expect.objectContaining({
        device_token: "ExpoPushToken[fixture]",
        device_platform: "android",
      }),
    );
    expect(mocks.storage.get(consent())).toBe("enabled");
  });
  it("revokes only the captured installation when the account switches during registration", async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "register_push_device") mocks.state.identity = userB;
      return { error: null };
    });
    await registerPush();
    expect(mocks.accountClient).toHaveBeenCalledWith(userA);
    expect(mocks.rpc).toHaveBeenLastCalledWith("disable_push_device", {
      installation_id: mocks.storage.get(installation()),
    });
    expect(mocks.storage.has(consent())).toBe(false);
    expect(mocks.state.pushDeviceEnabled).toBeNull();
  });
  it("does not register a phone before device consent", async () => {
    const cleanup = maintainPushRegistration(userA);
    await vi.waitFor(() => expect(mocks.pushListener).toHaveBeenCalled());
    expect(mocks.getExpoToken).not.toHaveBeenCalled();
    cleanup();
  });
  it("revokes registration when the account switches during consent persistence", async () => {
    vi.mocked(SecureStore.setItemAsync).mockImplementation(
      async (key, value) => {
        mocks.storage.set(key, value);
        if (key === consent()) mocks.state.identity = userB;
      },
    );
    await registerPush();
    expect(mocks.rpc).toHaveBeenLastCalledWith("disable_push_device", {
      installation_id: mocks.storage.get(installation()),
    });
    expect(mocks.storage.has(consent())).toBe(false);
    expect(mocks.state.pushDeviceEnabled).toBeNull();
  });
  it("re-fetches an Expo token on native rotation and removes all listeners", async () => {
    mocks.storage.set(consent(), "enabled");
    const cleanup = maintainPushRegistration(userA);
    await vi.waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith(
        "register_push_device",
        expect.anything(),
      ),
    );
    const rotated = mocks.pushListener.mock.calls[0]![0] as (
      token: unknown,
    ) => void;
    rotated({ type: "ios", data: "raw-apns-token" });
    await vi.waitFor(() => expect(mocks.getExpoToken).toHaveBeenCalledTimes(2));
    expect(
      mocks.rpc.mock.calls
        .filter(([name]) => name === "register_push_device")
        .every(
          ([, params]) => params.device_token === "ExpoPushToken[fixture]",
        ),
    ).toBe(true);
    cleanup();
    expect(mocks.remove).toHaveBeenCalledTimes(2);
    rotated({ type: "ios", data: "late-token" });
    await Promise.resolve();
    expect(mocks.getExpoToken).toHaveBeenCalledTimes(2);
  });
  it("disables only this installation and forgets this account's consent on sign-out", async () => {
    mocks.storage.set(installation(), "installation-A");
    mocks.storage.set(consent(), "enabled");
    mocks.storage.set("subloom.push-consent." + userB, "enabled");
    await disableDevice();
    expect(mocks.rpc).toHaveBeenCalledWith("disable_push_device", {
      installation_id: "installation-A",
    });
    expect(mocks.storage.has(consent())).toBe(false);
    expect(mocks.storage.get("subloom.push-consent." + userB)).toBe("enabled");
  });
  it("queues a test through the captured account client", async () => {
    mocks.storage.set(installation(), "installation-A");
    mocks.storage.set(consent(), "enabled");
    await sendTestPush();
    expect(mocks.invoke).toHaveBeenCalledWith(
      "test-push",
      expect.objectContaining({
        body: expect.objectContaining({ installationId: "installation-A" }),
      }),
    );
    expect(mocks.accountClient.mock.calls.every(([id]) => id === userA)).toBe(
      true,
    );
  });
  it("deduplicates cold-start and listener responses and ignores callbacks after cleanup", async () => {
    const response = {
      actionIdentifier: "tap",
      notification: {
        request: {
          identifier: "notification-A",
          content: { data: { path: "/settings" } },
        },
      },
    };
    mocks.lastResponse.mockResolvedValue(response);
    const navigate = vi.fn();
    const cleanup = installNotificationNavigation(navigate);
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    const received = mocks.responseListener.mock.calls[0]![0] as (
      payload: unknown,
    ) => void;
    received(response);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(mocks.clearResponse).toHaveBeenCalled();
    cleanup();
    received({ ...response, actionIdentifier: "different" });
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
