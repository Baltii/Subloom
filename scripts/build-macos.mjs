import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { prepareSparkle } from "./prepare-sparkle.mjs";
import trust from "../updates/trust.json" with { type: "json" };
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
run(process.execPath, [
  "scripts/expo.mjs",
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
const sparkle = await prepareSparkle();
mkdirSync(app + "/Contents/Frameworks", { recursive: true });
cpSync(
  sparkle + "/Sparkle.framework",
  app + "/Contents/Frameworks/Sparkle.framework",
  { recursive: true, verbatimSymlinks: true },
);
for (const [key, value] of [
  [
    "SUFeedURL",
    `https://github.com/Baltii/Subloom/releases/latest/download/subloom-macos-${process.arch}.xml`,
  ],
  ["SUPublicEDKey", Buffer.from(trust.publicKey, "hex").toString("base64")],
])
  run("/usr/libexec/PlistBuddy", [
    "-c",
    `Add :${key} string ${value}`,
    app + "/Contents/Info.plist",
  ]);
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
  "macos/SnapshotStore.swift",
  "macos/Widget/WidgetSnapshot.swift",
  "macos/MacBridge.swift",
  "macos/MacUpdater.swift",
  "-F",
  sparkle,
  "-framework",
  "Sparkle",
  "-Xlinker",
  "-rpath",
  "-Xlinker",
  "@executable_path/../Frameworks",
  "macos/main.swift",
  "-o",
  app + "/Contents/MacOS/Subloom",
]);
// Signed distribution builds use app groups. Ad-hoc builds use one narrowly
// scoped snapshot directory because unprovisioned groups can deny writes.
const signingIdentity = process.env.MACOS_SIGNING_IDENTITY || "-";
const widgetGroup =
  process.env.MACOS_WIDGET_APP_GROUP || "group.com.subloom.mac.test";
if (!/^[A-Za-z0-9.-]+$/.test(widgetGroup))
  throw new Error("Invalid widget app group.");
const localWidgetStorage = signingIdentity === "-";
const extension = app + "/Contents/PlugIns/SubloomNextReminder.appex";
// A WidgetKit extension must use Xcode's extension entry point and linker
// setup. A plain swiftc @main executable can compile/sign yet crash during
// ExtensionFoundation bootstrap before the gallery can read its descriptors.
const widgetDerived = resolve("build/macos-widget-derived");
run("xcodebuild", [
  "-quiet",
  "-project",
  "macos/Widget/SubloomWidget.xcodeproj",
  "-scheme",
  "SubloomNextReminder",
  "-configuration",
  "Release",
  "-derivedDataPath",
  widgetDerived,
  "-arch",
  process.arch === "arm64" ? "arm64" : "x86_64",
  "CODE_SIGNING_ALLOWED=NO",
  `CURRENT_PROJECT_VERSION=${version}`,
  `MARKETING_VERSION=${version}`,
  "build",
]);
mkdirSync(app + "/Contents/PlugIns", { recursive: true });
cpSync(
  widgetDerived + "/Build/Products/Release/SubloomNextReminder.appex",
  extension,
  { recursive: true },
);
for (const bundle of [app, extension]) {
  run("/usr/libexec/PlistBuddy", [
    "-c",
    `Add :SubloomWidgetStorage string ${localWidgetStorage ? "local" : "app-group"}`,
    bundle + "/Contents/Info.plist",
  ]);
  if (!localWidgetStorage)
    run("/usr/libexec/PlistBuddy", [
      "-c",
      `Add :SubloomWidgetAppGroup string ${widgetGroup}`,
      bundle + "/Contents/Info.plist",
    ]);
}
for (const key of ["CFBundleVersion", "CFBundleShortVersionString"])
  run("/usr/libexec/PlistBuddy", [
    "-c",
    `Set :${key} ${version}`,
    extension + "/Contents/Info.plist",
  ]);
const snapshotDirectory = "/Library/Application Support/SubloomWidgets/";
const localAccess = (access) =>
  `<key>com.apple.security.temporary-exception.files.home-relative-path.${access}</key><array><string>${snapshotDirectory}</string></array>`;
const groupEntitlement = `<key>com.apple.security.application-groups</key><array><string>${widgetGroup}</string></array>`;
const hostEntitlements = resolve("build/macos-widget-host.entitlements");
const widgetEntitlements = resolve("build/macos-widget-extension.entitlements");
writeFileSync(
  hostEntitlements,
  readFileSync("macos/Entitlements.plist", "utf8").replace(
    "</dict>",
    (localWidgetStorage ? localAccess("read-write") : groupEntitlement) +
      "</dict>",
  ),
);
writeFileSync(
  widgetEntitlements,
  `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>com.apple.security.app-sandbox</key><true/>${localWidgetStorage ? localAccess("read-only") : groupEntitlement}</dict></plist>`,
);
run("codesign", [
  "--force",
  "--sign",
  signingIdentity,
  "--entitlements",
  widgetEntitlements,
  extension,
]);
run("codesign", [
  "--force",
  "--sign",
  signingIdentity,
  "--entitlements",
  hostEntitlements,
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
