const {
  createPublicKey,
  createPrivateKey,
  createHash,
  verify,
  sign,
} = require("node:crypto");
const { readFileSync, statSync } = require("node:fs");
const { parseEnvelope, validateRelease } = require("./protocol.cjs");
function publicKey(raw) {
  if (!/^[a-f0-9]{64}$/.test(raw))
    throw new Error("Update verification is not configured.");
  return createPublicKey({
    key: Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      Buffer.from(raw, "hex"),
    ]),
    type: "spki",
    format: "der",
  });
}
function privateKey(seed) {
  const raw = Buffer.from(seed.trim(), "base64");
  if (raw.length !== 32) throw new Error("The update signing seed is invalid.");
  return createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      raw,
    ]),
    type: "pkcs8",
    format: "der",
  });
}
function verifyRelease(text, key) {
  const envelope = parseEnvelope(text);
  if (
    !verify(
      null,
      Buffer.from(envelope.payload),
      publicKey(key),
      Buffer.from(envelope.signature, "hex"),
    )
  )
    throw new Error(
      "This update was not signed by Subloom. It has been rejected.",
    );
  return validateRelease(JSON.parse(envelope.payload));
}
function verifyAsset(file, asset, key) {
  if (statSync(file).size !== asset.size)
    throw new Error("The update download is incomplete. Download it again.");
  const bytes = readFileSync(file);
  if (
    createHash("sha256").update(bytes).digest("hex") !== asset.sha256 ||
    !verify(null, bytes, publicKey(key), Buffer.from(asset.signature, "hex"))
  )
    throw new Error(
      "The update download could not be verified. It has not been installed.",
    );
}
module.exports = { publicKey, privateKey, verifyRelease, verifyAsset, sign };
