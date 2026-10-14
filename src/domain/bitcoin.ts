import { z } from "zod";
import { financeLabel } from "./finance.ts";
import { dateSchema } from "./models.ts";
const alphabet = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
// BIP 173 / BIP 350 witness-address decoding. Mainnet v0/v1 only.
export function validBitcoinAddress(input: string) {
  if (input !== input.toLowerCase() && input !== input.toUpperCase())
    return false;
  const address = input.toLowerCase();
  if (!/^bc1[qp][023456789acdefghjklmnpqrstuvwxyz]{38,59}$/.test(address))
    return false;
  const data = [...address.slice(3)].map((c) => alphabet.indexOf(c));
  if (data.some((v) => v < 0)) return false;
  let checksum = 1;
  const generators = [
    0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3,
  ];
  for (const value of [3, 3, 0, 2, 3, ...data]) {
    const top = checksum >>> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) checksum ^= generators[i]!;
  }
  const version = data[0]!;
  if (checksum >>> 0 !== (version === 0 ? 1 : 0x2bc830a3)) return false;
  let accumulator = 0,
    bits = 0,
    length = 0;
  for (const value of data.slice(1, -6)) {
    accumulator = ((accumulator << 5) | value) & 0xffff;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      length++;
    }
  }
  if (bits >= 5 || (accumulator << (8 - bits)) & 255) return false;
  return version === 0 ? length === 20 || length === 32 : length === 32;
}
export const bitcoinAddressSchema = z
  .string()
  .trim()
  .refine(
    validBitcoinAddress,
    "Enter a valid Bitcoin mainnet SegWit or Taproot address (bc1…).",
  )
  .transform((v) => v.toLowerCase());
export const cryptoWalletSchema = z
  .object({
    id: z.string().uuid(),
    name: financeLabel,
    address: bitcoinAddressSchema,
  })
  .strict();
export const renewalIntentSchema = z
  .object({
    subscriptionId: z.string().uuid(),
    mode: z.enum(["manual", "renew", "cancel"]),
    reviewDate: dateSchema,
  })
  .strict();
export const cryptoSchema = z
  .object({
    wallets: z.array(cryptoWalletSchema).max(20),
    intentions: z.array(renewalIntentSchema).max(100),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      new Set(v.wallets.map((w) => w.id)).size !== v.wallets.length ||
      new Set(v.wallets.map((w) => w.address)).size !== v.wallets.length ||
      new Set(v.intentions.map((r) => r.subscriptionId)).size !==
        v.intentions.length
    )
      ctx.addIssue({
        code: "custom",
        message: "This address or renewal preference is already saved.",
      });
  });
export type CryptoSettings = z.infer<typeof cryptoSchema>;
export const initialCrypto: CryptoSettings = { wallets: [], intentions: [] };
export const bitcoinTransactionSchema = z
  .object({
    txid: z.string().regex(/^[a-f0-9]{64}$/),
    netSats: z
      .number()
      .int()
      .min(-2_100_000_000_000_000)
      .max(2_100_000_000_000_000),
    confirmed: z.boolean(),
    blockTime: z.number().int().positive().nullable(),
  })
  .strict()
  .refine(
    (t) => t.confirmed === (t.blockTime !== null),
    "Invalid confirmation details.",
  );
export const bitcoinHistorySchema = z
  .object({
    address: bitcoinAddressSchema,
    transactions: z.array(bitcoinTransactionSchema).max(25),
    fetchedAt: z.string().datetime(),
    provider: z.literal("mempool"),
  })
  .strict();
export type BitcoinHistory = z.infer<typeof bitcoinHistorySchema>;
export function parseSats(value: string) {
  if (!/^\d{1,8}(?:\.\d{1,8})?$/.test(value.trim()))
    throw new Error("Enter a BTC amount with up to eight decimal places.");
  const [whole, fraction = ""] = value.trim().split(".");
  const sats = BigInt(whole!) * 100_000_000n + BigInt(fraction.padEnd(8, "0"));
  if (sats <= 0n || sats > 2_100_000_000_000_000n)
    throw new Error(
      "Enter a positive BTC amount within the Bitcoin supply limit.",
    );
  return Number(sats);
}
export function formatBtc(sats: number) {
  if (!Number.isSafeInteger(sats) || Math.abs(sats) > 2_100_000_000_000_000)
    throw new Error("Invalid Bitcoin amount.");
  const amount = BigInt(Math.abs(sats));
  return (
    (sats < 0 ? "−" : "") +
    amount / 100_000_000n +
    "." +
    (amount % 100_000_000n).toString().padStart(8, "0")
  );
}
export function bitcoinPaymentUri(address: string, amount: string) {
  const destination = bitcoinAddressSchema.parse(address),
    sats = parseSats(amount);
  return "bitcoin:" + destination + "?amount=" + formatBtc(sats);
}
