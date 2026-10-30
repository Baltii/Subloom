import { afterEach, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import { emptySnapshot } from "../../src/domain/models";
import { emptyLockConfig } from "../../src/domain/appLock";
import { maintainWidgets } from "../../src/services/widgets";
import { subscription } from "../fixtures";
const mocks = vi.hoisted(() => ({
  replace: vi.fn(async (_value: string) => {}),
  app: null as unknown,
  lock: null as unknown,
}));
vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  AppState: { addEventListener: () => ({ remove: vi.fn() }) },
}));
vi.mock("expo", () => ({
  requireOptionalNativeModule: () => ({ replace: mocks.replace }),
}));
vi.mock("../../src/store/app", () => ({
  get useApp() {
    return mocks.app;
  },
}));
vi.mock("../../src/services/appLock", () => ({
  appLock: {
    get state() {
      return mocks.lock;
    },
  },
}));
vi.mock("../../src/services/macosBridge", () => ({
  macosBridge: () => null,
  macosRequest: vi.fn(),
}));
afterEach(() => {
  vi.useRealTimers();
  mocks.replace.mockClear();
});
it("clears previous workspace data on switch and publishes only the current workspace after hydration", async () => {
  const app = createStore(() => ({
    identity: "guest",
    hydrated: true,
    data: {
      ...emptySnapshot(),
      onboarded: true,
      preferences: { ...emptySnapshot().preferences, privacyMode: false },
      subscriptions: [subscription()],
    },
  }));
  const lock = createStore(() => ({ ready: true, config: emptyLockConfig() }));
  mocks.app = app;
  mocks.lock = lock;
  const stop = maintainWidgets();
  await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalledTimes(1));
  expect(JSON.parse(mocks.replace.mock.calls[0]![0]).entries[0].name).toBe(
    "Spotify",
  );
  app.setState({ hydrated: false });
  app.setState({
    identity: "another-account",
    hydrated: true,
    data: {
      ...emptySnapshot(),
      onboarded: true,
      preferences: { ...emptySnapshot().preferences, privacyMode: false },
      subscriptions: [],
    },
  });
  await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalledTimes(3));
  expect(JSON.parse(mocks.replace.mock.calls[1]![0])).toMatchObject({
    mode: "setup",
    entries: [],
  });
  expect(JSON.parse(mocks.replace.mock.calls[2]![0]).entries[0].name).toBe(
    "All clear",
  );
  app.setState((s) => ({
    data: {
      ...s.data,
      preferences: { ...s.data.preferences, privacyMode: true },
    },
  }));
  await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalledTimes(4));
  expect(JSON.parse(mocks.replace.mock.calls[3]![0])).toMatchObject({
    mode: "private",
    entries: [],
  });
  stop();
});
it("keeps details hidden until app protection has loaded", async () => {
  mocks.app = createStore(() => ({
    identity: "guest",
    hydrated: true,
    data: {
      ...emptySnapshot(),
      onboarded: true,
      preferences: { ...emptySnapshot().preferences, privacyMode: false },
      subscriptions: [subscription()],
    },
  }));
  mocks.lock = createStore(() => ({ ready: false, config: emptyLockConfig() }));
  const stop = maintainWidgets();
  await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalledTimes(1));
  expect(JSON.parse(mocks.replace.mock.calls[0]![0])).toMatchObject({
    mode: "private",
    entries: [],
  });
  stop();
});
