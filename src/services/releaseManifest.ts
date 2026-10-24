import { ed25519 } from "@noble/curves/ed25519.js";
import { hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import {
  parseEnvelope,
  validateRelease,
  FEED_URL,
} from "../../updates/protocol.cjs";
import trust from "../../updates/trust.json";

export function verifyReleaseManifest(
  text: string,
  publicKey = trust.publicKey,
) {
  const envelope = parseEnvelope(text);
  if (
    !ed25519.verify(
      hexToBytes(envelope.signature),
      utf8ToBytes(envelope.payload),
      hexToBytes(publicKey),
    )
  )
    throw new Error("This update could not be verified. Try again later.");
  return validateRelease(JSON.parse(envelope.payload));
}
export async function fetchReleaseManifest() {
  // React Native's AbortSignal polyfill does not provide timeout().
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(FEED_URL, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    // Older releases have no signed feed. Never fall back to unsigned release data.
    if (response.status === 404) return null;
    if (!response.ok)
      throw new Error(
        "Could not check for updates. Try again while connected.",
      );
    if (Number(response.headers.get("content-length")) > 65536)
      throw new Error("The update information is too large.");
    return verifyReleaseManifest(await response.text());
  } finally {
    clearTimeout(timer);
  }
}
