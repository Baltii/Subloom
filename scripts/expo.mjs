import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { publicExpoEnvironment } from "./expo-env.mts";

// Expo writes loaded dotenv values to its development diagnostics. Only load
// public client configuration here; server credentials belong to Supabase.
const mode =
  process.env.NODE_ENV ||
  (process.argv[2] === "export" ? "production" : "development");
const files = [];
for (const file of [
  `.env.${mode}.local`,
  ".env.local",
  `.env.${mode}`,
  ".env",
]) {
  if (!existsSync(file)) continue;
  files.push(parseEnv(readFileSync(file, "utf8")));
}
const env = publicExpoEnvironment(process.env, files);
execFileSync(
  process.execPath,
  ["node_modules/expo/bin/cli", ...process.argv.slice(2)],
  { env, stdio: "inherit" },
);
