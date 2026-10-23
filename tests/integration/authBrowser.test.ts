import { afterEach, expect, it, vi } from "vitest";
import {
  openAuthBrowser,
  usesNativeAuthBrowser,
  cancelAuthBrowser,
} from "../../src/services/authBrowser";
import { authRedirect, signInSocial } from "../../src/services/oauth";

const mocks = vi.hoisted(() => ({
  browser: vi.fn(),
  provider: vi.fn(),
  exchange: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("expo-linking", () => ({
  createURL: (path: string) => "subloom://" + path,
}));
vi.mock("expo-web-browser", () => ({ openAuthSessionAsync: mocks.browser }));
vi.mock("../../src/services/supabase", () => ({
  supabase: {
    auth: {
      signInWithOAuth: mocks.provider,
      exchangeCodeForSession: mocks.exchange,
    },
  },
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("returns Mac OAuth to the app's PKCE session rather than the external browser's storage", async () => {
  const request = vi
    .fn()
    .mockResolvedValue("subloom://auth-callback?code=mac-fixture");
  vi.stubGlobal("subloomMac", { version: 1, request });
  mocks.provider.mockResolvedValue({
    data: { url: "https://provider.test/authorize" },
    error: null,
  });
  mocks.exchange.mockResolvedValue({ error: null });
  expect(usesNativeAuthBrowser()).toBe(true);
  expect(authRedirect()).toBe("subloom://auth-callback");
  await signInSocial("google");
  expect(request).toHaveBeenCalledWith({
    op: "auth.open",
    url: "https://provider.test/authorize",
    redirect: "subloom://auth-callback",
  });
  expect(mocks.exchange).toHaveBeenCalledWith("mac-fixture");
  expect(mocks.browser).not.toHaveBeenCalled();
});

it("uses the same Mac callback transport for mailbox consent and surfaces cancellation", async () => {
  const request = vi
    .fn()
    .mockResolvedValue("subloom://mailboxes?connected=gmail");
  vi.stubGlobal("subloomMac", { version: 1, request });
  expect(
    await openAuthBrowser(
      "https://accounts.google.com/authorize",
      "subloom://mailboxes",
    ),
  ).toContain("connected=gmail");
  request.mockRejectedValue(new Error("Sign-in canceled"));
  await expect(
    openAuthBrowser(
      "https://accounts.google.com/authorize",
      "subloom://mailboxes",
    ),
  ).rejects.toThrow(/canceled/);
  expect(mocks.exchange).not.toHaveBeenCalled();
});

it("keeps ordinary web redirects on the browser origin", async () => {
  const assign = vi.fn();
  vi.stubGlobal("window", {
    location: { origin: "https://app.example", assign },
  });
  expect(usesNativeAuthBrowser()).toBe(false);
  expect(authRedirect()).toBe("https://app.example/auth-callback");
  expect(
    await openAuthBrowser("https://provider.test/authorize", authRedirect()),
  ).toBeNull();
  expect(assign).toHaveBeenCalledWith("https://provider.test/authorize");
});

it("returns Windows OAuth to the app profile and reuses the mailbox callback transport", async () => {
  const openAuth = vi
    .fn()
    .mockResolvedValue("subloom://auth-callback?code=windows-fixture");
  vi.stubGlobal("subloomWindows", { version: 1, openAuth });
  mocks.provider.mockResolvedValue({
    data: { url: "https://provider.test/authorize" },
    error: null,
  });
  mocks.exchange.mockResolvedValue({ error: null });
  expect(usesNativeAuthBrowser()).toBe(true);
  expect(authRedirect()).toBe("subloom://auth-callback");
  await signInSocial("google");
  expect(openAuth).toHaveBeenCalledWith(
    "https://provider.test/authorize",
    "subloom://auth-callback",
  );
  expect(mocks.provider).toHaveBeenCalledWith({
    provider: "google",
    options: {
      redirectTo: "subloom://auth-callback",
      skipBrowserRedirect: true,
    },
  });
  expect(mocks.exchange).toHaveBeenCalledWith("windows-fixture");
  openAuth.mockResolvedValue("subloom://mailboxes?connected=gmail");
  expect(
    await openAuthBrowser(
      "https://provider.test/consent",
      "subloom://mailboxes",
    ),
  ).toContain("connected=gmail");
  openAuth.mockRejectedValue(new Error("Sign-in canceled"));
  await expect(
    openAuthBrowser("https://provider.test", "subloom://auth-callback"),
  ).rejects.toThrow(/canceled/);
  expect(mocks.browser).not.toHaveBeenCalled();
});

it("fails explicitly when the Windows bridge is missing instead of opening a web session", () => {
  vi.stubGlobal("location", { protocol: "subloom-app:" });
  expect(() => authRedirect()).toThrow(/Restart Subloom/);
});

it("lets Windows cancel the pending browser request", async () => {
  const cancelAuth = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("subloomWindows", {
    version: 1,
    openAuth: vi.fn(),
    cancelAuth,
  });
  await cancelAuthBrowser();
  expect(cancelAuth).toHaveBeenCalledOnce();
});
