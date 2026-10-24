import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import trust from "../updates/trust.json" with { type: "json" };
export async function prepareSparkle() {
  const directory = resolve(
    `build/dependencies/Sparkle-${trust.sparkleVersion}`,
  );
  const archive = directory + ".tar.xz";
  mkdirSync(resolve("build/dependencies"), { recursive: true });
  if (!existsSync(archive)) {
    const response = await fetch(
      `https://github.com/sparkle-project/Sparkle/releases/download/${trust.sparkleVersion}/Sparkle-${trust.sparkleVersion}.tar.xz`,
      { signal: AbortSignal.timeout(120000) },
    );
    if (
      !response.ok ||
      Number(response.headers.get("content-length") || 0) > 100000000
    )
      throw new Error("Could not download the pinned Sparkle framework.");
    writeFileSync(archive, new Uint8Array(await response.arrayBuffer()));
  }
  if (
    createHash("sha256").update(readFileSync(archive)).digest("hex") !==
    trust.sparkleSha256
  ) {
    rmSync(archive);
    throw new Error(
      "Sparkle framework checksum did not match. No framework was installed.",
    );
  }
  if (!existsSync(directory + "/Sparkle.framework")) {
    mkdirSync(directory, { recursive: true });
    execFileSync("tar", ["-xf", archive, "-C", directory]);
  }
  return directory;
}
