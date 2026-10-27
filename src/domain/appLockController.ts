import { createStore } from "zustand/vanilla";
import {
  emptyLockConfig,
  equalHash,
  failedPin,
  hasAppLock,
  hashPin,
  lockConfigSchema,
  pinPattern,
  PIN_ITERATIONS,
  type AppPasskey,
  type LockConfig,
} from "./appLock";

export type LockProof = { pin: string } | { passkey: true };
type Dependencies = {
  read: () => Promise<string | null>;
  write: (value: string) => Promise<void>;
  randomSalt: () => Promise<string>;
  createPasskey: () => Promise<AppPasskey>;
  verifyPasskey: (passkey: AppPasskey) => Promise<number>;
  derivePin?: typeof hashPin;
  now?: () => number;
};
export type LockState = {
  ready: boolean;
  unlocked: boolean;
  busy: boolean;
  config: LockConfig;
  error: string | null;
};
export function createLockController(deps: Dependencies) {
  const state = createStore<LockState>(() => ({
    ready: false,
    unlocked: false,
    busy: false,
    config: emptyLockConfig(),
    error: null,
  }));
  let epoch = 0,
    working = false;
  let loading: Promise<void> | undefined;
  const now = deps.now ?? Date.now,
    derive = deps.derivePin ?? hashPin;
  async function initialize() {
    if (loading) return loading;
    const revision = ++epoch;
    state.setState({ ready: false, unlocked: false, error: null });
    loading = (async () => {
      try {
        const raw = await deps.read();
        const config =
          raw === null
            ? emptyLockConfig()
            : lockConfigSchema.parse(JSON.parse(raw));
        if (revision === epoch)
          state.setState({
            config,
            ready: true,
            unlocked: !hasAppLock(config),
          });
      } catch {
        if (revision === epoch)
          state.setState({
            error:
              "App protection could not be loaded. Your app remains locked. Retry loading.",
          });
      }
    })().finally(() => {
      loading = undefined;
    });
    return loading;
  }
  function lock() {
    if (!state.getState().ready) return;
    // Even a repeated background event cancels in-flight authentication.
    epoch++;
    if (hasAppLock(state.getState().config))
      state.setState({ unlocked: false });
  }
  function checkRevision(revision: number) {
    if (revision !== epoch)
      throw new Error(
        "The app was locked during verification. Please try again.",
      );
  }
  async function save(config: LockConfig, revision = epoch) {
    await deps.write(JSON.stringify(config));
    state.setState({
      config,
      ...(!hasAppLock(config)
        ? { unlocked: true }
        : revision !== epoch
          ? { unlocked: false }
          : {}),
    });
  }
  async function exclusive<T>(action: (revision: number) => Promise<T>) {
    if (working || !state.getState().ready)
      throw new Error("App protection is busy. Please try again.");
    working = true;
    state.setState({ busy: true });
    const revision = epoch;
    try {
      return await action(revision);
    } finally {
      working = false;
      state.setState({ busy: false });
    }
  }
  async function verify(
    proof: LockProof | undefined,
    revision: number,
  ): Promise<LockConfig> {
    let config = state.getState().config;
    if (!hasAppLock(config)) return config;
    if (!proof)
      throw new Error(
        "Verify your current PIN or passkey to change app protection.",
      );
    if ("pin" in proof) {
      if (!config.pin) throw new Error("PIN protection is not enabled.");
      if (config.retryAt > now())
        throw new Error(
          `Too many attempts. Try again in ${Math.ceil((config.retryAt - now()) / 1000)} seconds, or use your passkey.`,
        );
      const matches =
        pinPattern.test(proof.pin) &&
        equalHash(await derive(proof.pin, config.pin.salt), config.pin.hash);
      checkRevision(revision);
      if (!matches) {
        config = failedPin(config, now());
        await save(config, revision);
        throw new Error(
          config.retryAt > now()
            ? `Too many incorrect PINs. Try again in ${Math.ceil((config.retryAt - now()) / 1000)} seconds.`
            : "Incorrect PIN. Please try again.",
        );
      }
    } else {
      if (!config.passkey)
        throw new Error("Passkey protection is not enabled.");
      const counter = await deps.verifyPasskey(config.passkey);
      checkRevision(revision);
      config = { ...config, passkey: { ...config.passkey, counter } };
    }
    return { ...config, failures: 0, retryAt: 0 };
  }
  function requireUnlocked() {
    if (!state.getState().unlocked)
      throw new Error("Unlock Subloom before changing app protection.");
  }
  const controller = {
    state,
    initialize,
    lock,
    async unlock(proof: LockProof) {
      return exclusive(async (revision) => {
        const config = await verify(proof, revision);
        checkRevision(revision);
        await save(config);
        checkRevision(revision);
        state.setState({ unlocked: true });
      });
    },
    async setPin(pin: string | null, proof?: LockProof) {
      return exclusive(async (revision) => {
        requireUnlocked();
        if (pin !== null && !pinPattern.test(pin))
          throw new Error("Choose a 6-digit PIN.");
        const config = await verify(proof, revision);
        const salt = pin === null ? null : await deps.randomSalt();
        const nextPin: LockConfig["pin"] =
          pin === null
            ? null
            : {
                salt: salt!,
                hash: await derive(pin, salt!),
                iterations: PIN_ITERATIONS,
              };
        checkRevision(revision);
        requireUnlocked();
        await save({ ...config, pin: nextPin }, revision);
        // Enabling the first method must not unlock an app backgrounded during the write.
        if (revision !== epoch && nextPin) state.setState({ unlocked: false });
      });
    },
    async setPasskey(enabled: boolean, proof?: LockProof) {
      return exclusive(async (revision) => {
        requireUnlocked();
        const config = await verify(proof, revision);
        const passkey = enabled ? await deps.createPasskey() : null;
        checkRevision(revision);
        requireUnlocked();
        await save({ ...config, passkey }, revision);
        if (revision !== epoch && passkey) state.setState({ unlocked: false });
      });
    },
  };
  return controller;
}
