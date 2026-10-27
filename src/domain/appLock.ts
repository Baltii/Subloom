import { z } from "zod";
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

export const PIN_ITERATIONS = 600_000;
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
export const lockConfigSchema = z.object({
  version: z.literal(1),
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
});
export type LockConfig = z.infer<typeof lockConfigSchema>;
export const emptyLockConfig = (): LockConfig => ({
  version: 1,
  pin: null,
  passkey: null,
  failures: 0,
  retryAt: 0,
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
  const failures = Math.min(config.failures + 1, 100);
  // Five attempts, then exponential backoff, capped at fifteen minutes.
  const delay =
    failures < 5
      ? 0
      : Math.min(900_000, 30_000 * 2 ** Math.min(failures - 5, 5));
  return { ...config, failures, retryAt: delay ? now + delay : 0 };
}
