import { z } from "zod";
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

export const PIN_ITERATIONS = 600_000;
export const PIN_ATTEMPT_LIMIT = 3;
export const PIN_BLOCK_MS = 10 * 60_000;
export const lockStorageKey = "subloom.app-lock.v1";
export const pinPattern = /^\d{6}$/;
export const passkeySchema = z.object({
  id: z.string().min(1).max(2048),
  publicKey: z.string().min(1).max(2048),
  rpId: z.string().min(1).max(253),
  origin: z.string().min(1).max(512),
  counter: z.number().int().nonnegative(),
});
export type AppPasskey = z.infer<typeof passkeySchema>;
export const lockConfigSchema = z
  .object({
    version: z.union([z.literal(1), z.literal(2)]),
    pin: z
      .object({
        salt: z.string().regex(/^[a-f0-9]{32}$/),
        hash: z.string().regex(/^[a-f0-9]{64}$/),
        iterations: z.literal(PIN_ITERATIONS),
      })
      .nullable(),
    passkey: passkeySchema.nullable(),
    failures: z.number().int().min(0).max(100),
    retryAt: z.number().finite().nonnegative(),
    recoveryHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable()
      .default(null),
    recoveryFailures: z.number().int().min(0).max(100).default(0),
    recoveryRetryAt: z.number().finite().nonnegative().default(0),
  })
  .transform((config) => ({ ...config, version: 2 as const }));
export type LockConfig = z.infer<typeof lockConfigSchema>;
export const emptyLockConfig = (): LockConfig => ({
  version: 2,
  pin: null,
  passkey: null,
  failures: 0,
  retryAt: 0,
  recoveryHash: null,
  recoveryFailures: 0,
  recoveryRetryAt: 0,
});
export const hasAppLock = (config: LockConfig) =>
  Boolean(config.pin || config.passkey);
export async function hashPin(pin: string, salt: string) {
  if (!pinPattern.test(pin)) throw new Error("Enter a 6-digit PIN.");
  return bytesToHex(
    await pbkdf2Async(sha256, pin, hexToBytes(salt), {
      c: PIN_ITERATIONS,
      dkLen: 32,
      asyncTick: 10,
    }),
  );
}
export function equalHash(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++)
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
export function failedPin(config: LockConfig, now: number): LockConfig {
  const failures =
    config.retryAt > 0 && now >= config.retryAt
      ? 1
      : Math.min(config.failures + 1, PIN_ATTEMPT_LIMIT);
  return {
    ...config,
    failures,
    retryAt: failures >= PIN_ATTEMPT_LIMIT ? now + PIN_BLOCK_MS : 0,
  };
}

export function normalizeRecoveryCode(code: string) {
  return code.replace(/[\s-]/g, "").toUpperCase();
}
export function formatRecoveryCode(code: string) {
  const normalized = normalizeRecoveryCode(code);
  if (!/^[A-F0-9]{32}$/.test(normalized))
    throw new Error("A recovery code could not be created. Please retry.");
  return normalized.match(/.{4}/g)!.join("-");
}
export function recoveryCodeHash(code: string) {
  const normalized = normalizeRecoveryCode(code);
  if (!/^[A-F0-9]{32}$/.test(normalized)) return null;
  // A 128-bit random recovery secret has no PIN-like low-entropy search space.
  return bytesToHex(
    sha256(new TextEncoder().encode("subloom-app-recovery:v1:" + normalized)),
  );
}

export function pinBlockedMessage(hasPasskey: boolean) {
  return hasPasskey
    ? "3 attempts wrong. Try another method."
    : "3 attempts wrong. Try again later.";
}
