import { p256 } from "@noble/curves/nist.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { concatBytes } from "@noble/hashes/utils.js";
import type { AppPasskey } from "../domain/appLock";
import { macosBridge } from "./macosBridge";
import { windowsBridge } from "./windowsBridge";

function encode(value: ArrayBuffer | Uint8Array) {
  return btoa(String.fromCharCode(...new Uint8Array(value)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function decode(value: string) {
  return Uint8Array.from(
    atob(value.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
}
function challenge() {
  return crypto.getRandomValues(new Uint8Array(32));
}
export async function passkeyAvailable() {
  // The desktop shells use local/custom origins, which cannot register an RP.
  return (
    !macosBridge() &&
    !windowsBridge() &&
    globalThis.isSecureContext === true &&
    typeof PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials?.create === "function" &&
    typeof navigator.credentials?.get === "function"
  );
}
function checkClientData(
  raw: ArrayBuffer,
  expected: Uint8Array,
  type: string,
  origin: string,
) {
  const client = JSON.parse(new TextDecoder().decode(raw));
  if (
    client.type !== type ||
    client.challenge !== encode(expected) ||
    client.origin !== origin ||
    client.crossOrigin === true
  )
    throw new Error("The passkey response could not be verified.");
}
function checkAuthenticator(raw: ArrayBuffer, rpId: string) {
  const data = new Uint8Array(raw),
    rpHash = sha256(new TextEncoder().encode(rpId));
  if (
    data.length < 37 ||
    !rpHash.every((value, i) => data[i] === value) ||
    (data[32]! & 5) !== 5
  )
    throw new Error(
      "Verify your identity with your device to use this passkey.",
    );
  return new DataView(raw).getUint32(33, false);
}
export async function createAppPasskey(): Promise<AppPasskey> {
  if (!(await passkeyAvailable()))
    throw new Error(
      "Passkeys are unavailable here. Use PIN protection or a supported HTTPS browser.",
    );
  const nonce = challenge(),
    rpId = location.hostname,
    origin = location.origin;
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: nonce,
      rp: { id: rpId, name: "Subloom" },
      user: {
        id: challenge(),
        name: "subloom-device-" + encode(challenge()).slice(0, 12),
        displayName: "Subloom app lock",
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
      attestation: "none",
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("Passkey setup was canceled.");
  const response = credential.response as AuthenticatorAttestationResponse;
  checkClientData(response.clientDataJSON, nonce, "webauthn.create", origin);
  const publicKey = response.getPublicKey?.();
  if (!publicKey || response.getPublicKeyAlgorithm() !== -7)
    throw new Error(
      "This browser cannot save a compatible passkey. Try an updated browser.",
    );
  const counter = checkAuthenticator(response.getAuthenticatorData(), rpId);
  // Importing rejects malformed/unsupported public keys before saving anything.
  await crypto.subtle.importKey(
    "spki",
    publicKey,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"],
  );
  const passkey = {
    id: encode(credential.rawId),
    publicKey: encode(publicKey),
    rpId,
    origin,
    counter,
  };
  // Prove possession before committing the setting, independent of attestation.
  passkey.counter = await verifyAppPasskey(passkey);
  return passkey;
}
export async function verifyAppPasskey(passkey: AppPasskey): Promise<number> {
  if (
    !(await passkeyAvailable()) ||
    location.origin !== passkey.origin ||
    location.hostname !== passkey.rpId
  )
    throw new Error(
      "Open Subloom in the browser where you enabled this passkey, or use your PIN.",
    );
  const nonce = challenge();
  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: nonce,
      rpId: passkey.rpId,
      userVerification: "required",
      timeout: 60_000,
      allowCredentials: [{ type: "public-key", id: decode(passkey.id) }],
    },
  })) as PublicKeyCredential | null;
  if (!credential)
    throw new Error(
      "Passkey verification was canceled. Try again or use your PIN.",
    );
  if (encode(credential.rawId) !== passkey.id)
    throw new Error("This passkey does not match your app lock.");
  const response = credential.response as AuthenticatorAssertionResponse;
  checkClientData(
    response.clientDataJSON,
    nonce,
    "webauthn.get",
    passkey.origin,
  );
  const counter = checkAuthenticator(response.authenticatorData, passkey.rpId);
  if ((counter !== 0 || passkey.counter !== 0) && counter <= passkey.counter)
    throw new Error("The passkey verification was repeated. Try again.");
  const key = await crypto.subtle.importKey(
    "spki",
    decode(passkey.publicKey),
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"],
  );
  const point = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  const signed = concatBytes(
    new Uint8Array(response.authenticatorData),
    sha256(new Uint8Array(response.clientDataJSON)),
  );
  if (
    !p256.verify(new Uint8Array(response.signature), signed, point, {
      format: "der",
      lowS: false,
    })
  )
    throw new Error("The passkey signature could not be verified.");
  return counter;
}
