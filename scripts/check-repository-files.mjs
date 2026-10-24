import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Read repository rules only, so a contributor's global ignores cannot affect CI.
const root = fileURLToPath(new URL("../", import.meta.url));
const files = execFileSync("git", [
  "ls-files", "--cached", "--ignored", "--exclude-per-directory=.gitignore", "-z",
], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);

if (files.length) {
  console.error("Private or generated files are tracked despite repository ignore rules:\n" + files.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Repository file policy passed: no ignored files are tracked.");
}
