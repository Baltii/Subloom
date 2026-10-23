import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptySnapshot } from "../../src/domain/models";
import { userA, userB } from "../fixtures";
import {
  enableWindowsReminders,
  maintainWindowsReminders,
  refreshWindowsReminders,
  sendWindowsTestNotification,
  useWindowsNotifications,
} from "../../src/services/windowsNotifications";
const mocks = vi.hoisted(() => ({
  state: { identity: "guest", hydrated: true, data: {} },
  subscribe: vi.fn(),
  activate: vi.fn(),
  enable: vi.fn(),
  replace: vi.fn(),
  test: vi.fn(),
  onClick: vi.fn(),
  plan: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("../../src/store/app", () => ({
  useApp: { getState: () => mocks.state, subscribe: mocks.subscribe },
  readableError: (e: Error) => e.message,
}));
vi.mock("../../src/services/notifications", () => ({
  safeNotificationPath: (path: unknown) => (path === "/settings" ? path : null),
}));
vi.mock("../../src/domain/localReminders", () => ({
  localReminderPlan: mocks.plan,
}));
const status = { supported: true, enabled: true, pending: 1 };
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mocks.state, {
    identity: "guest",
    hydrated: true,
    data: emptySnapshot(),
  });
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("subloomWindows", {
    version: 1,
    openAuth: vi.fn(),
    notifications: {
      activate: mocks.activate,
      enable: mocks.enable,
      replace: mocks.replace,
      test: mocks.test,
      onClick: mocks.onClick,
    },
  });
  mocks.activate.mockResolvedValue(status);
  mocks.enable.mockResolvedValue(status);
  mocks.replace.mockResolvedValue(status);
  mocks.test.mockResolvedValue(undefined);
  mocks.onClick.mockReturnValue(mocks.remove);
  mocks.subscribe.mockReturnValue(mocks.remove);
  mocks.plan.mockReturnValue([{ id: "fixture" }]);
  useWindowsNotifications.setState({ ...status, error: null });
});
afterEach(() => vi.unstubAllGlobals());
it("schedules guest reminders locally without mobile push or an account", async () => {
  await refreshWindowsReminders();
  expect(mocks.activate).toHaveBeenCalledWith("guest");
  expect(mocks.replace).toHaveBeenCalledWith("guest", [{ id: "fixture" }]);
  await enableWindowsReminders(true);
  expect(mocks.enable).toHaveBeenCalledWith("guest", true);
  await sendWindowsTestNotification();
  expect(mocks.test).toHaveBeenCalledWith("guest");
});
it("does not schedule a captured workspace after its activation races an account switch", async () => {
  mocks.state.identity = userA;
  mocks.activate.mockImplementationOnce(async () => {
    mocks.state.identity = userB;
    return status;
  });
  await refreshWindowsReminders();
  expect(mocks.replace).not.toHaveBeenCalled();
});
it("clears alerts during hydration and keeps ordinary browsers untouched", async () => {
  mocks.state.hydrated = false;
  await refreshWindowsReminders();
  expect(mocks.activate).toHaveBeenCalledWith(null);
  expect(mocks.replace).not.toHaveBeenCalled();
  vi.stubGlobal("subloomWindows", undefined);
  const cleanup = maintainWindowsReminders(vi.fn());
  cleanup();
  expect(mocks.onClick).not.toHaveBeenCalled();
});
it("only opens safe clicks for the hydrated active owner and invalidates on owner changes", async () => {
  const navigate = vi.fn();
  const cleanup = maintainWindowsReminders(navigate);
  await refreshWindowsReminders();
  const click = mocks.onClick.mock.calls[0]![0];
  click({ identity: userA, path: "/settings" });
  click({ identity: "guest", path: "https://evil.test" });
  expect(navigate).not.toHaveBeenCalled();
  click({ identity: "guest", path: "/settings" });
  expect(navigate).toHaveBeenCalledWith("/settings");
  const changed = mocks.subscribe.mock.calls[0]![0];
  mocks.state.identity = userB;
  changed(mocks.state, { ...mocks.state, identity: "guest" });
  expect(mocks.activate).toHaveBeenCalledWith(null);
  cleanup();
  await refreshWindowsReminders();
  expect(mocks.remove).toHaveBeenCalledTimes(2);
});
