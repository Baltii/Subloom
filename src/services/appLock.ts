import { useStore } from "zustand";
import { getRandomBytesAsync } from "expo-crypto";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  createLockController,
  type LockState,
} from "../domain/appLockController";
import { lockStorage } from "./lockStorage";
import { createAppPasskey, verifyAppPasskey } from "./passkeys";

export const appLock = createLockController({
  read: lockStorage.read,
  write: lockStorage.write,
  randomSalt: async () => bytesToHex(await getRandomBytesAsync(16)),
  createPasskey: createAppPasskey,
  verifyPasskey: verifyAppPasskey,
});
export function useAppLock<T>(selector: (state: LockState) => T) {
  return useStore(appLock.state, selector);
}
