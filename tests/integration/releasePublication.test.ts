import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";

const sha = "a".repeat(40);
const tag = "v" + JSON.parse(readFileSync("package.json", "utf8")).version;

function publication(draft: boolean, target = sha) {
  const directory = mkdtempSync(join(tmpdir(), "subloom-release-test-"));
  const output = join(directory, "outputs");
  const calls = join(directory, "calls");
  const marker = join(directory, "tag-created");
  writeFileSync(
    join(directory, "gh"),
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const path = args[1];
fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args) + '\\n');
if (path.includes('/releases?')) {
  console.log(JSON.stringify([{tag_name:${JSON.stringify(tag)}, draft:${draft}, prerelease:false, target_commitish:${JSON.stringify(target)}}]));
} else if (path.endsWith('/git/refs')) {
  fs.writeFileSync(${JSON.stringify(marker)}, 'created'); console.log('{}');
} else if (path.includes('/commits/')) {
  if (${draft} && !fs.existsSync(${JSON.stringify(marker)})) {
    console.error('HTTP 404: Not Found'); process.exit(1);
  }
  console.log(JSON.stringify({sha:${JSON.stringify(sha)}}));
} else { console.error('Unexpected API path: '+path); process.exit(2); }
`,
    { mode: 0o700 },
  );
  try {
    let error: unknown;
    try {
      execFileSync(
        process.execPath,
        [resolve("scripts/resolve-release-publication.mjs")],
        {
          env: {
            ...process.env,
            PATH: directory + ":" + process.env.PATH,
            GITHUB_REPOSITORY: "Baltii/Subloom",
            GITHUB_SHA: sha,
            GITHUB_OUTPUT: output,
            CREATED_RELEASE_TAG: "",
            CREATED_RELEASE_SHA: "",
            ALLOW_DRAFT_RELEASE: "true",
          },
          stdio: "pipe",
        },
      );
    } catch (caught) {
      error = caught;
    }
    return {
      error,
      output: error ? "" : readFileSync(output, "utf8"),
      calls: readFileSync(calls, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as string[]),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

it("finds an unpublished draft and freezes its missing tag at the exact release commit", () => {
  const result = publication(true);
  expect(result.error).toBeUndefined();
  expect(result.output).toBe(`released=true\ntag=${tag}\nsha=${sha}\n`);
  expect(result.calls[0]?.[1]).toBe(
    "repos/Baltii/Subloom/releases?per_page=100&page=1",
  );
  expect(result.calls.find((args) => args.includes("POST"))).toEqual([
    "api",
    "repos/Baltii/Subloom/git/refs",
    "--method",
    "POST",
    "-f",
    `ref=refs/tags/${tag}`,
    "-f",
    `sha=${sha}`,
  ]);
});

it("recovers an existing published release without rewriting its tag", () => {
  const result = publication(false);
  expect(result.error).toBeUndefined();
  expect(result.output).toContain("released=true");
  expect(result.calls.some((args) => args.includes("POST"))).toBe(false);
});

it("does not create a draft tag at another commit or a moving branch", () => {
  for (const target of ["b".repeat(40), "release-candidate"]) {
    const result = publication(true, target);
    expect(result.error).toBeDefined();
    expect(result.calls.some((args) => args.includes("POST"))).toBe(false);
  }
});
