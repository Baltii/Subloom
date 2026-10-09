import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = new URL(
  process.env.EXPO_PUBLIC_SUPABASE_URL || "http://unconfigured.invalid",
);
const project = url.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/)?.[1];
if (!project || url.protocol !== "https:")
  throw new Error("Configure the hosted Supabase URL in .env.local first.");
const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--plan"))
  throw new Error("Supported option: --plan (read-only migration preview).");
const cli = "node_modules/.bin/supabase";
function run(command) {
  execFileSync(
    cli,
    [
      ...command,
      "--project-ref",
      project,
      "--agent",
      "no",
      "--output-format",
      "text",
    ],
    { stdio: "inherit" },
  );
}
console.log("Supabase deployment target: " + project);
// Do not include seed data, custom roles, Vault changes or function pruning.
run(["db", "push", "--dry-run", "--skip-vault"]);
if (args.includes("--plan")) process.exit(0);
run(["db", "push", "--skip-vault", "--yes"]);
run([
  "functions",
  "deploy",
  "--use-api",
  "--import-map",
  "supabase/functions/deno.json",
]);
run([
  "db",
  "advisors",
  "--linked",
  "--type",
  "security",
  "--level",
  "warn",
  "--fail-on",
  "error",
]);
console.log(
  "Schema/functions deployed. Next: npm run test:live. SMTP, provider secrets and scheduled jobs need the setup runbook.",
);
