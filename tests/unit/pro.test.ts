import { describe, expect, it } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  canAddBillingMethod,
  canAddSubscriptions,
  OFFLINE_PRO_MS,
  verifyProLicense,
} from "../../src/domain/pro";
import { emptyPro, requirePro, usePro } from "../../src/store/pro";

const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const device = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const now = Date.parse("2026-10-23T17:00:00Z");
const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = keys.publicKey.export({ format: "jwk" });
const publicHex =
  "04" +
  Buffer.from(jwk.x!, "base64url").toString("hex") +
  Buffer.from(jwk.y!, "base64url").toString("hex");
function license(changes: object = {}) {
  const payload = JSON.stringify({
    v: 1,
    owner,
    device,
    iat: now,
    exp: now + OFFLINE_PRO_MS,
    ...changes,
  });
  return {
    payload,
    signature: sign("sha256", Buffer.from(payload), {
      key: keys.privateKey,
      dsaEncoding: "ieee-p1363",
    }).toString("hex"),
  };
}
describe("signed local Pro access", () => {
  it("accepts real P-256 signatures including the server's compact signature format", () => {
    expect(
      verifyProLicense(license(), publicHex, owner, device, now)?.exp,
    ).toBe(now + OFFLINE_PRO_MS);
    expect(
      verifyProLicense(
        license({ exp: now + 3600_000 }),
        publicHex,
        owner,
        device,
        now,
      )?.exp,
    ).toBe(now + 3600_000);
  });
  it("rejects tampering, wrong owner/device/key, expiry, excessive duration and clock rollback", () => {
    const valid = license();
    for (const altered of [
      { ...valid, payload: valid.payload.replace(owner, device) },
      { ...valid, signature: "00".repeat(64) },
      license({ exp: now }),
      license({ exp: now + OFFLINE_PRO_MS + 1 }),
      license({ iat: now + 120_000 }),
      license({ v: 2 }),
    ])
      expect(
        verifyProLicense(altered, publicHex, owner, device, now),
      ).toBeNull();
    expect(verifyProLicense(valid, publicHex, device, device, now)).toBeNull();
    expect(verifyProLicense(valid, publicHex, owner, owner, now)).toBeNull();
    expect(
      verifyProLicense(valid, "04" + "00".repeat(64), owner, device, now),
    ).toBeNull();
    expect(
      verifyProLicense(valid, publicHex, owner, device, now + OFFLINE_PRO_MS),
    ).toBeNull();
    expect(
      verifyProLicense(valid, publicHex, owner, device, now, now + 120_000),
    ).toBeNull();
  });
  it("checks workspace and expiry at the action boundary even if timers are suspended", () => {
    usePro.setState({
      ...emptyPro,
      workspace: "guest",
      owner,
      ready: true,
      offlineUntil: Date.now() + 60000,
    });
    expect(() => requirePro("guest")).not.toThrow();
    expect(() => requirePro(owner)).toThrow(/Pro/);
    usePro.setState({ ready: false });
    expect(() => requirePro("guest")).toThrow(/Pro/);
    usePro.setState({ ready: true, owner: null });
    expect(() => requirePro("guest")).toThrow(/Pro/);
    usePro.setState({ owner });
    usePro.setState({ offlineUntil: Date.now() - 1 });
    expect(() => requirePro("guest")).toThrow(/Pro/);
    usePro.setState(emptyPro);
  });
});
describe("free plan capacity", () => {
  const card = (id: string) => ({ id, kind: "card" as const });
  const wallet = (id: string) => ({ id, kind: "wallet" as const });
  it("allows one card and one wallet, but not two of either type", () => {
    expect(canAddBillingMethod([], [card("a"), wallet("b")], false)).toBe(true);
    expect(canAddBillingMethod([], [card("a"), card("b")], false)).toBe(false);
    expect(canAddBillingMethod([], [wallet("a"), wallet("b")], false)).toBe(
      false,
    );
    expect(canAddBillingMethod([], [{ id: "bank", kind: "bank" }], false)).toBe(
      false,
    );
  });
  it("keeps existing methods editable/removable after downgrade without allowing replacements or kind changes above capacity", () => {
    const saved = [card("a"), card("b"), wallet("c"), wallet("d")];
    expect(canAddBillingMethod(saved, saved, false)).toBe(true);
    expect(canAddBillingMethod(saved, saved.slice(0, 3), false)).toBe(true);
    expect(canAddBillingMethod(saved, [card("a"), card("new")], false)).toBe(
      false,
    );
    expect(canAddBillingMethod(saved, [card("a"), card("c")], false)).toBe(
      false,
    );
    expect(
      canAddBillingMethod(
        [card("a"), card("b")],
        [card("a"), card("b"), wallet("new")],
        false,
      ),
    ).toBe(true);
  });
  it("allows up to 50 Pro methods", () => {
    expect(
      canAddBillingMethod(
        [],
        Array.from({ length: 50 }, (_, i) => card(String(i))),
        true,
      ),
    ).toBe(true);
    expect(
      canAddBillingMethod(
        [],
        Array.from({ length: 51 }, (_, i) => card(String(i))),
        true,
      ),
    ).toBe(false);
  });
  it("caps free subscriptions at ten, preserves existing records and lifts the cap with Pro", () => {
    const ten = Array.from({ length: 10 }, (_, i) => String(i));
    expect(canAddSubscriptions([], ten, false)).toBe(true);
    expect(canAddSubscriptions(ten, [...ten, "new"], false)).toBe(false);
    expect(canAddSubscriptions(ten, [...ten, "new"], true)).toBe(true);
    expect(canAddSubscriptions([...ten, "old"], [...ten, "old"], false)).toBe(
      true,
    );
    expect(canAddSubscriptions([...ten, "old"], [...ten, "new"], false)).toBe(
      false,
    );
  });
});
