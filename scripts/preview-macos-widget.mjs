import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
mkdirSync("build", { recursive: true });
execFileSync(
  "xcrun",
  [
    "swiftc",
    "-swift-version",
    "5",
    "-parse-as-library",
    "macos/WidgetData.swift",
    "macos/WidgetContent.swift",
    "tests/macos/WidgetPreview.swift",
    "-o",
    "build/widget-preview",
  ],
  { stdio: "inherit" },
);
execFileSync("build/widget-preview", [], { stdio: "inherit" });
