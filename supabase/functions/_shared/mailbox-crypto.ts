import { env, HttpError } from "./http.ts";
export function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function decode(value: string) {
  const raw = atob(
    value.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (value.length % 4)) % 4),
  );
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
async function key() {
  const bytes = decode(env("MAILBOX_ENCRYPTION_KEY"));
  if (bytes.length !== 32)
    throw new HttpError(503, "Mailbox encryption is not configured.");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function seal(value: string, context: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(context) },
    await key(),
    new TextEncoder().encode(value),
  );
  return "v1." + base64url(iv) + "." + base64url(new Uint8Array(encrypted));
}
export async function unseal(value: string, context: string) {
  const [version, iv, data, ...rest] = value.split(".");
  if (version !== "v1" || !iv || !data || rest.length)
    throw new HttpError(503, "Reconnect this mailbox to restore access.");
  try {
    const plain = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decode(iv),
        additionalData: new TextEncoder().encode(context),
      },
      await key(),
      decode(data),
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new HttpError(503, "Reconnect this mailbox to restore access.");
  }
}
export async function challenge(verifier: string) {
  return base64url(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ),
  );
}
