import { afterEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, sign, createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { newerVersion, validateRelease } from "../../updates/protocol.cjs";
import {
  fetchReleaseManifest,
  verifyReleaseManifest,
} from "../../src/services/releaseManifest";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const require = createRequire(import.meta.url);
const { verifyRelease, verifyAsset } = require("../../updates/node.cjs");
const keys = generateKeyPairSync("ed25519");
const publicHex = Buffer.from(
  keys.publicKey.export({ format: "jwk" }).x!,
  "base64url",
).toString("hex");
function release() {
  return {
    schema: 1,
    version: "1.6.0",
    commit: "a".repeat(40),
    publishedAt: "2026-10-24T00:00:00Z",
    assets: ["windows-x64", "macos-arm64", "macos-x64", "android-test"].map(
      (platform) => {
        const name = `Subloom-1.6.0-${platform}${platform === "windows-x64" ? ".exe" : platform === "android-test" ? ".apk" : ".zip"}`;
        return {
          platform,
          name,
          url: `https://github.com/Baltii/Subloom/releases/download/v1.6.0/${name}`,
          size: 42,
          sha256: "b".repeat(64),
          signature: "c".repeat(128),
        };
      },
    ),
  };
}
function envelope(data = release()) {
  const payload = JSON.stringify(data);
  return JSON.stringify({
    payload,
    signature: sign(null, Buffer.from(payload), keys.privateKey).toString(
      "hex",
    ),
  });
}
describe("signed app updates", () => {
  it("handles a pre-updater release on React Native without AbortSignal.timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("AbortSignal", {});
    const fetch = vi.fn().mockResolvedValue({ status: 404 });
    vi.stubGlobal("fetch", fetch);
    expect(await fetchReleaseManifest()).toBeNull();
    expect(fetch).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("accepts a complete signed release and rejects tampering or another signer", () => {
    expect(verifyRelease(envelope(), publicHex).version).toBe("1.6.0");
    expect(verifyReleaseManifest(envelope(), publicHex).version).toBe("1.6.0");
    expect(() =>
      verifyReleaseManifest(envelope().replace("1.6.0", "9.0.0"), publicHex),
    ).toThrow(/verified/);
    expect(() =>
      verifyRelease(envelope().replace("1.6.0", "9.0.0"), publicHex),
    ).toThrow(/signed/);
    expect(() => verifyRelease(envelope(), "00".repeat(32))).toThrow(/signed/);
    expect(() => verifyRelease("x".repeat(65537), publicHex)).toThrow(/large/);
  });
  it("rejects incomplete releases, duplicate platforms, foreign URLs and mismatched versions", () => {
    for (const mutate of [
      (r: ReturnType<typeof release>) => r.assets.pop(),
      (r: ReturnType<typeof release>) =>
        (r.assets[1]!.platform = r.assets[0]!.platform),
      (r: ReturnType<typeof release>) =>
        (r.assets[0]!.url = "https://evil.example/update.exe"),
      (r: ReturnType<typeof release>) => (r.version = "1.7.0"),
      (r: ReturnType<typeof release>) => (r.assets[0]!.size = Infinity),
    ]) {
      const data = release();
      mutate(data);
      expect(() => validateRelease(data)).toThrow();
    }
  });
  it("only accepts newer stable versions", () => {
    expect(newerVersion("1.10.0", "1.9.9")).toBe(true);
    for (const candidate of [
      "1.5.1",
      "1.0.0",
      "1.6.0-beta.1",
      "v1.6.0",
      "01.6.0",
    ])
      expect(newerVersion(candidate, "1.5.1")).toBe(false);
  });
  it("verifies artifact length, hash and signature before installation", () => {
    const directory = mkdtempSync(join(tmpdir(), "subloom-updater-"));
    try {
      const bytes = Buffer.from("a verified Subloom artifact"),
        file = join(directory, "update.exe");
      writeFileSync(file, bytes);
      const asset = {
        size: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        signature: sign(null, bytes, keys.privateKey).toString("hex"),
      };
      expect(() => verifyAsset(file, asset, publicHex)).not.toThrow();
      expect(() =>
        verifyAsset(file, { ...asset, signature: "00".repeat(64) }, publicHex),
      ).toThrow(/verified/);
      writeFileSync(file, "broken");
      expect(() => verifyAsset(file, asset, publicHex)).toThrow(/incomplete/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
