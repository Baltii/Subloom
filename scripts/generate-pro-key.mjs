import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Never print the private key or place it in public Expo configuration.
const directory = resolve(process.argv[2] || "build/pro-keys");
mkdirSync(directory, { recursive: true, mode: 0o700 });
const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const privateJwk = pair.privateKey.export({ format: "jwk" });
const publicJwk = pair.publicKey.export({ format: "jwk" });
const publicHex = "04" + Buffer.from(publicJwk.x, "base64url").toString("hex") + Buffer.from(publicJwk.y, "base64url").toString("hex");
writeFileSync(resolve(directory, "server.env"), "PRO_LICENSE_PRIVATE_JWK=" + JSON.stringify(privateJwk) + "\n", { mode: 0o600, flag: "wx" });
writeFileSync(resolve(directory, "public.env"), "EXPO_PUBLIC_PRO_LICENSE_PUBLIC_KEY=" + publicHex + "\n", { mode: 0o600, flag: "wx" });
console.log("Created separate server.env and public.env files in " + directory + ". Keep server.env private and back it up securely. Existing files are never overwritten.");
