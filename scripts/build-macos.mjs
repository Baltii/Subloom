import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
const env = {
  ...process.env,
  DEVELOPER_DIR:
    process.env.DEVELOPER_DIR || "/Applications/Xcode.app/Contents/Developer",
};
const run = (command, args) =>
  execFileSync(command, args, { env, stdio: "inherit" });
if (process.argv.slice(2).some((arg) => arg !== "--update"))
  throw new Error(
    "Supported option: --update builds a separate replacement app.",
  );
if (process.platform !== "darwin")
  throw new Error("The Mac test app requires macOS and Xcode.");
if (!existsSync(env.DEVELOPER_DIR))
  throw new Error("Open Xcode and complete its setup first.");
run("npx", [
  "expo",
  "export",
  "--platform",
  "web",
  "--output-dir",
  "build/macos-web",
]);
const app = resolve(
  process.argv.includes("--update")
    ? "build/Subloom-update.app"
    : "build/Subloom.app",
);
rmSync(app, { recursive: true, force: true });
mkdirSync(app + "/Contents/MacOS", { recursive: true });
mkdirSync(app + "/Contents/Resources", { recursive: true });
cpSync("build/macos-web", app + "/Contents/Resources/Web", { recursive: true });
cpSync("macos/Info.plist", app + "/Contents/Info.plist");
// Release Please owns package.json; stamp both Mac versions before signing.
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
if (!/^\d+\.\d+\.\d+$/.test(version))
  throw new Error("The Mac build requires a stable semantic version.");
for (const key of ["CFBundleVersion", "CFBundleShortVersionString"])
  run("/usr/libexec/PlistBuddy", [
    "-c",
    `Set :${key} ${version}`,
    app + "/Contents/Info.plist",
  ]);
const iconset = resolve("build/Subloom.iconset");
mkdirSync(iconset, { recursive: true });
for (const size of [16, 32, 128, 256, 512]) {
  run("sips", [
    "-z",
    String(size),
    String(size),
    "assets/icon.png",
    "--out",
    `${iconset}/icon_${size}x${size}.png`,
  ]);
  run("sips", [
    "-z",
    String(size * 2),
    String(size * 2),
    "assets/icon.png",
    "--out",
    `${iconset}/icon_${size}x${size}@2x.png`,
  ]);
}
run("iconutil", [
  "-c",
  "icns",
  iconset,
  "-o",
  app + "/Contents/Resources/Subloom.icns",
]);
run("xcrun", [
  "swiftc",
  "-swift-version",
  "5",
  "-O",
  "-target",
  `${process.arch === "arm64" ? "arm64" : "x86_64"}-apple-macos14.0`,
  "macos/main.swift",
  "-o",
  app + "/Contents/MacOS/Subloom",
]);
run("codesign", [
  "--force",
  "--sign",
  "-",
  "--entitlements",
  "macos/Entitlements.plist",
  app,
]);
run("codesign", ["--verify", "--strict", "--verbose=2", app]);
console.log(
  "Local test app built: " +
    app +
    "\nOpen with: open '" +
    app +
    "'\nThis is an ad-hoc signed web test shell, not a notarized store release.",
);
