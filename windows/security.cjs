const fs = require("node:fs");

function createSecurityStore(file, safeStorage) {
  function requireEncryption() {
    if (!safeStorage.isEncryptionAvailable())
      throw new Error(
        "Secure Windows storage is unavailable. Unlock your Windows account and retry.",
      );
  }
  return {
    read() {
      if (!fs.existsSync(file)) return null;
      requireEncryption();
      return safeStorage.decryptString(fs.readFileSync(file));
    },
    write(value) {
      requireEncryption();
      if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > 8192)
        throw new Error("Invalid app protection settings.");
      // Keep the previous config intact on a failed write or encryption error.
      const encrypted = safeStorage.encryptString(value);
      const temporary = file + ".tmp";
      fs.writeFileSync(temporary, encrypted, { mode: 0o600 });
      fs.renameSync(temporary, file);
    },
  };
}
module.exports = { createSecurityStore };
