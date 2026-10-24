import { createHash, createPublicKey } from "node:crypto";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { privateKey, sign, verifyRelease } = require("../updates/node.cjs");
const {
  PLATFORMS,
  REPOSITORY,
  VERSION,
  validateRelease,
} = require("../updates/protocol.cjs");
const trust = require("../updates/trust.json");
export function prepareRelease({
  version,
  commit,
  directory,
  seed,
  publishedAt = new Date().toISOString(),
}) {
  if (!VERSION.test(version) || !/^[a-f0-9]{40}$/.test(commit))
    throw new Error("Use the exact stable release version and commit.");
  const key = privateKey(seed);
  const publicHex = Buffer.from(
    createPublicKey(key).export({ format: "jwk" }).x,
    "base64url",
  ).toString("hex");
  if (publicHex !== trust.publicKey)
    throw new Error(
      "The release signing key does not match the key shipped in the app.",
    );
  const all = readdirSync(directory, { recursive: true }).map((p) =>
    resolve(directory, p),
  );
  const assets = PLATFORMS.map((platform) => {
    const extension =
      platform === "windows-x64"
        ? ".exe"
        : platform === "android-test"
          ? ".apk"
          : ".zip";
    const candidates = all.filter(
      (p) =>
        basename(p).startsWith(`Subloom-${version}-`) &&
        basename(p).includes(
          platform === "android-test" ? "android-test" : platform,
        ) &&
        p.endsWith(extension),
    );
    if (candidates.length !== 1)
      throw new Error(`Expected exactly one verified ${platform} artifact.`);
    const file = candidates[0],
      bytes = readFileSync(file);
    return {
      platform,
      name: basename(file),
      url: `https://github.com/${REPOSITORY}/releases/download/v${version}/${basename(file)}`,
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      signature: sign(null, bytes, key).toString("hex"),
    };
  });
  const release = validateRelease({
    schema: 1,
    version,
    commit,
    publishedAt,
    assets,
  });
  const payload = JSON.stringify(release);
  const envelope = JSON.stringify({
    payload,
    signature: sign(null, Buffer.from(payload), key).toString("hex"),
  });
  verifyRelease(envelope, trust.publicKey);
  return { release, envelope };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(import.meta.filename)
) {
  const version = process.env.RELEASE_TAG?.replace(/^v/, "");
  const { release, envelope } = prepareRelease({
    version,
    commit: process.env.RELEASE_SHA,
    directory: "artifacts",
    seed: process.env.SUBLOOM_UPDATE_SIGNING_SEED || "",
  });
  mkdirSync("artifacts/updates", { recursive: true });
  writeFileSync("artifacts/updates/subloom-updates.json", envelope + "\n");
  for (const platform of ["macos-arm64", "macos-x64"]) {
    const asset = release.assets.find((a) => a.platform === platform);
    const signature = Buffer.from(asset.signature, "hex").toString("base64");
    // Separate feeds prevent an Intel app receiving an Apple silicon update.
    const xml = `<?xml version="1.0" encoding="utf-8"?><rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle"><channel><title>Subloom</title><item><title>Subloom ${release.version}</title><pubDate>${new Date(release.publishedAt).toUTCString()}</pubDate><sparkle:version>${release.version}</sparkle:version><sparkle:shortVersionString>${release.version}</sparkle:shortVersionString><sparkle:minimumSystemVersion>14.0</sparkle:minimumSystemVersion><enclosure url="${asset.url}" length="${asset.size}" type="application/octet-stream" sparkle:edSignature="${signature}" /></item></channel></rss>`;
    writeFileSync(`artifacts/updates/subloom-${platform}.xml`, xml + "\n");
  }
  console.log(
    `Prepared signed update metadata for Subloom ${release.version}; no private key material written to artifacts.`,
  );
}
