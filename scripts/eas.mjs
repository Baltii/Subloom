import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { publicExpoEnvironment } from "./expo-env.mts";

// EAS config evaluation does not automatically load the app's local Expo variables.
const files = existsSync(".env.local")
  ? [parseEnv(readFileSync(".env.local", "utf8"))]
  : [];
const env = publicExpoEnvironment(process.env, files, true);
execFileSync("npx", ["--yes", "eas-cli@24.12.1", ...process.argv.slice(2)], {
  env,
  stdio: "inherit",
});
