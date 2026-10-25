import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { planModeSql } from "./plan-mode.mts";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const { enabled, sql } = planModeSql(process.env.EXPO_PUBLIC_PRO_PLAN_ENABLED);
const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--plan"))
  throw new Error("Supported option: --plan (preview only).");
const url = new URL(
  process.env.EXPO_PUBLIC_SUPABASE_URL || "http://unconfigured.invalid",
);
const project = url.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/)?.[1];
if (!project || url.protocol !== "https:")
  throw new Error("Configure the hosted Supabase URL in .env.local first.");
console.log(
  `Plan mode: ${enabled ? "Free/Pro restrictions enabled" : "free access for everyone"}`,
);
console.log("Supabase configuration target: " + project);
if (!args.includes("--plan"))
  execFileSync(
    "node_modules/.bin/supabase",
    [
      "db",
      "query",
      "--linked",
      "--project-ref",
      project,
      "--agent",
      "no",
      "--output-format",
      "text",
      sql,
    ],
    {
      stdio: "inherit",
      env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
    },
  );
