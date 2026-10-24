const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { generateKeyPairSync, createHash, sign } = require("node:crypto");
const { mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { createUpdateBroker } = require("./updates.cjs");
const keys = generateKeyPairSync("ed25519");
const publicKey = Buffer.from(
  keys.publicKey.export({ format: "jwk" }).x,
  "base64url",
).toString("hex");
function fixture(t, changes = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), "subloom-update-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "installer.exe"),
    bytes = Buffer.from("verified installer fixture");
  writeFileSync(file, bytes);
  const assets = [
    "windows-x64",
    "macos-arm64",
    "macos-x64",
    "android-test",
  ].map((platform) => {
    const name = `Subloom-2.0.0-${platform}${platform === "windows-x64" ? ".exe" : platform === "android-test" ? ".apk" : ".zip"}`;
    return {
      platform,
      name,
      url: `https://github.com/Baltii/Subloom/releases/download/v2.0.0/${name}`,
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      signature: sign(null, bytes, keys.privateKey).toString("hex"),
    };
  });
  const payload = JSON.stringify({
    schema: 1,
    version: "2.0.0",
    commit: "a".repeat(40),
    publishedAt: "2026-10-24T00:00:00Z",
    assets,
  });
  const updater = new EventEmitter();
  let installed = 0,
    downloads = 0;
  updater.setFeedURL = () => {};
  updater.checkForUpdates = async () => ({
    updateInfo: { version: "2.0.0", files: [{ url: assets[0].name }] },
  });
  updater.downloadUpdate = async () => {
    downloads++;
    return [file];
  };
  updater.quitAndInstall = () => {
    installed++;
  };
  const broker = createUpdateBroker({
    updater,
    version: "1.0.0",
    verificationKey: publicKey,
    fetch: async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () =>
        JSON.stringify({
          payload,
          signature: sign(null, Buffer.from(payload), keys.privateKey).toString(
            "hex",
          ),
        }),
    }),
    ...changes,
  });
  return {
    broker,
    updater,
    file,
    installed: () => installed,
    downloads: () => downloads,
  };
}
test("downloads verified updates and only installs after an explicit request", async (t) => {
  const f = fixture(t);
  await f.broker.check();
  assert.equal(f.broker.status().status, "ready");
  assert.equal(f.installed(), 0);
  assert.equal(f.updater.autoInstallOnAppQuit, false);
  f.broker.install();
  assert.equal(f.installed(), 1);
});
test("rejects a modified cached installer at restart", async (t) => {
  const f = fixture(t);
  await f.broker.check();
  writeFileSync(f.file, "changed");
  assert.throws(() => f.broker.install(), /incomplete|verified/);
  assert.equal(f.installed(), 0);
});
test("network failure is recoverable without installing or downloading", async (t) => {
  const f = fixture(t, {
    fetch: async () => {
      throw Error("Offline");
    },
  });
  await f.broker.check();
  assert.equal(f.broker.status().status, "error");
  assert.equal(f.installed(), 0);
  assert.equal(f.downloads(), 0);
});
test("legacy releases without a signed feed are not offered", async (t) => {
  const f = fixture(t, { fetch: async () => ({ status: 404 }) });
  await f.broker.check();
  assert.equal(f.broker.status().status, "current");
  assert.equal(f.downloads(), 0);
});
test("refuses metadata which differs from the signed release", async (t) => {
  const f = fixture(t);
  f.updater.checkForUpdates = async () => ({
    updateInfo: { version: "3.0.0", files: [] },
  });
  await f.broker.check();
  assert.equal(f.broker.status().status, "error");
  assert.equal(f.downloads(), 0);
});
test("does not install while an editor has unsaved changes", async (t) => {
  const f = fixture(t, { canInstall: () => false });
  await f.broker.check();
  assert.throws(() => f.broker.install(), /changes/);
  assert.equal(f.installed(), 0);
});
