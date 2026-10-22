# Windows installer and release downloads

## Behavior

A published stable `vX.Y.Z` GitHub release gets these assets, plus SHA-256 checksums:

| Platform | Download |
| --- | --- |
| Windows x64 | `Subloom-X.Y.Z-windows-x64-setup.exe` |
| Android arm64 / x86_64 | `Subloom-X.Y.Z-<commit>-android-test.apk` |
| macOS Apple Silicon | `Subloom-X.Y.Z-macos-arm64.zip` containing `Subloom.app` |
| macOS Intel | `Subloom-X.Y.Z-macos-x64.zip` containing `Subloom.app` |

GitHub's automatically generated source archives remain available. Assets appear after all required builds and checks complete. Failed builds leave the workflow failed rather than attaching a partial set of apps.

## Release automation

- `windows-exe.yml` exports Expo web, creates an NSIS installer on Windows, launches the packaged app twice to test rendering and persistence, then retains the installer/checksum as `windows-x64`.
- `verify.yml` includes Windows alongside existing application/backend/website, Android, and Mac checks. Its optional `ref` pins every checkout, including the nested Android and Windows workflows, to the same source commit.
- `release-assets.yml` handles human-published stable releases and manual **Actions → Attach release apps → Run workflow** runs with a published tag. It resolves the tag, verifies that it belongs to `release-candidate` history, confirms that the package version matches, and builds that exact commit.
- `release.yml` explicitly calls the same artifact workflow when Release Please creates a release. GitHub's `GITHUB_TOKEN` does not trigger a second `release.published` workflow, so this direct call is necessary. It reuses this run's verified binaries only when the release SHA matches the verified SHA. If a release points to an earlier commit, it rebuilds the tag instead of silently skipping its binaries.
- Publishing downloads only artifacts from the current workflow run, verifies their checksums, and attaches all four platform groups. The source SHA check continues to prevent newer binaries from being mislabeled as an older release.

The source-only historical `v1.3.0` tag predates Windows support. Do not attach newer Windows code to it. All-platform downloads begin with a release whose tagged source contains this feature. Manual rebuilds of future tags can repair missing downloads without publishing a new version.

## Configuration

The repository already has the required public Expo/Supabase variables and `GOOGLE_SERVICES_JSON` secret. No Expo token is needed: Android uses local Gradle in Actions and desktop builds package the web export. Workflows use the automatic GitHub token to upload assets with job-scoped `contents: write` and `actions: read` permissions. Do not place server secrets in public Expo configuration.

See [Windows build instructions and limitations](../windows/README.md). The Windows installer is unsigned, Android is test-signed, and Mac is ad-hoc signed and not notarized. Production signing requires platform credentials and is separate from providing installable downloads.

## Merge order

This feature is one PR directly against `release-candidate`. Merge it before publishing the first release that should include Windows. Unrelated local documentation and website changes are excluded.

## Verification

Local checks passed: `npm run check` (55 test files, 331 tests), `npm run test:windows` (4 tests), the Expo production web export, brand consistency, and Actionlint 1.7.12. Hosted platform build results are recorded in the PR. The hosted Windows smoke test checks the packaged executable, app rendering, renderer isolation, SPA routing, missing assets, and local data across process restarts. Automated broker tests cover callback origin/path checks, concurrent requests, cancellation, timeout, and external browser failures. Browser callback transport is tested with fixtures; real Google/Apple/SSO consent is not performed by CI.
