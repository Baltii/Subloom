import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

if (process.platform !== "darwin")
  throw new Error("Run this check on macOS after building the app.");
const app = resolve(process.argv[2] || "build/Subloom.app");
const extension = app + "/Contents/PlugIns/SubloomNextReminder.appex";
const binary = extension + "/Contents/MacOS/SubloomNextReminder";
const plist = (path) =>
  JSON.parse(
    execFileSync("plutil", ["-convert", "json", "-o", "-", path], {
      encoding: "utf8",
    }),
  );
const host = plist(app + "/Contents/Info.plist");
const widget = plist(extension + "/Contents/Info.plist");
assert.equal(widget.CFBundlePackageType, "XPC!");
assert.equal(
  widget.NSExtension.NSExtensionPointIdentifier,
  "com.apple.widgetkit-extension",
);
assert.equal(widget.SubloomWidgetStorage, host.SubloomWidgetStorage);
const entitlements = (path) => {
  const xml = execFileSync("codesign", ["-d", "--entitlements", ":-", path], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return JSON.parse(
    execFileSync("plutil", ["-convert", "json", "-o", "-", "-"], {
      input: xml,
      encoding: "utf8",
    }),
  );
};
const hostAccess = entitlements(app),
  widgetAccess = entitlements(extension);
assert.equal(hostAccess["com.apple.security.app-sandbox"], true);
assert.equal(widgetAccess["com.apple.security.app-sandbox"], true);
if (host.SubloomWidgetStorage === "local") {
  const directory = "/Library/Application Support/SubloomWidgets/";
  assert.deepEqual(
    hostAccess[
      "com.apple.security.temporary-exception.files.home-relative-path.read-write"
    ],
    [directory],
  );
  assert.deepEqual(
    widgetAccess[
      "com.apple.security.temporary-exception.files.home-relative-path.read-only"
    ],
    [directory],
  );
  assert.equal(
    widgetAccess[
      "com.apple.security.temporary-exception.files.home-relative-path.read-write"
    ],
    undefined,
  );
  assert.equal(hostAccess["com.apple.security.application-groups"], undefined);
  assert.equal(
    widgetAccess["com.apple.security.application-groups"],
    undefined,
  );
} else {
  assert.equal(host.SubloomWidgetStorage, "app-group");
  assert.equal(widget.SubloomWidgetAppGroup, host.SubloomWidgetAppGroup);
  assert.deepEqual(hostAccess["com.apple.security.application-groups"], [
    host.SubloomWidgetAppGroup,
  ]);
  assert.deepEqual(widgetAccess["com.apple.security.application-groups"], [
    host.SubloomWidgetAppGroup,
  ]);
}
assert.equal(widget.CFBundleVersion, host.CFBundleVersion);
assert.equal(
  widget.CFBundleShortVersionString,
  host.CFBundleShortVersionString,
);
assert.deepEqual(widget.CFBundleSupportedPlatforms, ["MacOSX"]);
// A standalone Swift @main executable previously passed signing verification
// but crashed before serving gallery descriptors. Require the extension runtime.
const symbols = execFileSync("nm", ["-u", binary], { encoding: "utf8" });
assert.match(
  symbols,
  /\b_NSExtensionMain\b/,
  "Widget must link the macOS extension entry point",
);
execFileSync("codesign", ["--verify", "--deep", "--strict", app], {
  stdio: "inherit",
});
console.log(
  "Widget packaging passed: extension runtime, metadata, scoped storage access and nested signatures.",
);
