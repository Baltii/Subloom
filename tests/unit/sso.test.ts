import { expect, it } from "vitest";
import { organizationDomain, ssoProvider } from "../../src/domain/sso";
const provider = "10000000-0000-4000-8000-000000000001";
it("validates organization domain routing without accepting URLs or email addresses", () => {
  expect(organizationDomain(" Company.COM ")).toBe("company.com");
  for (const input of [
    "https://company.com",
    "me@company.com",
    "company.com/next",
    "-bad.com",
    "a..com",
    "localhost",
    "a." + "x".repeat(64),
  ])
    expect(() => organizationDomain(input)).toThrow();
});
it("finds verified SAML hints after MFA and ignores user metadata and ambiguous providers", () => {
  expect(
    ssoProvider({
      amr: [{ method: "totp" }, { method: "sso/saml", provider }],
    }),
  ).toBe(provider);
  expect(
    ssoProvider({ user_metadata: { iss: provider }, amr: [{ method: "otp" }] }),
  ).toBeNull();
  expect(
    ssoProvider({
      amr: [
        { method: "sso/saml", provider },
        {
          method: "sso/saml",
          provider: "10000000-0000-4000-8000-000000000002",
        },
      ],
    }),
  ).toBeNull();
  expect(
    ssoProvider({ amr: [{ method: "sso/saml", provider: "invalid" }] }),
  ).toBeNull();
});
