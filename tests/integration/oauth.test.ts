import {
  signInSocial,
  finishSignIn,
  signInOrganization,
} from "../../src/services/oauth";
import { beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  provider: vi.fn(),
  sso: vi.fn(),
  exchange: vi.fn(),
  browser: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-linking", () => ({ createURL: () => "subloom://auth-callback" }));
vi.mock("expo-web-browser", () => ({ openAuthSessionAsync: mocks.browser }));
vi.mock("../../src/services/supabase", () => ({
  supabase: {
    auth: {
      signInWithOAuth: mocks.provider,
      signInWithSSO: mocks.sso,
      exchangeCodeForSession: mocks.exchange,
    },
  },
}));
beforeEach(() => {
  mocks.provider.mockReset().mockResolvedValue({
    data: { url: "https://provider.test/authorize" },
    error: null,
  });
  mocks.exchange.mockReset().mockResolvedValue({ error: null });
  mocks.browser.mockReset().mockResolvedValue({
    type: "success",
    url: "subloom://auth-callback?code=native-code",
  });
});
it("requests PKCE redirect and exchanges the native code once", async () => {
  await signInSocial("google");
  expect(mocks.provider).toHaveBeenCalledWith({
    provider: "google",
    options: {
      redirectTo: "subloom://auth-callback",
      skipBrowserRedirect: true,
    },
  });
  await finishSignIn("subloom://auth-callback?code=native-code");
  expect(mocks.exchange).toHaveBeenCalledTimes(1);
});
it("reports cancel and unavailable providers without discarding local data", async () => {
  mocks.browser.mockResolvedValue({ type: "cancel" });
  await expect(signInSocial("apple")).rejects.toThrow(/canceled/);
  mocks.provider.mockResolvedValue({
    data: { url: null },
    error: new Error("not enabled"),
  });
  await expect(signInSocial("google")).rejects.toThrow(/unavailable/);
});
it("reports exchange failures and permits another attempt", async () => {
  mocks.exchange.mockResolvedValue({ error: new Error("expired") });
  await expect(
    finishSignIn("subloom://auth-callback?code=expired-code"),
  ).rejects.toThrow(/expired/);
  mocks.exchange.mockResolvedValue({ error: null });
  await finishSignIn("subloom://auth-callback?code=new-code");
});

it("routes organization SSO through the shared PKCE callback and surfaces unavailable domains", async () => {
  mocks.sso.mockResolvedValue({
    data: { url: "https://sso.test/authorize" },
    error: null,
  });
  mocks.browser.mockResolvedValue({
    type: "success",
    url: "subloom://auth-callback?code=sso-code",
  });
  await signInOrganization("Company.COM");
  expect(mocks.sso).toHaveBeenCalledWith({
    domain: "company.com",
    options: {
      redirectTo: "subloom://auth-callback",
      skipBrowserRedirect: true,
    },
  });
  mocks.sso.mockResolvedValue({
    data: { url: null },
    error: new Error("missing provider"),
  });
  await expect(signInOrganization("company.com")).rejects.toThrow(
    /administrator/,
  );
  await expect(signInOrganization("https://evil.test")).rejects.toThrow(
    /domain/,
  );
});
