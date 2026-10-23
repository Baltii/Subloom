import { describe, expect, it } from "vitest";
import { publicExpoEnvironment } from "../../scripts/expo-env.mts";

describe("public Expo build environment", () => {
  it("excludes server credentials from inherited and dotenv settings while retaining public config", () => {
    const env = publicExpoEnvironment(
      {
        PATH: "/bin",
        RESEND_API_KEY: "private-canary",
        VERCEL_OIDC_TOKEN: "private-token",
        SUPABASE_SERVICE_ROLE_KEY: "private-service-role",
        DATABASE_URL: "private-database",
        STRIPE_SECRET_KEY: "private-stripe",
        STRIPE_WEBHOOK_SECRET: "private-webhook",
        PRO_LICENSE_PRIVATE_JWK: "private-signing-jwk",
        EXPO_PUBLIC_PRO_LICENSE_PUBLIC_KEY: "public-verification-key",
        EXPO_PUBLIC_SUPABASE_URL: "https://shell.example",
      },
      [
        {
          EXPO_PUBLIC_SUPABASE_URL: "https://file.example",
          EXPO_PUBLIC_EAS_PROJECT_ID: "public-project",
          MAILBOX_ENCRYPTION_KEY: "private-key",
        },
      ],
    );
    expect(env).toMatchObject({
      PATH: "/bin",
      EXPO_PUBLIC_SUPABASE_URL: "https://shell.example",
      EXPO_PUBLIC_EAS_PROJECT_ID: "public-project",
      EXPO_NO_DOTENV: "1",
      EXPO_PUBLIC_PRO_LICENSE_PUBLIC_KEY: "public-verification-key",
    });
    expect(JSON.stringify(env)).not.toMatch(
      /private-canary|private-token|private-key|private-service-role|private-database|private-stripe|private-webhook|private-signing-jwk/,
    );
  });
  it("forwards the inherited Expo login token only to the explicit EAS workflow", () => {
    expect(
      publicExpoEnvironment({ EXPO_TOKEN: "login-token" }, []).EXPO_TOKEN,
    ).toBeUndefined();
    expect(
      publicExpoEnvironment({ EXPO_TOKEN: "login-token" }, [], true).EXPO_TOKEN,
    ).toBe("login-token");
    expect(
      publicExpoEnvironment({}, [{ EXPO_TOKEN: "dotenv-token" }], true)
        .EXPO_TOKEN,
    ).toBeUndefined();
  });
});
