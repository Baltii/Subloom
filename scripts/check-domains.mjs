import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Guard against stale production hosts while preserving the native subloom:// scheme.
const oldHosts = [
  ["subloom", "baltii", "tn"].join("."),
  ["subloom-landing", "baltii", "tn"].join("."),
];
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0").filter(Boolean);
const stale = files.filter((path) =>
  /\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|html|ya?ml)$/i.test(path) &&
  oldHosts.some((host) => readFileSync(path, "utf8").includes(host))
);
if (stale.length) {
  console.error("Legacy Subloom domains remain in:\n" + stale.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Domain references OK; native deep-link scheme remains unchanged.");
}
