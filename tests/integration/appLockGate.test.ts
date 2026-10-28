import * as React from "react";
import { createRequire } from "node:module";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppLockGate } from "../../src/components/security/AppLockGate";
import { emptyLockConfig, PIN_ITERATIONS } from "../../src/domain/appLock";
import type { LockState } from "../../src/domain/appLockController";

const { renderToStaticMarkup } = createRequire(import.meta.url)(
  "react-dom/server",
) as {
  renderToStaticMarkup: (node: React.ReactNode) => string;
};

const mocks = vi.hoisted(() => ({ useAppLock: vi.fn() }));
vi.mock("../../src/services/appLock", () => ({
  useAppLock: mocks.useAppLock,
  appLock: {},
}));
vi.mock("../../src/services/passkeys", () => ({
  passkeyAvailable: async () => false,
}));
vi.mock("../../src/theme/useTheme", () => ({
  useTheme: () => ({ colors: {} }),
}));
vi.mock("react-native", async () => {
  const { createElement } = await import("react");
  const container = ({ children }: { children?: React.ReactNode }) =>
    createElement("div", null, children);
  return {
    View: container,
    ScrollView: container,
    KeyboardAvoidingView: container,
    Pressable: container,
    Platform: { OS: "web" },
  };
});
vi.mock("lucide-react-native", () => ({
  LockKeyhole: () => null,
  KeyRound: () => null,
  ArrowLeft: () => null,
  ChevronRight: () => null,
}));
vi.mock("../../src/components/ui/Brand", () => ({ Brand: () => "Subloom" }));
vi.mock("../../src/components/ui/LoadingSkeleton", () => ({
  LoadingSkeleton: () => "Loading protection",
}));
vi.mock("../../src/components/ui/Primitives", async () => {
  const { createElement } = await import("react");
  const text = ({ children }: { children?: React.ReactNode }) =>
    createElement("span", null, children);
  return { Button: text, Label: text, Heading: text, Field: text };
});
vi.mock("../../src/components/security/RecoveryCodeNotice", () => ({
  RecoveryCodeNotice: () => null,
}));
vi.mock("../../src/components/security/PinCodeInput", async () => {
  const { createElement } = await import("react");
  return {
    PinCodeInput: ({ label = "6-digit PIN" }: { label?: string }) =>
      createElement("input", { "aria-label": label, type: "password" }),
  };
});
let state: LockState;
let protectedRenders: number;
function PersonalData() {
  protectedRenders++;
  return React.createElement("div", null, "private-subscription-details");
}
function render() {
  return renderToStaticMarkup(
    React.createElement(AppLockGate, null, React.createElement(PersonalData)),
  );
}
beforeEach(() => {
  // Expo's runtime supplies automatic JSX; support Vite's classic JSX transform here too.
  vi.stubGlobal("React", React);
  state = {
    ready: false,
    unlocked: false,
    busy: false,
    error: null,
    lockRevision: 0,
    config: emptyLockConfig(),
  };
  protectedRenders = 0;
  mocks.useAppLock.mockImplementation(
    (selector: (value: LockState) => unknown) => selector(state),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it.each([
  [false, false],
  [false, true],
  [true, false],
])(
  "does not mount personal screens when ready=%s and unlocked=%s",
  (ready, unlocked) => {
    state.ready = ready;
    state.unlocked = unlocked;
    expect(render()).not.toContain("private-subscription-details");
    expect(protectedRenders).toBe(0);
  },
);
it("mounts personal screens only after configuration is loaded and verification succeeds", () => {
  state.ready = true;
  state.unlocked = true;
  expect(render()).toContain("private-subscription-details");
  expect(protectedRenders).toBe(1);
});
it("shows a retry on storage failure without mounting private content", () => {
  state.error = "App protection could not be loaded. Your app remains locked.";
  const html = render();
  expect(html).toContain("remains locked");
  expect(html).toContain("Retry loading protection");
  expect(protectedRenders).toBe(0);
});
it("renders a masked PIN prompt instead of protected screens on a locked startup", () => {
  state.ready = true;
  state.config.pin = {
    salt: "a1".repeat(16),
    hash: "b2".repeat(32),
    iterations: PIN_ITERATIONS,
  };
  const html = render();
  expect(html).toContain("Your PIN, and you’re in.");
  expect(html).toContain('type="password"');
  expect(html).toContain("6-digit PIN");
  expect(html).not.toContain(state.config.pin.hash);
  expect(protectedRenders).toBe(0);
});
it("offers two method choices without exposing the PIN input when both methods are enabled", () => {
  state.ready = true;
  state.config.pin = {
    salt: "a1".repeat(16),
    hash: "b2".repeat(32),
    iterations: PIN_ITERATIONS,
  };
  state.config.passkey = {
    id: "passkey",
    publicKey: "public",
    rpId: "subloom.test",
    origin: "https://subloom.test",
    counter: 0,
  };
  const html = render();
  expect(html).toContain("Welcome back.");
  expect(html).toContain("Passkey");
  expect(html).toContain("PIN code");
  expect(html).not.toContain('type="password"');
  expect(protectedRenders).toBe(0);
});
it("shows a ten-minute pause instead of a PIN field while PIN-only protection is blocked", () => {
  state.ready = true;
  state.config.pin = {
    salt: "a1".repeat(16),
    hash: "b2".repeat(32),
    iterations: PIN_ITERATIONS,
  };
  state.config.failures = 3;
  state.config.retryAt = Date.now() + 600_000;
  const html = render();
  expect(html).toContain("3 attempts wrong. Try again later.");
  expect(html).toContain("PIN will be available in 10:00");
  expect(html).not.toContain('type="password"');
  expect(protectedRenders).toBe(0);
});
