import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const directory = mkdtempSync(join(tmpdir(), "subloom-widget-tests-"));
try {
  const executable = join(directory, "widget-tests");
  execFileSync(
    "xcrun",
    [
      "swiftc",
      "-swift-version",
      "5",
      "-parse-as-library",
      "macos/SnapshotStore.swift",
      "macos/WidgetData.swift",
      "macos/WidgetPublisher.swift",
      "tests/macos/WidgetTests.swift",
      "-o",
      executable,
    ],
    { stdio: "inherit" },
  );
  execFileSync(executable, [], { stdio: "inherit" });
} finally {
  rmSync(directory, { recursive: true, force: true });
}
