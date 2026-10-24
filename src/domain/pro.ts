import { z } from "zod";
import { p256 } from "@noble/curves/nist.js";

export const FREE_SUBSCRIPTIONS = 10;
export const FREE_CARDS = 1;
export const FREE_WALLETS = 1;
type BillingMethod = { id: string; kind: "card" | "wallet" | "bank" };
export const PRO_BILLING_METHODS = 50;
export const OFFLINE_PRO_MS = 72 * 3600_000;
export const licenseSchema = z
  .object({
    payload: z.string().max(1024),
    signature: z.string().regex(/^[a-f0-9]{128}$/),
  })
  .strict();
export type ProLicense = z.infer<typeof licenseSchema>;
const claimsSchema = z
  .object({
    v: z.literal(1),
    owner: z.string().uuid(),
    device: z.string().uuid(),
    iat: z.number().int().positive(),
    exp: z.number().int().positive(),
  })
  .strict();
export function verifyProLicense(
  license: unknown,
  publicKey: string,
  owner: string,
  device: string,
  now = Date.now(),
  lastSeen = 0,
) {
  try {
    const signed = licenseSchema.parse(license);
    const claims = claimsSchema.parse(JSON.parse(signed.payload));
    if (
      claims.owner !== owner ||
      claims.device !== device ||
      claims.iat > now + 60_000 ||
      claims.exp <= now ||
      claims.exp <= claims.iat ||
      claims.exp - claims.iat > OFFLINE_PRO_MS ||
      now < lastSeen - 60_000
    )
      return null;
    // WebCrypto emits compact P-256 signatures and may emit a high-S signature.
    const fromHex = (hex: string) =>
      Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) =>
        Number.parseInt(byte, 16),
      );
    if (!/^(02|03)[a-f0-9]{64}$|^04[a-f0-9]{128}$/i.test(publicKey))
      return null;
    if (
      !p256.verify(
        fromHex(signed.signature),
        new TextEncoder().encode(signed.payload),
        fromHex(publicKey),
        { prehash: true, lowS: false, format: "compact" },
      )
    )
      return null;
    return claims;
  } catch {
    return null;
  }
}
export function canAddBillingMethod(
  current: readonly BillingMethod[],
  next: readonly BillingMethod[],
  pro: boolean,
) {
  if (next.length > PRO_BILLING_METHODS) return false;
  if (pro) return true;
  return (["card", "wallet", "bank"] as const).every((kind) => {
    const methods = next.filter((method) => method.kind === kind);
    const limit =
      kind === "card" ? FREE_CARDS : kind === "wallet" ? FREE_WALLETS : 0;
    return (
      methods.length <= limit ||
      methods.every((method) =>
        current.some(
          (saved) => saved.id === method.id && saved.kind === method.kind,
        ),
      )
    );
  });
}

export function canAddSubscriptions(
  currentIds: readonly string[],
  nextIds: readonly string[],
  pro: boolean,
) {
  return (
    pro ||
    nextIds.length <= FREE_SUBSCRIPTIONS ||
    nextIds.every((id) => currentIds.includes(id))
  );
}
