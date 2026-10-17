import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = new URL(
  process.env.EXPO_PUBLIC_SUPABASE_URL || "http://unconfigured.invalid",
);
const project = url.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/)?.[1];
if (!project || url.protocol !== "https:")
  throw new Error("Configure the hosted Supabase URL first.");
const steps = {
  budgets: "202610110001",
  savings: "202610110001",
  csv: "202610110001",
  calendar: "202610110001",
  cancellation: "202610110001",
  "price-history": "202610110002",
  family: "202610110003",
  social: "202610110003",
  mailbox: "202610110004",
  sso: "202610110005",
  payments: "20261012131814",
  radar: "20261012132927",
  "cancellation-watch": "20261012151054",
  autopilot: "20261012160133",
  "virtual-plans": "20261012160549",
  reserve: "20261012160847",
  coach: "20261012161235",
  settlements: "20261012183830",
  finance: "20261014111959",
  "exchange-rates": "20261014112614",
  bitcoin: "20261014113152",
  readiness: "20261017095506",
};
const args = process.argv.slice(2);
const step = args[0];
if (
  !Object.hasOwn(steps, step || "") ||
  args.slice(1).some((arg) => arg !== "--plan")
)
  throw new Error(
    "Usage: npm run setup:feature -- <" +
      Object.keys(steps).join("|") +
      "> [--plan]",
  );
const cli = resolve("node_modules/.bin/supabase");
const flags = [
  "--project-ref",
  project,
  "--agent",
  "no",
  "--output-format",
  "text",
];
let history;
try {
  history = JSON.parse(
    execFileSync(
      cli,
      [
        "db",
        "query",
        "--linked",
        "--output",
        "json",
        ...flags,
        "select version from supabase_migrations.schema_migrations order by version;",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ),
  );
} catch {
  throw new Error(
    "Cannot inspect migration history. Check Supabase CLI access; private responses were omitted.",
  );
}
const applied = new Set(history.map((row) => row.version));
const files = readdirSync("supabase/migrations")
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .sort();
const known = new Set(files.map((name) => name.split("_")[0]));
if ([...applied].some((version) => !known.has(version)))
  throw new Error(
    "Remote migration history contains unknown versions. Restore their local migration files before setup.",
  );
const workdir = mkdtempSync(join(tmpdir(), "subloom-feature-"));
try {
  mkdirSync(join(workdir, "supabase", "migrations"), { recursive: true });
  copyFileSync(
    "supabase/config.toml",
    join(workdir, "supabase", "config.toml"),
  );
  for (const name of files) {
    const version = name.split("_")[0];
    // Keep already-applied later migrations so rerunning an earlier step never repairs or rewinds history.
    if (version <= steps[step] || applied.has(version))
      copyFileSync(
        join("supabase", "migrations", name),
        join(workdir, "supabase", "migrations", name),
      );
  }
  console.log("Feature setup: " + step + " · " + project);
  const command = [
    "db",
    "push",
    "--skip-vault",
    "--workdir",
    workdir,
    ...flags,
  ];
  execFileSync(cli, [...command, "--dry-run"], { stdio: "inherit" });
  if (args.includes("--plan")) process.exitCode = 0;
  else {
    execFileSync(cli, [...command, "--yes"], { stdio: "inherit" });
    const verified = JSON.parse(
      execFileSync(
        cli,
        [
          "db",
          "query",
          "--linked",
          "--output",
          "json",
          ...flags,
          "select version from supabase_migrations.schema_migrations order by version;",
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      ),
    );
    if (!verified.some((row) => row.version === steps[step]))
      throw new Error("Expected feature migration was not recorded.");
    mkdirSync("build/feature-setup", { recursive: true });
    writeFileSync(
      "build/feature-setup/" + step + ".json",
      JSON.stringify(
        {
          step,
          project,
          at: new Date().toISOString(),
          migration: steps[step],
          scope:
            "Schema prerequisites applied and migration history verified. Provider registration, deployment and live checks are separate.",
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "Schema prerequisites verified. See feature-docs/" +
        "setup-progress.md for provider and live-test status.",
    );
  }
} finally {
  rmSync(workdir, { recursive: true, force: true });
}
