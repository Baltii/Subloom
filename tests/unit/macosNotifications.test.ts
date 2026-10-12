import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptySnapshot } from "../../src/domain/models";
import { subscription, userA } from "../fixtures";
vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "fixture" }));
vi.mock("../../src/services/notifications", () => ({
  safeNotificationPath: (path: string) => path,
}));
const consent = new Map<string, boolean>();
const request = vi.fn(
  async ({
    op,
    identity,
    enabled,
  }: {
    op: string;
    identity?: string;
    enabled?: boolean;
  }) => {
    if (op === "notification.enable") consent.set(identity!, enabled!);
    return {
      enabled: consent.get(identity!) ?? false,
      permission: "granted",
      pending: 0,
      alertsEnabled: true,
      testDelivered: false,
    };
  },
);
beforeEach(() => {
  vi.resetModules();
  consent.clear();
  request.mockClear();
  vi.stubGlobal("subloomMac", { version: 1, request });
});
async function setup() {
  const { useApp } = await import("../../src/store/app");
  useApp.setState({
    identity: "guest",
    hydrated: true,
    data: {
      ...emptySnapshot(),
      onboarded: true,
      subscriptions: [subscription()],
    },
  });
  return { useApp, ...(await import("../../src/services/macosNotifications")) };
}
describe("Mac reminder workspace lifecycle", () => {
  it("schedules in the guest workspace when this Mac has consent", async () => {
    const service = await setup();
    consent.set("guest", true);
    await service.refreshMacReminders();
    expect(
      request.mock.calls.find(([m]) => m.op === "notification.replace")?.[0],
    ).toMatchObject({
      identity: "guest",
      requests: expect.arrayContaining([
        expect.objectContaining({ path: "/subscription/" + subscription().id }),
      ]),
    });
  });
  it("does not clear OS reminders before the initial disk hydration", async () => {
    const service = await setup();
    service.useApp.setState({ hydrated: false });
    await service.refreshMacReminders();
    expect(request).not.toHaveBeenCalled();
  });
  it("clears an active workspace as soon as it is deactivated", async () => {
    const service = await setup();
    await service.refreshMacReminders();
    service.useApp.setState({ hydrated: false });
    await service.refreshMacReminders();
    expect(request).toHaveBeenCalledWith({ op: "notification.clear" });
  });
  it("disables scheduled reminders independently of cloud preferences", async () => {
    const service = await setup();
    consent.set("guest", true);
    await service.enableMacReminders(false);
    expect(request).toHaveBeenCalledWith({
      op: "notification.replace",
      identity: "guest",
      requests: [],
    });
    expect(service.useApp.getState().data.preferences.pushEnabled).toBe(false);
  });
  it("does not carry guest device consent into a connected account", async () => {
    const service = await setup();
    consent.set("guest", true);
    await service.refreshMacReminders();
    service.useApp.setState({ identity: userA });
    await service.refreshMacReminders();
    expect(request).toHaveBeenLastCalledWith({
      op: "notification.replace",
      identity: userA,
      requests: [],
    });
    expect(service.useMacNotifications.getState().enabled).toBe(false);
  });
  it("ignores stale responses from a workspace that changed during activation", async () => {
    const service = await setup();
    consent.set("guest", true);
    request.mockImplementationOnce(async () => {
      service.useApp.setState({ identity: userA });
      return {
        enabled: true,
        permission: "granted",
        pending: 10,
        alertsEnabled: true,
        testDelivered: false,
      };
    });
    await service.refreshMacReminders();
    expect(request).toHaveBeenCalledTimes(1);
    expect(service.useMacNotifications.getState().enabled).toBe(false);
  });
  it("surfaces bridge failure and lets subsequent refresh recover", async () => {
    const service = await setup();
    request.mockRejectedValueOnce(new Error("Native storage unavailable"));
    await expect(service.refreshMacReminders()).rejects.toThrow(
      "Native storage unavailable",
    );
    expect(service.useMacNotifications.getState().error).toContain(
      "unavailable",
    );
    await service.refreshMacReminders();
    expect(service.useMacNotifications.getState().error).toBeNull();
  });
  it("does nothing in an ordinary browser", async () => {
    const service = await setup();
    vi.stubGlobal("subloomMac", undefined);
    await service.refreshMacReminders();
    expect(request).not.toHaveBeenCalled();
  });
});
