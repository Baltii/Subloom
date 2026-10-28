const stableTag = /^v\d+\.\d+\.\d+$/;
const commit = /^[a-f0-9]{40}$/;
export const releaseArtifacts = [
  "android-apk",
  "windows-x64",
  "macos-arm64",
  "macos-x64",
] as const;

export function selectPublication({
  release,
  tagSha,
  currentSha,
  createdTag,
  createdSha,
}: {
  release: { tag_name: string; draft: boolean; prerelease: boolean } | null;
  tagSha: string | null;
  currentSha: string;
  createdTag?: string;
  createdSha?: string;
}) {
  if (!commit.test(currentSha))
    throw new Error("Invalid release source commit.");
  if (!release) {
    if (createdTag)
      throw new Error("The newly created release could not be found.");
    return null;
  }
  if (!stableTag.test(release.tag_name) || release.draft || release.prerelease)
    throw new Error("Expected a published stable release.");
  if (!tagSha || !commit.test(tagSha))
    throw new Error("Invalid release tag commit.");
  if (createdTag) {
    if (createdTag !== release.tag_name || createdSha !== tagSha)
      throw new Error("Release action outputs do not match the published tag.");
  } else if (tagSha !== currentSha) return null;
  return { tag: release.tag_name, sha: tagSha };
}

export function assertVerifiedArtifactRun(
  run: {
    repository: { full_name: string };
    path: string;
    event: string;
    head_branch: string;
    head_sha: string;
    status: string;
    conclusion: string | null;
  },
  repository: string,
  sha: string,
  artifacts: {
    name: string;
    expired: boolean;
    workflow_run: { head_sha: string };
  }[],
) {
  if (
    run.repository.full_name !== repository ||
    run.path !== ".github/workflows/release.yml" ||
    !["push", "workflow_dispatch"].includes(run.event) ||
    run.head_branch !== "release-candidate" ||
    run.head_sha !== sha ||
    run.status !== "completed" ||
    run.conclusion !== "success"
  )
    throw new Error(
      "Use a successful production release run at the exact release commit.",
    );
  for (const name of releaseArtifacts) {
    const matches = artifacts.filter((artifact) => artifact.name === name);
    if (
      matches.length !== 1 ||
      matches[0]!.expired ||
      matches[0]!.workflow_run.head_sha !== sha
    )
      throw new Error(`Missing or invalid verified ${name} artifact.`);
  }
}
