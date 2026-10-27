const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createSecurityStore } = require("./security.cjs");

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "subloom-security-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "app-protection.bin");
  const safeStorage = {
    isEncryptionAvailable: () => true,
    // Stand-in for Electron's Windows DPAPI transport; never real credentials.
    encryptString: (text) =>
      Buffer.from("encrypted:" + Buffer.from(text).toString("base64")),
    decryptString: (data) => {
      if (!data.toString().startsWith("encrypted:"))
        throw new Error("Invalid encrypted data");
      return Buffer.from(data.toString().slice(10), "base64").toString();
    },
  };
  return { file, safeStorage, store: createSecurityStore(file, safeStorage) };
}
test("app protection survives restarts and writes only encrypted configuration", (t) => {
  const { file, safeStorage, store } = fixture(t);
  assert.equal(store.read(), null);
  const value = JSON.stringify({
    pin: { hash: "test-hash", salt: "test-salt" },
  });
  store.write(value);
  assert(!fs.readFileSync(file, "utf8").includes("test-hash"));
  assert.equal(createSecurityStore(file, safeStorage).read(), value);
  store.write("updated");
  assert.equal(store.read(), "updated");
  assert(!fs.existsSync(file + ".tmp"));
});
test("unavailable Windows encryption fails closed without overwriting protection", (t) => {
  const { file, safeStorage, store } = fixture(t);
  store.write("previous");
  const previous = fs.readFileSync(file);
  safeStorage.isEncryptionAvailable = () => false;
  assert.throws(() => store.read(), /unavailable/);
  assert.throws(() => store.write("new"), /unavailable/);
  assert.deepEqual(fs.readFileSync(file), previous);
});
test("invalid writes and encryption failures preserve the last working lock", (t) => {
  const { safeStorage, store } = fixture(t);
  store.write("previous");
  for (const value of [null, {}, "x".repeat(8193)])
    assert.throws(() => store.write(value), /Invalid/);
  safeStorage.encryptString = () => {
    throw new Error("Encryption failed");
  };
  assert.throws(() => store.write("new"), /Encryption failed/);
  assert.equal(store.read(), "previous");
});
test("corrupt persisted protection raises an error instead of returning an empty lock", (t) => {
  const { file, store } = fixture(t);
  fs.writeFileSync(file, "corrupted");
  assert.throws(() => store.read(), /Invalid encrypted data/);
});
