import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { macSigningPlan } from "./macos-signing.mts";
const signing = macSigningPlan(process.env);
const env = {
  ...process.env,
  DEVELOPER_DIR:
    process.env.DEVELOPER_DIR || "/Applications/Xcode.app/Contents/Developer",
};
const run = (command, args) =>
  execFileSync(command, args, { env, stdio: "inherit" });
if (
  process.argv
    .slice(2)
    .some((arg) => !["--update", "--widget"].includes(arg)) ||
  (process.argv.includes("--update") && process.argv.includes("--widget"))
)
  throw new Error(
    "Use --update for a replacement app or --widget for a separate widget test app.",
  );
if (process.platform !== "darwin")
  throw new Error("The Mac test app requires macOS and Xcode.");
if (!existsSync(env.DEVELOPER_DIR))
  throw new Error("Open Xcode and complete its setup first.");
run(process.execPath, [
  "scripts/expo.mjs",
  "export",
  "--platform",
  "web",
  "--output-dir",
  "build/macos-web",
]);
const app = resolve(
  process.argv.includes("--widget")
    ? "build/Subloom-widget.app"
    : process.argv.includes("--update")
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
// Xcode supplies the platform extension entry point and bundle validation.
run("xcodebuild", [
  "-project",
  "macos/SubloomWidget.xcodeproj",
  "-target",
  "SubloomWidget",
  "-configuration",
  "Release",
  "-sdk",
  "macosx",
  "-quiet",
  `ARCHS=${process.arch === "arm64" ? "arm64" : "x86_64"}`,
  "ONLY_ACTIVE_ARCH=YES",
  "CODE_SIGNING_ALLOWED=NO",
  `CONFIGURATION_BUILD_DIR=${resolve("build/widget-products")}`,
  `OBJROOT=${resolve("build/widget-intermediates")}`,
  `CLANG_MODULE_CACHE_PATH=${resolve("build/widget-module-cache")}`,
  "build",
]);
const widget = app + "/Contents/PlugIns/SubloomWidget.appex";
mkdirSync(app + "/Contents/PlugIns", { recursive: true });
cpSync("build/widget-products/SubloomWidget.appex", widget, {
  recursive: true,
});
for (const key of ["CFBundleVersion", "CFBundleShortVersionString"])
  run("/usr/libexec/PlistBuddy", [
    "-c",
    `Set :${key} ${version}`,
    widget + "/Contents/Info.plist",
  ]);
const hostEntitlements = resolve("build/host-entitlements.plist");
const widgetEntitlements = resolve("build/widget-entitlements.plist");
cpSync("macos/Entitlements.plist", hostEntitlements);
cpSync("macos/Widget-Entitlements.plist", widgetEntitlements);
if (signing.group) {
  for (const bundle of [app, widget])
    run("/usr/libexec/PlistBuddy", [
      "-c",
      `Add :SubloomWidgetAppGroup string ${signing.group}`,
      bundle + "/Contents/Info.plist",
    ]);
  for (const path of [hostEntitlements, widgetEntitlements]) {
    run("/usr/libexec/PlistBuddy", [
      "-c",
      "Add :com.apple.security.application-groups array",
      path,
    ]);
    run("/usr/libexec/PlistBuddy", [
      "-c",
      `Add :com.apple.security.application-groups:0 string ${signing.group}`,
      path,
    ]);
    run("/usr/libexec/PlistBuddy", [
      "-c",
      `Add :com.apple.developer.team-identifier string ${signing.team}`,
      path,
    ]);
  }
}
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
  "macos/SnapshotStore.swift",
  "macos/WidgetData.swift",
  "macos/WidgetPublisher.swift",
  "macos/MacBridge.swift",
  "macos/main.swift",
  "-o",
  app + "/Contents/MacOS/Subloom",
]);
const signingOptions = signing.group
  ? ["--options", "runtime", "--timestamp"]
  : [];
run("codesign", [
  "--force",
  "--sign",
  signing.identity,
  ...signingOptions,
  "--entitlements",
  widgetEntitlements,
  widget,
]);
run("codesign", [
  "--force",
  "--sign",
  signing.identity,
  ...signingOptions,
  "--entitlements",
  hostEntitlements,
  app,
]);
run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", app]);
if (signing.group) {
  for (const bundle of [app, widget]) {
    const result = spawnSync("codesign", ["-dv", "--verbose=4", bundle], {
      encoding: "utf8",
    });
    if (
      result.status !== 0 ||
      !result.stderr.split(/\r?\n/).includes(`TeamIdentifier=${signing.team}`)
    )
      throw new Error(
        "The signing certificate's team does not match MACOS_TEAM_ID. The widget build is not ready for installation.",
      );
  }
}
console.log(
  "Local test app built: " +
    app +
    "\nOpen with: open '" +
    app +
    "'\n" +
    (signing.group
      ? "Widget enabled with your signing identity and App Group. Notarize before external distribution."
      : "Ad-hoc test build: widget extension compiled, but gallery data sharing needs Apple Developer signing."),
);
