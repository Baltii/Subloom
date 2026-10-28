import { pbkdf2Sync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  emptyLockConfig,
  failedPin,
  hashPin,
  lockConfigSchema,
  PIN_ITERATIONS,
  type LockConfig,
} from "../../src/domain/appLock";
import { createLockController } from "../../src/domain/appLockController";

const salt = "a1".repeat(16),
  storedHash = "b2".repeat(32);
const passkey = {
  id: "credential",
  publicKey: "public",
  rpId: "subloom.test",
  origin: "https://subloom.test",
  counter: 0,
};
const protectedConfig = (): LockConfig => ({
  ...emptyLockConfig(),
  pin: { salt, hash: storedHash, iterations: PIN_ITERATIONS },
});
function fixture(initial: LockConfig | null = null) {
  let stored = initial ? JSON.stringify(initial) : null;
  let now = 1_000_000;
  let recoverySequence = 1;
  const deps = {
    read: vi.fn(async () => stored),
    write: vi.fn(async (value: string) => {
      stored = value;
    }),
    randomSalt: vi.fn(async () => salt),
    randomRecoveryCode: vi.fn(async () =>
      String(recoverySequence++).padStart(32, "0"),
    ),
    derivePin: vi.fn(async (pin: string) =>
      pin === "123456" ? storedHash : "c3".repeat(32),
    ),
    createPasskey: vi.fn(async () => passkey),
    verifyPasskey: vi.fn(async () => 1),
    now: () => now,
  };
  return {
    deps,
    controller: createLockController(deps),
    stored: () => stored,
    advance: (ms: number) => {
      now += ms;
    },
  };
}
describe("PIN cryptography", () => {
  // This intentionally runs two full-cost PIN derivations beside the DB tests.
  // Shared CI runners need more than Vitest's default five-second allowance.
  it(
    "matches a standard PBKDF2-SHA256 implementation with a per-install salt",
    { timeout: 30_000 },
    async () => {
      const actual = await hashPin("012345", salt);
      expect(actual).toBe(
        pbkdf2Sync(
          "012345",
          Buffer.from(salt, "hex"),
          PIN_ITERATIONS,
          32,
          "sha256",
        ).toString("hex"),
      );
      expect(actual).not.toContain("012345");
      expect(await hashPin("012345", "a2".repeat(16))).not.toBe(actual);
    },
  );
  it.each(["12345", "1234567", "abcdef", "12 345", "１２３４５６"])(
    "rejects invalid PIN %s",
    async (pin) => {
      await expect(hashPin(pin, salt)).rejects.toThrow("6-digit");
    },
  );
  it("caps retry delays and rejects corrupted or unknown storage formats", () => {
    expect(
      failedPin({ ...protectedConfig(), failures: 99 }, 1000).retryAt,
    ).toBe(601000);
    expect(
      lockConfigSchema.safeParse({ ...protectedConfig(), version: 3 }).success,
    ).toBe(false);
    expect(
      lockConfigSchema.safeParse({
        ...protectedConfig(),
        pin: { salt, hash: "123456", iterations: 1 },
      }).success,
    ).toBe(false);
  });
  it("migrates legacy protection without inventing recovery credentials", () => {
    const legacy = {
      version: 1,
      pin: protectedConfig().pin,
      passkey: null,
      failures: 0,
      retryAt: 0,
    };
    expect(lockConfigSchema.parse(legacy)).toMatchObject({
      version: 2,
      recoveryHash: null,
      recoveryFailures: 0,
      recoveryRetryAt: 0,
    });
  });
});
describe("app protection lifecycle", () => {
  it("starts unprotected only when storage confirms no lock exists", async () => {
    const { controller, deps } = fixture();
    expect(controller.state.getState().unlocked).toBe(false);
    await Promise.all([controller.initialize(), controller.initialize()]);
    expect(deps.read).toHaveBeenCalledTimes(1);
    expect(controller.state.getState()).toMatchObject({
      ready: true,
      unlocked: true,
    });
  });
  it.each(["unreadable", "corrupt"])(
    "fails closed when lock storage is %s",
    async (kind) => {
      const { controller, deps } = fixture();
      if (kind === "unreadable")
        deps.read.mockRejectedValueOnce(new Error("Keychain unavailable"));
      else deps.read.mockResolvedValueOnce("not json");
      await controller.initialize();
      expect(controller.state.getState()).toMatchObject({
        ready: false,
        unlocked: false,
      });
      expect(controller.state.getState().error).toContain("remains locked");
      await controller.initialize();
      expect(controller.state.getState().ready).toBe(true);
    },
  );
  it("enrolls a PIN, starts locked after restart, and verifies before unlocking", async () => {
    const { controller, deps } = fixture();
    await controller.initialize();
    await controller.setPin("123456");
    const saved = JSON.parse(deps.write.mock.calls[0]![0]);
    expect(saved.pin).toEqual({
      salt,
      hash: storedHash,
      iterations: PIN_ITERATIONS,
    });
    expect(JSON.stringify(saved)).not.toContain("123456");
    const restarted = createLockController(deps);
    await restarted.initialize();
    expect(restarted.state.getState().unlocked).toBe(false);
    await expect(restarted.unlock({ pin: "999999" })).rejects.toThrow(
      "PIN isn’t right",
    );
    expect(restarted.state.getState().unlocked).toBe(false);
    await restarted.unlock({ pin: "123456" });
    expect(restarted.state.getState()).toMatchObject({
      unlocked: true,
      config: { failures: 0 },
    });
  });
  it("blocks after three incorrect PINs for ten minutes across restarts, then gives three fresh attempts", async () => {
    const { controller, deps, advance } = fixture(protectedConfig());
    await controller.initialize();
    for (let i = 0; i < 3; i++)
      await expect(controller.unlock({ pin: "999999" })).rejects.toThrow();
    expect(controller.state.getState().config.retryAt).toBe(1_600_000);
    const restarted = createLockController(deps);
    await restarted.initialize();
    deps.derivePin.mockClear();
    await expect(restarted.unlock({ pin: "123456" })).rejects.toThrow(
      "3 attempts wrong. Try again later.",
    );
    expect(deps.derivePin).not.toHaveBeenCalled();
    advance(599_999);
    await expect(restarted.unlock({ pin: "123456" })).rejects.toThrow(
      "3 attempts wrong",
    );
    advance(1);
    await expect(restarted.unlock({ pin: "999999" })).rejects.toThrow(
      "2 attempts left",
    );
    expect(restarted.state.getState().config.failures).toBe(1);
    expect(restarted.state.getState().config.retryAt).toBe(0);
    await restarted.unlock({ pin: "123456" });
    expect(restarted.state.getState().config.failures).toBe(0);
  });
  it("requires verification to disable or replace security settings", async () => {
    const { controller } = fixture(protectedConfig());
    await controller.initialize();
    await expect(controller.setPin(null, { pin: "123456" })).rejects.toThrow(
      "Unlock",
    );
    await controller.unlock({ pin: "123456" });
    await expect(controller.setPin(null)).rejects.toThrow("Verify");
    await expect(
      controller.setPasskey(true, { pin: "999999" }),
    ).rejects.toThrow("PIN isn’t right");
    await controller.setPasskey(true, { pin: "123456" });
    await controller.setPin(null, { passkey: true });
    expect(controller.state.getState().config).toMatchObject({
      pin: null,
      passkey: { ...passkey, counter: 1 },
    });
    controller.lock();
    await controller.unlock({ passkey: true });
    await controller.setPasskey(false, { passkey: true });
    expect(controller.state.getState()).toMatchObject({
      unlocked: true,
      config: { pin: null, passkey: null },
    });
  });
  it("keeps PIN fallback available when passkey verification is canceled", async () => {
    const { controller, deps } = fixture({ ...protectedConfig(), passkey });
    await controller.initialize();
    deps.verifyPasskey.mockRejectedValueOnce(new Error("Canceled"));
    await expect(controller.unlock({ passkey: true })).rejects.toThrow(
      "Canceled",
    );
    expect(controller.state.getState().unlocked).toBe(false);
    await controller.unlock({ pin: "123456" });
    expect(controller.state.getState().unlocked).toBe(true);
  });
  it("replaces a PIN only after reauthentication and stops accepting the old PIN", async () => {
    const { controller, deps } = fixture(protectedConfig());
    await controller.initialize();
    await controller.unlock({ pin: "123456" });
    await controller.setPin("654321", { pin: "123456" });
    const restarted = createLockController(deps);
    await restarted.initialize();
    await expect(restarted.unlock({ pin: "123456" })).rejects.toThrow(
      "PIN isn’t right",
    );
    await restarted.unlock({ pin: "654321" });
    expect(restarted.state.getState().unlocked).toBe(true);
  });
  it("does not commit a canceled passkey enrollment", async () => {
    const { controller, deps } = fixture();
    await controller.initialize();
    deps.createPasskey.mockRejectedValueOnce(new Error("Canceled"));
    await expect(controller.setPasskey(true)).rejects.toThrow("Canceled");
    expect(controller.state.getState().config.passkey).toBeNull();
    expect(deps.write).not.toHaveBeenCalled();
  });
  it("allows passkey recovery during a PIN cooldown", async () => {
    const { controller } = fixture({
      ...protectedConfig(),
      passkey,
      failures: 5,
      retryAt: 2_000_000,
    });
    await controller.initialize();
    await controller.unlock({ passkey: true });
    expect(controller.state.getState()).toMatchObject({
      unlocked: true,
      config: { failures: 0, retryAt: 0 },
    });
  });
  it("does not unlock if persistence fails after a correct verification", async () => {
    const { controller, deps } = fixture(protectedConfig());
    await controller.initialize();
    deps.write.mockRejectedValueOnce(new Error("Disk unavailable"));
    await expect(controller.unlock({ pin: "123456" })).rejects.toThrow(
      "Disk unavailable",
    );
    expect(controller.state.getState().unlocked).toBe(false);
    expect(controller.state.getState().busy).toBe(false);
  });
  it("cancels an in-flight unlock if the app goes into the background", async () => {
    const { controller, deps } = fixture(protectedConfig());
    await controller.initialize();
    let finish!: (value: string) => void;
    deps.derivePin.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = controller.unlock({ pin: "123456" });
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    controller.lock();
    finish(storedHash);
    await expect(pending).rejects.toThrow("locked during");
    expect(controller.state.getState().unlocked).toBe(false);
  });
  it("blocks overlapping requests and keeps a new lock closed if backgrounded during storage", async () => {
    const { controller, deps } = fixture();
    await controller.initialize();
    let finish!: () => void;
    deps.write.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = controller.setPin("123456");
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    await expect(controller.setPin("999999")).rejects.toThrow("busy");
    controller.lock();
    finish();
    await pending;
    expect(controller.state.getState()).toMatchObject({
      unlocked: false,
      config: { pin: { hash: storedHash } },
    });
  });
});
