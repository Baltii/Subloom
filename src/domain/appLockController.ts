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
  PIN_ATTEMPT_LIMIT,
  PIN_BLOCK_MS,
  pinBlockedMessage,
  formatRecoveryCode,
  recoveryCodeHash,
  type AppPasskey,
  type LockConfig,
} from "./appLock";

export type LockProof = { pin: string } | { passkey: true };
type Dependencies = {
  read: () => Promise<string | null>;
  write: (value: string) => Promise<void>;
  randomSalt: () => Promise<string>;
  randomRecoveryCode?: () => Promise<string>;
  createPasskey: () => Promise<AppPasskey>;
  verifyPasskey: (passkey: AppPasskey) => Promise<number>;
  derivePin?: typeof hashPin;
  now?: () => number;
  withStorageLock?: <T>(action: () => Promise<T>) => Promise<T>;
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
      const run = async () => {
        checkRevision(revision);
        // Read under the shared browser lock so another tab's consumed recovery
        // code or changed credentials can never be accepted from stale memory.
        let raw: string | null;
        let config: LockConfig;
        try {
          raw = await deps.read();
          config =
            raw === null
              ? emptyLockConfig()
              : lockConfigSchema.parse(JSON.parse(raw));
        } catch {
          const error =
            "App protection could not be loaded. Your app remains locked. Retry loading.";
          state.setState({ ready: false, unlocked: false, error });
          throw new Error(error);
        }
        checkRevision(revision);
        if (raw === null && hasAppLock(state.getState().config))
          throw new Error(
            "App protection changed on this device. Reload Subloom before continuing.",
          );
        if (JSON.stringify(config) !== JSON.stringify(state.getState().config))
          state.setState({ config, unlocked: false });
        return action(revision);
      };
      return await (deps.withStorageLock ? deps.withStorageLock(run) : run());
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
        throw new Error(pinBlockedMessage(Boolean(config.passkey)));
      const matches =
        pinPattern.test(proof.pin) &&
        equalHash(await derive(proof.pin, config.pin.salt), config.pin.hash);
      checkRevision(revision);
      if (!matches) {
        config = failedPin(config, now());
        await save(config, revision);
        throw new Error(
          config.retryAt > now()
            ? pinBlockedMessage(Boolean(config.passkey))
            : `That PIN isn’t right. ${PIN_ATTEMPT_LIMIT - config.failures} ${config.failures === 2 ? "attempt" : "attempts"} left.`,
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
  async function newRecovery(config: LockConfig) {
    const code = formatRecoveryCode(
      await (deps.randomRecoveryCode ?? deps.randomSalt)(),
    );
    return {
      code,
      config: {
        ...config,
        recoveryHash: recoveryCodeHash(code),
        recoveryFailures: 0,
        recoveryRetryAt: 0,
      },
    };
  }
  async function prepareRecovery(config: LockConfig) {
    if (!hasAppLock(config))
      return {
        code: null,
        config: {
          ...config,
          recoveryHash: null,
          recoveryFailures: 0,
          recoveryRetryAt: 0,
        },
      };
    if (config.recoveryHash) return { code: null, config };
    return newRecovery(config);
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
        const recovery = await prepareRecovery({ ...config, pin: nextPin });
        checkRevision(revision);
        requireUnlocked();
        await save(recovery.config, revision);
        // Enabling the first method must not unlock an app backgrounded during the write.
        if (revision !== epoch && nextPin) state.setState({ unlocked: false });
        return recovery.code;
      });
    },
    async setPasskey(enabled: boolean, proof?: LockProof) {
      return exclusive(async (revision) => {
        requireUnlocked();
        const config = await verify(proof, revision);
        const passkey = enabled ? await deps.createPasskey() : null;
        checkRevision(revision);
        requireUnlocked();
        const recovery = await prepareRecovery({ ...config, passkey });
        checkRevision(revision);
        requireUnlocked();
        await save(recovery.config, revision);
        if (revision !== epoch && passkey) state.setState({ unlocked: false });
        return recovery.code;
      });
    },
    async replaceRecoveryCode(proof: LockProof) {
      return exclusive(async (revision) => {
        requireUnlocked();
        if (!hasAppLock(state.getState().config))
          throw new Error(
            "Enable app protection before creating a recovery code.",
          );
        const verified = await verify(proof, revision);
        const recovery = await newRecovery(verified);
        checkRevision(revision);
        requireUnlocked();
        await save(recovery.config, revision);
        return recovery.code;
      });
    },
    async recover(code: string, newPin: string) {
      return exclusive(async (revision) => {
        let config = state.getState().config;
        if (!hasAppLock(config) || !config.recoveryHash)
          throw new Error(
            "A recovery code wasn’t set up on this device. Try your other unlock method.",
          );
        if (!pinPattern.test(newPin))
          throw new Error("Choose a new 6-digit PIN.");
        if (config.recoveryRetryAt > now())
          throw new Error(
            "Recovery is temporarily paused. Try again in 10 minutes.",
          );
        const hash = recoveryCodeHash(code);
        if (!hash || !equalHash(hash, config.recoveryHash)) {
          const failures =
            config.recoveryRetryAt > 0 && now() >= config.recoveryRetryAt
              ? 1
              : Math.min(config.recoveryFailures + 1, PIN_ATTEMPT_LIMIT);
          config = {
            ...config,
            recoveryFailures: failures,
            recoveryRetryAt:
              failures >= PIN_ATTEMPT_LIMIT ? now() + PIN_BLOCK_MS : 0,
          };
          checkRevision(revision);
          await save(config, revision);
          throw new Error(
            failures >= PIN_ATTEMPT_LIMIT
              ? "3 recovery attempts wrong. Try again in 10 minutes."
              : "That recovery code isn’t right. Check your saved copy.",
          );
        }
        const salt = await deps.randomSalt();
        const pin: NonNullable<LockConfig["pin"]> = {
          salt,
          hash: await derive(newPin, salt),
          iterations: PIN_ITERATIONS,
        };
        const recovery = await newRecovery({
          ...config,
          pin,
          passkey: null,
          failures: 0,
          retryAt: 0,
        });
        checkRevision(revision);
        // Consume the old recovery code, revoke the old passkey and commit the new
        // PIN together. Recovery never mounts protected screens or signs in.
        await save(recovery.config, revision);
        state.setState({ unlocked: false });
        return recovery.code;
      });
    },
  };
  return controller;
}
