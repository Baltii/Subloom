# Releasing Subloom

Work against `release-candidate` using Conventional Commits. Release Please owns
`package.json`, the root package-lock version, `.release-please-manifest.json`, and
`CHANGELOG.md`; do not bump them manually for a feature PR.

1. Open a feature PR. CI runs workflow validation, app/database/backend tests,
   Windows unit tests, asset checks, and JavaScript exports. It does not compile
   Android, Windows, or Mac installers. New pushes cancel superseded PR checks.
2. Merge reviewed feature PRs. The production workflow opens or updates the
   Release Please version/changelog PR without starting platform builds.
3. Deploy any changed backend functions first using the connected Supabase project
   or the existing manual deployment workflow when its credentials are configured.
   Merge that release PR when ready. The production workflow verifies its exact
   release commit and builds Android, Windows x64, Mac arm64, and Mac x64 once.
   All platform builds wait for shared checks; Android uses Gradle build caching.
4. The publication job reuses this run's installers, validates checksums, signs
   update metadata, and uploads every platform before publishing the stable
   GitHub release as latest. The release remains a draft if checks, builds,
   signing, or upload fail. No publication event triggers a second
   build.

The existing Vercel Git integration deploys the web app from `release-candidate`.
It is separate from installer publication; the version PR also gives the web app
its updated version number. EAS/store builds and compatible mobile updates remain
explicit manual workflows; the direct-download Android APK retains its test key,
arm64/x86_64 support, and GitHub-test update channel.

## Recovery

Rerun failed jobs in **Version and release**, rather than starting all builds
again. Successful platform artifacts can be reused while still retained.

**Attach release apps** is an explicit recovery workflow, not a release-published
trigger. Supply the stable tag. With `verified_run_id`, it accepts only a complete,
successful production release run at that exact commit; without it, recovery
verifies and builds at the tag before uploading. A draft must have a tag pointing
to its exact version commit. Keep failed drafts unpublished until all checks and
any required backend deployment have succeeded. Never reuse artifacts from a PR or a different
commit, or publish a partially attached release.

Existing required configuration remains in GitHub repository variables/secrets:
public app configuration, Firebase Android configuration, the update signing seed,
and optional production Supabase credentials for the manual backend workflow.
The installer pipeline does not require new backend credentials. Do not commit
secret values.
