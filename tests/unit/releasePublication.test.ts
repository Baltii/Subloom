import { describe, expect, it } from "vitest";
import {
  assertVerifiedArtifactRun,
  releaseArtifacts,
  selectPublication,
} from "../../scripts/release-publication.mts";

const sha = "a".repeat(40);
const otherSha = "b".repeat(40);
const release = { tag_name: "v1.11.0", draft: false, prerelease: false };

describe("release publication recovery", () => {
  it("publishes an existing stable release at the verified commit even without new-release outputs", () => {
    expect(
      selectPublication({ release, tagSha: sha, currentSha: sha }),
    ).toEqual({ tag: "v1.11.0", sha });
  });
  it("does not republish an older version on a later feature commit", () => {
    expect(
      selectPublication({ release, tagSha: sha, currentSha: otherSha }),
    ).toBeNull();
    expect(
      selectPublication({ release: null, tagSha: null, currentSha: sha }),
    ).toBeNull();
  });
  it("allows a newly created release at its own exact source commit", () => {
    expect(
      selectPublication({
        release,
        tagSha: sha,
        currentSha: otherSha,
        createdTag: "v1.11.0",
        createdSha: sha,
      }),
    ).toEqual({ tag: "v1.11.0", sha });
    expect(() =>
      selectPublication({
        release,
        tagSha: sha,
        currentSha: sha,
        createdTag: "v1.11.0",
        createdSha: otherSha,
      }),
    ).toThrow(/outputs/);
  });
  it("rejects missing new releases, draft releases and prereleases", () => {
    expect(() =>
      selectPublication({
        release: null,
        tagSha: null,
        currentSha: sha,
        createdTag: "v1.11.0",
      }),
    ).toThrow(/could not be found/);
    for (const patch of [
      { draft: true },
      { prerelease: true },
      { tag_name: "v1.11.0-beta.1" },
    ])
      expect(() =>
        selectPublication({
          release: { ...release, ...patch },
          tagSha: sha,
          currentSha: sha,
        }),
      ).toThrow(/stable/);
  });
});

const run = {
  repository: { full_name: "Baltii/Subloom" },
  path: ".github/workflows/release.yml",
  event: "push",
  head_branch: "release-candidate",
  head_sha: sha,
  status: "completed",
  conclusion: "success",
};
const artifacts = releaseArtifacts.map((name) => ({
  name,
  expired: false,
  workflow_run: { head_sha: sha },
}));

describe("verified installer reuse", () => {
  it("accepts complete artifacts from a successful production run at the tag commit", () => {
    expect(() =>
      assertVerifiedArtifactRun(run, "Baltii/Subloom", sha, artifacts),
    ).not.toThrow();
  });
  it("rejects other commits, repositories, workflows, PRs, branches and unfinished or failed runs", () => {
    for (const patch of [
      { head_sha: otherSha },
      { repository: { full_name: "someone/Subloom" } },
      { path: ".github/workflows/ci.yml" },
      { event: "pull_request" },
      { head_branch: "feature" },
      { status: "in_progress" },
      { conclusion: "failure" },
    ])
      expect(() =>
        assertVerifiedArtifactRun(
          { ...run, ...patch },
          "Baltii/Subloom",
          sha,
          artifacts,
        ),
      ).toThrow(/exact release commit/);
  });
  it("rejects missing, expired, duplicate or mismatched platform artifacts", () => {
    for (const invalid of [
      artifacts.slice(1),
      [...artifacts, artifacts[0]!],
      artifacts.map((artifact) => ({ ...artifact, expired: true })),
      artifacts.map((artifact) => ({
        ...artifact,
        workflow_run: { head_sha: otherSha },
      })),
    ])
      expect(() =>
        assertVerifiedArtifactRun(run, "Baltii/Subloom", sha, invalid),
      ).toThrow(/artifact/);
  });
});
