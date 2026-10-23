import { it, expect } from "vitest";
import { callbackCode } from "../../src/domain/oauth";
it("accepts only a code at the expected callback", () => {
  expect(
    callbackCode(
      "subloom://auth-callback?code=test-code",
      "subloom://auth-callback",
    ),
  ).toBe("test-code");
  expect(
    callbackCode(
      "subloom://auth-callback/?code=windows",
      "subloom://auth-callback",
    ),
  ).toBe("windows");
  expect(
    callbackCode(
      "https://app.test/auth-callback?code=ok",
      "https://app.test/auth-callback",
    ),
  ).toBe("ok");
  for (const url of [
    "https://evil.test/auth-callback?code=x",
    "https://app.test/wrong?code=x",
    "https://app.test/auth-callback?error=denied",
    "https://app.test/auth-callback#access_token=secret",
    "https://app.test/auth-callback",
  ])
    expect(() => callbackCode(url, "https://app.test/auth-callback")).toThrow();
});
