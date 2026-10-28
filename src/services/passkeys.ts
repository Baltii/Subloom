import type { AppPasskey } from "../domain/appLock";

export async function passkeyAvailable() {
  return false;
}
export async function createAppPasskey(): Promise<AppPasskey> {
  throw new Error(
    "Passkeys are not available in this app build. Use PIN protection on this device.",
  );
}
export async function verifyAppPasskey(_passkey: AppPasskey): Promise<number> {
  throw new Error(
    "Passkeys are not available in this app build. Use your PIN.",
  );
}
