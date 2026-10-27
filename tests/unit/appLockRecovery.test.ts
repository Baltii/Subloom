import { expect, it, vi } from "vitest";
import {
  emptyLockConfig,
  PIN_ITERATIONS,
  PIN_BLOCK_MS,
  recoveryCodeHash,
  type LockConfig,
} from "../../src/domain/appLock";
import { createLockController } from "../../src/domain/appLockController";

const backup = "ABCD-1234-ABCD-1234-ABCD-1234-ABCD-1234";
const pin: NonNullable<LockConfig["pin"]> = {
  salt: "a1".repeat(16),
  hash: "b2".repeat(32),
  iterations: PIN_ITERATIONS,
};
const passkey = {
  id: "credential",
  publicKey: "public",
  rpId: "subloom.test",
  origin: "https://subloom.test",
  counter: 0,
};
function protectedConfig(): LockConfig {
  return {
    ...emptyLockConfig(),
    pin,
    passkey,
    recoveryHash: recoveryCodeHash(backup),
  };
}
function fixture(initial: LockConfig = protectedConfig()) {
  let stored = JSON.stringify(initial),
    sequence = 1,
    now = 1_000_000;
  let queue = Promise.resolve();
  const withStorageLock = <T>(action: () => Promise<T>) => {
    const next = queue.then(action);
    queue = next.then(
      () => {},
      () => {},
    );
    return next;
  };
  const deps = {
    read: vi.fn(async () => stored),
    write: vi.fn(async (value: string) => {
      stored = value;
    }),
    randomSalt: vi.fn(async () => "c3".repeat(16)),
    randomRecoveryCode: vi.fn(async () =>
      (sequence++).toString(16).padStart(32, "0"),
    ),
    derivePin: vi.fn(async (value: string) =>
      value === "123456"
        ? pin.hash
        : value === "654321"
          ? "d4".repeat(32)
          : "e5".repeat(32),
    ),
    createPasskey: vi.fn(async () => passkey),
    verifyPasskey: vi.fn(async () => 1),
    now: () => now,
    withStorageLock,
  };
  return {
    deps,
    controller: createLockController(deps),
    saved: () => JSON.parse(stored) as LockConfig,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

it.each(["pin", "passkey"])(
  "issues a recovery code with first %s setup and stores only its verifier",
  async (method) => {
    const { controller, saved } = fixture(emptyLockConfig());
    await controller.initialize();
    const code =
      method === "pin"
        ? await controller.setPin("123456")
        : await controller.setPasskey(true);
    expect(code).toMatch(/^([A-F0-9]{4}-){7}[A-F0-9]{4}$/);
    expect(saved().recoveryHash).toBe(recoveryCodeHash(code!));
    expect(JSON.stringify(saved())).not.toContain(code!);
    expect(JSON.stringify(saved())).not.toContain(code!.replace(/-/g, ""));
  },
);
it("accepts a saved recovery code, replaces all old unlock secrets, and stays locked", async () => {
  const { controller, saved } = fixture();
  await controller.initialize();
  const next = await controller.recover(
    backup.toLowerCase().replace(/-/g, " "),
    "654321",
  );
  expect(controller.state.getState().unlocked).toBe(false);
  expect(saved()).toMatchObject({
    pin: { hash: "d4".repeat(32) },
    passkey: null,
    recoveryHash: recoveryCodeHash(next),
    failures: 0,
    retryAt: 0,
  });
  await expect(controller.recover(backup, "123456")).rejects.toThrow(
    "code isn’t right",
  );
  await expect(controller.unlock({ passkey: true })).rejects.toThrow(
    "not enabled",
  );
  await expect(controller.unlock({ pin: "123456" })).rejects.toThrow(
    "PIN isn’t right",
  );
  await controller.unlock({ pin: "654321" });
  expect(controller.state.getState().unlocked).toBe(true);
});
it("rejects missing or malformed recovery proof without changing the PIN or passkey", async () => {
  const { controller, saved } = fixture();
  await controller.initialize();
  await expect(
    controller.recover("not a recovery code", "654321"),
  ).rejects.toThrow("code isn’t right");
  expect(saved()).toMatchObject({
    pin,
    passkey,
    recoveryHash: recoveryCodeHash(backup),
  });
  expect(controller.state.getState().unlocked).toBe(false);
});
it("requires an existing unlock method to create or replace a recovery code", async () => {
  const { controller, saved } = fixture();
  await controller.initialize();
  await expect(
    controller.replaceRecoveryCode({ pin: "123456" }),
  ).rejects.toThrow("Unlock");
  await controller.unlock({ pin: "123456" });
  await expect(
    controller.replaceRecoveryCode({ pin: "999999" }),
  ).rejects.toThrow("PIN isn’t right");
  const replacement = await controller.replaceRecoveryCode({ passkey: true });
  expect(saved().recoveryHash).toBe(recoveryCodeHash(replacement));
  controller.lock();
  await expect(controller.recover(backup, "654321")).rejects.toThrow(
    "code isn’t right",
  );
});
it("lets existing installations add recovery after unlocking, without fabricating a fallback", async () => {
  const { controller, saved } = fixture({
    ...protectedConfig(),
    recoveryHash: null,
  });
  await controller.initialize();
  await expect(controller.recover(backup, "654321")).rejects.toThrow(
    "wasn’t set up",
  );
  await controller.unlock({ pin: "123456" });
  const code = await controller.replaceRecoveryCode({ pin: "123456" });
  expect(saved().recoveryHash).toBe(recoveryCodeHash(code));
});
it("persists an independent ten-minute recovery pause after three wrong codes", async () => {
  const { controller, deps, advance } = fixture();
  await controller.initialize();
  for (let i = 0; i < 3; i++)
    await expect(controller.recover("bad code", "654321")).rejects.toThrow();
  const restarted = createLockController(deps);
  await restarted.initialize();
  await expect(restarted.recover(backup, "654321")).rejects.toThrow(
    "temporarily paused",
  );
  // A recovery-code pause must never disable a known PIN or passkey.
  await restarted.unlock({ pin: "123456" });
  restarted.lock();
  advance(PIN_BLOCK_MS);
  await restarted.recover(backup, "654321");
  expect(restarted.state.getState().unlocked).toBe(false);
});
it("can recover during a PIN pause without turning the PIN deadline into a bypass", async () => {
  const { controller } = fixture({
    ...protectedConfig(),
    failures: 3,
    retryAt: 1_600_000,
  });
  await controller.initialize();
  await expect(controller.unlock({ pin: "123456" })).rejects.toThrow(
    "Try another method",
  );
  await controller.recover(backup, "654321");
  expect(controller.state.getState()).toMatchObject({
    unlocked: false,
    config: { retryAt: 0, failures: 0 },
  });
});
it("retains all old credentials if saving a recovery reset fails", async () => {
  const { controller, deps, saved } = fixture();
  await controller.initialize();
  deps.write.mockRejectedValueOnce(new Error("Storage unavailable"));
  await expect(controller.recover(backup, "654321")).rejects.toThrow(
    "Storage unavailable",
  );
  expect(saved()).toMatchObject({
    pin,
    passkey,
    recoveryHash: recoveryCodeHash(backup),
  });
  expect(controller.state.getState().unlocked).toBe(false);
  await controller.recover(backup, "654321");
});
it("rejects a reset result if the app is backgrounded during PIN derivation", async () => {
  const { controller, deps, saved } = fixture();
  await controller.initialize();
  let finish!: (value: string) => void;
  deps.derivePin.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = controller.recover(backup, "654321");
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  controller.lock();
  finish("d4".repeat(32));
  await expect(pending).rejects.toThrow("locked during verification");
  expect(saved().recoveryHash).toBe(recoveryCodeHash(backup));
  expect(controller.state.getState().unlocked).toBe(false);
});
it("consumes the recovery code once even when two browser tabs submit it together", async () => {
  const { controller, deps } = fixture();
  const otherTab = createLockController(deps);
  await Promise.all([controller.initialize(), otherTab.initialize()]);
  const results = await Promise.allSettled([
    controller.recover(backup, "654321"),
    otherTab.recover(backup, "654321"),
  ]);
  expect(results.map((result) => result.status)).toEqual([
    "fulfilled",
    "rejected",
  ]);
  expect(otherTab.state.getState().unlocked).toBe(false);
});
it("revokes recovery when the last security method is disabled", async () => {
  const { controller, saved } = fixture({
    ...protectedConfig(),
    passkey: null,
  });
  await controller.initialize();
  await controller.unlock({ pin: "123456" });
  await controller.setPin(null, { pin: "123456" });
  expect(saved().recoveryHash).toBeNull();
  await expect(controller.recover(backup, "654321")).rejects.toThrow(
    "wasn’t set up",
  );
});
it("keeps the app locked if protection storage becomes unreadable during recovery", async () => {
  const { controller, deps } = fixture();
  await controller.initialize();
  deps.read.mockResolvedValueOnce("malformed record");
  await expect(controller.recover(backup, "654321")).rejects.toThrow(
    "remains locked",
  );
  expect(controller.state.getState()).toMatchObject({
    ready: false,
    unlocked: false,
  });
  expect(deps.write).not.toHaveBeenCalled();
});
it("does not enable protection if a valid recovery code cannot be generated", async () => {
  const { controller, deps } = fixture(emptyLockConfig());
  await controller.initialize();
  deps.randomRecoveryCode.mockRejectedValueOnce(
    new Error("Random source unavailable"),
  );
  await expect(controller.setPin("123456")).rejects.toThrow(
    "Random source unavailable",
  );
  expect(deps.write).not.toHaveBeenCalled();
  expect(controller.state.getState().config.pin).toBeNull();
});
it("invalidates transient lock-screen secrets on backgrounding even when already locked", async () => {
  const { controller } = fixture();
  await controller.initialize();
  const revision = controller.state.getState().lockRevision;
  controller.lock();
  const first = controller.state.getState().lockRevision;
  controller.lock();
  expect(first).toBeGreaterThan(revision);
  expect(controller.state.getState().lockRevision).toBeGreaterThan(first);
  expect(controller.state.getState().unlocked).toBe(false);
});
