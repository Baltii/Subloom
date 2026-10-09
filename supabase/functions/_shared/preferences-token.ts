import { env, HttpError } from "./http.ts";
function encoded(value: Uint8Array) {
  return btoa(String.fromCharCode(...value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
async function key() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env("EMAIL_PREFERENCES_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
export async function signPreferencesToken(userId: string, issuedAt: string) {
  const expires = Math.floor(
      (new Date(issuedAt).getTime() + 90 * 86_400_000) / 1000,
    ),
    payload = userId + "." + expires;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await key(),
    new TextEncoder().encode(payload),
  );
  return payload + "." + encoded(new Uint8Array(signature));
}
export async function verifyPreferencesToken(token: string, now = Date.now()) {
  if (!/^[0-9a-f-]{36}\.\d{10}\.[a-zA-Z0-9_-]{43}$/.test(token))
    throw new HttpError(403, "Invalid preference link.");
  const [userId, expires, signature] = token.split(".");
  if (Number(expires) * 1000 < now)
    throw new HttpError(
      403,
      "This preference link has expired. Change preferences in Subloom Settings.",
    );
  const decoded = Uint8Array.from(
    atob(signature!.replace(/-/g, "+").replace(/_/g, "/") + "="),
    (c) => c.charCodeAt(0),
  );
  if (
    !(await crypto.subtle.verify(
      "HMAC",
      await key(),
      decoded,
      new TextEncoder().encode(userId + "." + expires),
    ))
  )
    throw new HttpError(403, "Invalid preference link.");
  return userId!;
}
