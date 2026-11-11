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
let release = null;
try {
  release = api(`repos/${repository}/releases/tags/${tag}`);
} catch (error) {
  if (!String(error.stderr).includes("HTTP 404")) throw error;
}
let tagSha = null;
if (release) {
  try {
    tagSha = api(`repos/${repository}/commits/${tag}`).sha;
  } catch (error) {
    if (
      !String(error.stderr).includes("HTTP 404") ||
      !release.draft ||
      process.env.ALLOW_DRAFT_RELEASE !== "true"
    )
      throw error;
    // GitHub drafts can exist before their tag does. Freeze that tag at the
    // merged version commit before any platform checks out or builds it.
    const source = draftTagSource(
      process.env.CREATED_RELEASE_SHA || release.target_commitish,
      process.env.GITHUB_SHA || "",
    );
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
