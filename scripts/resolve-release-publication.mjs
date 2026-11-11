import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { draftTagSource, selectPublication } from "./release-publication.mts";

const repository = process.env.GITHUB_REPOSITORY;
if (repository !== "Baltii/Subloom")
  throw new Error("Unexpected release repository.");
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const createdTag = process.env.CREATED_RELEASE_TAG || "";
const tag = createdTag || `v${version}`;
if (!/^v\d+\.\d+\.\d+$/.test(tag))
  throw new Error("Invalid stable release tag.");
const api = (path, args = []) =>
  JSON.parse(
    execFileSync("gh", ["api", path, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
// The by-tag endpoint is for published releases. Listing with the workflow's
// push permission also exposes drafts, including drafts without a Git tag yet.
let release = null;
for (let page = 1; !release; page++) {
  const releases = api(
    `repos/${repository}/releases?per_page=100&page=${page}`,
  );
  release = releases.find((candidate) => candidate.tag_name === tag) ?? null;
  if (releases.length < 100) break;
}
let tagSha = null;
if (release) {
  try {
    tagSha = api(`repos/${repository}/commits/${tag}`).sha;
  } catch (error) {
    if (
      !(
        String(error.stderr).includes("HTTP 404") ||
        (String(error.stderr).includes("HTTP 422") &&
          String(error.stderr).includes("No commit found for SHA"))
      ) ||
      !release.draft ||
      process.env.ALLOW_DRAFT_RELEASE !== "true"
    )
      throw error;
    // GitHub drafts can exist before their tag does. Freeze that tag at the
    // merged version commit before any platform checks out or builds it.
    const target = process.env.CREATED_RELEASE_SHA || release.target_commitish;
    if (!/^[a-f0-9]{40}$/.test(target))
      throw new Error(
        "A draft needs an immutable source commit before recovery.",
      );
    if (target !== process.env.GITHUB_SHA) {
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        "released=false\npending=true\n",
      );
      console.log(
        "An earlier draft needs recovery before preparing another release PR.",
      );
      process.exit(0);
    }
    const source = draftTagSource(target, process.env.GITHUB_SHA || "");
    api(`repos/${repository}/git/refs`, [
      "--method",
      "POST",
      "-f",
      `ref=refs/tags/${tag}`,
      "-f",
      `sha=${source}`,
    ]);
    tagSha = api(`repos/${repository}/commits/${tag}`).sha;
  }
}
const publication = selectPublication({
  release,
  tagSha,
  currentSha: process.env.GITHUB_SHA || "",
  createdTag,
  createdSha: process.env.CREATED_RELEASE_SHA || "",
  allowDraft: process.env.ALLOW_DRAFT_RELEASE === "true",
});
appendFileSync(
  process.env.GITHUB_OUTPUT,
  publication
    ? `released=true\ntag=${publication.tag}\nsha=${publication.sha}\n`
    : "released=false\n",
);
console.log(
  publication
    ? `Publish verified apps for ${publication.tag} at ${publication.sha}.`
    : "No release matches this commit.",
);
