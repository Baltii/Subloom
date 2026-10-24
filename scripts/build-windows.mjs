import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
if (process.platform !== "win32")
  throw new Error(
    "Build the Windows installer on Windows, or use GitHub Actions.",
  );
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
if (!/^\d+\.\d+\.\d+$/.test(version))
  throw new Error("A stable semantic version is required.");
const run = (file, args) => execFileSync(file, args, { stdio: "inherit" });
run(process.execPath, [
  "scripts/expo.mjs",
  "export",
  "--platform",
  "web",
  "--output-dir",
  "build/windows-web",
]);
const stage = resolve("build/windows-app"),
  output = resolve("build/windows");
rmSync(stage, { recursive: true, force: true });
rmSync(output, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
for (const file of [
  "main.cjs",
  "preload.cjs",
  "runtime.cjs",
  "notifications.cjs",
  "updates.cjs",
])
  cpSync(`windows/${file}`, `${stage}/${file}`);
cpSync("updates", `${stage}/updates`, { recursive: true });
cpSync("windows/package-lock.json", `${stage}/package-lock.json`);
cpSync("assets/icon.png", `${stage}/icon.png`);
cpSync("build/windows-web", `${stage}/web`, { recursive: true });
writeFileSync(
  `${stage}/package.json`,
  JSON.stringify(
    {
      name: "subloom-windows",
      version,
      private: true,
      main: "main.cjs",
      description: "A calmer place for your subscriptions.",
      author: "Subloom",
      dependencies: JSON.parse(readFileSync("windows/package.json", "utf8"))
        .dependencies,
    },
    null,
    2,
  ) + "\n",
);
if (!process.env.npm_execpath)
  throw new Error("Run the Windows build through npm run build:windows.");
run(process.execPath, [
  process.env.npm_execpath,
  "ci",
  "--prefix",
  stage,
  "--omit=dev",
  "--ignore-scripts",
  "--no-audit",
  "--no-fund",
]);
run(process.execPath, [
  "windows/node_modules/electron-builder/cli.js",
  "--projectDir",
  stage,
  "--config",
  resolve("windows/electron-builder.cjs"),
  "--win",
  "--x64",
  "--publish",
  "never",
]);
const installers = readdirSync(output).filter((file) => file.endsWith(".exe"));
if (installers.length !== 1) throw new Error("Expected one Windows installer.");
for (const file of installers) {
  const hash = createHash("sha256")
    .update(readFileSync(`${output}/${file}`))
    .digest("hex");
  writeFileSync(`${output}/${file}.sha256`, `${hash}  ${file}\n`);
}
console.log(`Windows installer and checksum: ${output}`);
