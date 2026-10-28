import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { selectPublication } from "./release-publication.mts";

const repository = process.env.GITHUB_REPOSITORY;
if (repository !== "Baltii/Subloom")
  throw new Error("Unexpected release repository.");
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const createdTag = process.env.CREATED_RELEASE_TAG || "";
const tag = createdTag || `v${version}`;
if (!/^v\d+\.\d+\.\d+$/.test(tag))
  throw new Error("Invalid stable release tag.");
const api = (path) =>
  JSON.parse(
    execFileSync("gh", ["api", path], {
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
const publication = selectPublication({
  release,
  tagSha: release ? api(`repos/${repository}/commits/${tag}`).sha : null,
  currentSha: process.env.GITHUB_SHA || "",
  createdTag,
  createdSha: process.env.CREATED_RELEASE_SHA || "",
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
