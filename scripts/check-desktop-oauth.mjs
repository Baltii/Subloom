import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createHash, randomBytes } from "node:crypto";
import { publicExpoEnvironment } from "./expo-env.mts";

// Exercise a canceled public OAuth round trip. No account, provider login,
// management credential or session token is created or read by this check.
const files = [".env.production.local", ".env.local", ".env.production", ".env"]
  .filter(existsSync)
  .map((file) => parseEnv(readFileSync(file, "utf8")));
const env = publicExpoEnvironment(process.env, files);
const base = new URL(
  env.EXPO_PUBLIC_SUPABASE_URL || "https://unconfigured.invalid",
);
if (base.protocol !== "https:" || base.hostname === "unconfigured.invalid")
  throw new Error(
    "Configure EXPO_PUBLIC_SUPABASE_URL before checking desktop OAuth.",
  );
const expected = "subloom://auth-callback";
const startURL = new URL("/auth/v1/authorize", base);
startURL.search = new URLSearchParams({
  provider: "google",
  redirect_to: expected,
  code_challenge: createHash("sha256")
    .update(randomBytes(32))
    .digest("base64url"),
  code_challenge_method: "s256",
}).toString();
const options = { redirect: "manual", signal: AbortSignal.timeout(15000) };
const start = await fetch(startURL, options);
const providerURL = start.headers.get("location");
if (!providerURL)
  throw new Error(`Google OAuth did not start (HTTP ${start.status}).`);
const state = new URL(providerURL).searchParams.get("state");
if (!state) throw new Error("The provider redirect had no OAuth state.");
const callback = new URL("/auth/v1/callback", base);
callback.search = new URLSearchParams({
  state,
  error: "access_denied",
}).toString();
const response = await fetch(callback, {
  ...options,
  signal: AbortSignal.timeout(15000),
});
const target = response.headers.get("location");
if (!target)
  throw new Error(`OAuth did not return a callback (HTTP ${response.status}).`);
const actual = new URL(target);
if (
  actual.protocol !== "subloom:" ||
  actual.host !== "auth-callback" ||
  !["", "/"].includes(actual.pathname) ||
  actual.username ||
  actual.password
)
  throw new Error(
    "OAuth returned to a website instead of Subloom. Allow the exact subloom://auth-callback redirect in Supabase Auth URL Configuration.",
  );
console.log(
  "PASS hosted Google OAuth returns to the desktop app callback (canceled public flow).",
);
