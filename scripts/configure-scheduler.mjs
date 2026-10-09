import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const configuredUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const parsedUrl = configuredUrl && new URL(configuredUrl);
const url = parsedUrl?.origin;
const project =
  parsedUrl && parsedUrl.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/)?.[1];
if (!project || parsedUrl.protocol !== "https:")
  throw new Error("Configure the hosted Supabase URL first.");
const directory = join(homedir(), ".config", "subloom", project);
mkdirSync(directory, { recursive: true, mode: 0o700 });
const secretsFile = join(directory, "scheduler.env");
const sqlFile = join(directory, "install-scheduler.sql");
function cli(args) {
  try {
    return execFileSync(
      "node_modules/.bin/supabase",
      [
        ...args,
        "--project-ref",
        project,
        "--agent",
        "no",
        "--output-format",
        "text",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch {
    throw new Error(
      "Scheduler configuration failed. Private SQL and credentials were omitted. Check CLI access and the setup runbook.",
    );
  }
}
const configured = JSON.parse(cli(["secrets", "list", "--output", "json"]));
if (
  configured.some((secret) => secret.name === "CRON_SECRET") &&
  !existsSync(secretsFile)
) {
  throw new Error(
    "A cron secret already exists. Restore its private scheduler.env file rather than replacing an unknown secret.",
  );
}
if (!existsSync(secretsFile))
  writeFileSync(
    secretsFile,
    "CRON_SECRET=" + randomBytes(32).toString("hex") + "\n",
    { mode: 0o600 },
  );
const secret = readFileSync(secretsFile, "utf8").match(
  /^CRON_SECRET=([0-9a-f]{64})$/m,
)?.[1];
if (!secret)
  throw new Error(
    "The private scheduler.env file must contain a 32-byte hexadecimal cron secret.",
  );
cli(["secrets", "set", "--env-file", secretsFile]);
// Secret-bearing SQL is transient, private, and never logged, including when the CLI fails.
writeFileSync(
  sqlFile,
  `begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $vault$
declare existing uuid;
begin
  select id into existing from vault.secrets where name='subloom_project_url';
  if existing is null then perform vault.create_secret('${url}','subloom_project_url');
  else perform vault.update_secret(existing,'${url}'); end if;
  select id into existing from vault.secrets where name='subloom_cron_secret';
  if existing is null then perform vault.create_secret('${secret}','subloom_cron_secret');
  else perform vault.update_secret(existing,'${secret}'); end if;
end $vault$;
` +
    readFileSync("supabase/ops/install-cron.sql", "utf8") +
    "\ncommit;\n",
  { mode: 0o600 },
);
try {
  cli(["db", "query", "--linked", "--file", sqlFile]);
} finally {
  rmSync(sqlFile, { force: true });
}
const jobs = JSON.parse(
  cli([
    "db",
    "query",
    "--linked",
    "--output",
    "json",
    "select jobname,active from cron.job where jobname in ('subloom-schedule','subloom-deliver','subloom-retention') order by jobname;",
  ]),
);
if (
  !Array.isArray(jobs) ||
  jobs.length !== 3 ||
  jobs.some((job) => !job.active)
)
  throw new Error("Scheduler job verification failed.");
mkdirSync("docs/verification", { recursive: true });
writeFileSync(
  "docs/verification/scheduler.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      jobs,
      scope: "Hosted scheduler configured; no claim of actual device delivery.",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Three hosted Subloom jobs are active. Cron credentials are stored privately outside the repository.",
);
