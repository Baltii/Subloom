import { afterEach, expect, it, vi } from "vitest";
import {
  openAuthBrowser,
  usesNativeAuthBrowser,
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
