# Historical release artifact handling

The first production workflow after moving to release-candidate created the previously merged 1.2.0 release at 6a909f5 while verifying the newer 065b210 commit. The existing artifact integrity guard correctly refused that SHA mismatch, but marked the run failed after every build passed.

Keep the defensive SHA check inside publishing. Also gate the publishing job on the same SHA match, and report historical releases explicitly in the version job summary. This makes deferred artifacts an intentional skip while still refusing to attach binaries built from a different commit. Future releases at the verified commit retain normal publishing. This does not backfill artifacts for an older tag or claim that such binaries exist.

Validation: actionlint and git diff --check pass. The preceding production run confirms the mismatch case and successful app/backend, website, Mac and Android builds. No application source changes.

Merge order: after Firebase configuration cleanup PR #55; this branch targets its predecessor until that PR merges, then release-candidate.
