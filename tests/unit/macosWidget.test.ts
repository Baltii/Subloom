import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptySnapshot } from "../../src/domain/models";
import { userA } from "../fixtures";
vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("expo-crypto", () => ({
  randomUUID: () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
}));
const request = vi.fn<(message: Record<string, unknown>) => Promise<unknown>>();
beforeEach(() => {
  vi.resetModules();
  request.mockReset().mockResolvedValue({ available: true });
  vi.stubGlobal("subloomMac", { version: 1, request });
});
async function setup() {
  const { useApp } = await import("../../src/store/app");
  useApp.setState({
    identity: "guest",
    hydrated: true,
    data: { ...emptySnapshot(), onboarded: true },
  });
  return { useApp, ...(await import("../../src/services/macosWidget")) };
}
describe("Mac widget workspace lifecycle", () => {
  it("republishes on explicit refresh while ordinary unchanged refreshes preserve the system budget", async () => {
    const service = await setup();
    await service.refreshMacWidget();
    request.mockClear();
    await service.refreshMacWidget();
    expect(request).not.toHaveBeenCalled();
    await service.refreshMacWidget(true);
    expect(request.mock.calls.at(-1)?.[0]).toMatchObject({
      op: "widget.publish",
    });
  });
  it("clears the shared view during sign-out/hydration and never publishes another owner", async () => {
    const service = await setup();
    await service.refreshMacWidget();
    expect(request.mock.calls.at(-1)?.[0]).toMatchObject({
      op: "widget.publish",
      identity: "guest",
    });
    service.useApp.setState({ identity: userA, hydrated: false });
    await service.refreshMacWidget();
    expect(request).toHaveBeenLastCalledWith({ op: "widget.clear" });
    expect(service.useMacWidget.getState().updated).toBe(false);
  });
  it("rejects stale activation results after a workspace switch", async () => {
    const service = await setup();
    request.mockImplementationOnce(async () => {
      service.useApp.setState({ identity: userA });
      return { available: true };
    });
    await service.refreshMacWidget();
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("does not publish when signing/shared-container setup is unavailable", async () => {
    const service = await setup();
    request.mockResolvedValueOnce({ available: false });
    await service.refreshMacWidget();
    expect(request).toHaveBeenCalledTimes(1);
    expect(service.useMacWidget.getState().available).toBe(false);
  });
  it("surfaces failures and lets a subsequent refresh recover", async () => {
    const service = await setup();
    request.mockRejectedValueOnce(new Error("Storage unavailable"));
    await service.refreshMacWidget();
    expect(service.useMacWidget.getState().error).toBe("Storage unavailable");
    await service.refreshMacWidget();
    expect(service.useMacWidget.getState().updated).toBe(true);
    expect(service.useMacWidget.getState().error).toBeNull();
  });
  it("does nothing in an ordinary browser", async () => {
    const service = await setup();
    vi.stubGlobal("subloomMac", undefined);
    await service.refreshMacWidget();
    expect(request).not.toHaveBeenCalled();
  });
});
