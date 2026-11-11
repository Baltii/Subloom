import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parse } from "yaml";
const workflow = (name: string) =>
  parse(readFileSync(`.github/workflows/${name}.yml`, "utf8"));

it("keeps PR checks but never starts installers unless explicitly requested", () => {
  const ci = workflow("ci");
  const verify = workflow("verify");
  expect(ci.on.pull_request).toBeNull();
  expect(ci.jobs.verify.with?.build_installers).not.toBe(true);
  expect(verify.on.workflow_call.inputs.build_installers.default).toBe(false);
  for (const job of ["android", "macos", "windows"]) {
    expect(verify.jobs[job].if).toBe("inputs.build_installers");
    expect(verify.jobs[job].needs).toBe("app");
  }
});

it("gates a single installer build on a merged release and reuses verified installers", () => {
  const release = workflow("release");
  expect(release.jobs.version.needs).toBeUndefined();
  expect(release.jobs.verify.needs).toBe("version");
  expect(release.jobs.verify.if).toBe(
    "needs.version.outputs.released == 'true'",
  );
  expect(release.jobs.verify.with.build_installers).toBe(true);
  expect(release.jobs.verify.with.ref).toBe("${{ needs.version.outputs.sha }}");
  expect(release.jobs["publish-artifacts"].needs).toEqual([
    "verify",
    "version",
  ]);
  expect(release.jobs["publish-artifacts"].with.reuse_verified).toBe(
    "${{ needs.version.outputs.sha == github.sha }}",
  );
});

it("keeps releases draft until complete and prevents publication events from rebuilding installers", () => {
  expect(
    JSON.parse(readFileSync("release-please-config.json", "utf8")).draft,
  ).toBe(true);
  const assets = workflow("release-assets");
  expect(assets.jobs.source.permissions.contents).toBe("write");
  expect(assets.on.release).toBeUndefined();
  const steps = assets.jobs.publish.steps;
  const upload = steps.find((step: { run?: string }) =>
    step.run?.includes("gh release upload"),
  );
  expect(upload.run.indexOf("artifacts/updates/*")).toBeLessThan(
    upload.run.indexOf("gh release edit"),
  );
  expect(upload.run).toContain("--draft=false --latest");
  expect(assets.jobs.verify.with.build_installers).toBe(true);
});
