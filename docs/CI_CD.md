# GitHub CI, releases and deployment

## Pull requests

The **CI** workflow checks every pull request, including stacked PRs. It runs TypeScript, ESLint, the domain/store/database tests, Edge Function type checks and provider/authentication tests, workflow lint, and Expo web/iOS/Android JavaScript exports. It compiles, ad-hoc signs and verifies separate Apple Silicon and Intel Mac test apps on macOS 15 runners. Each run keeps versioned ZIPs and SHA-256 checksums for 14 days. These checks use public build configuration and do not send email, invoke paid builds or mutate the hosted database.

CI does not perform interactive device testing or launch the Mac interface. Native JavaScript exports do not replace signed iOS/Android builds. The database tests use PGlite; the separately recorded hosted checks remain useful acceptance evidence, not continuous production probes.

Use **Actions → CI → Run workflow** to recheck a selected branch. Workflow permissions are read-only, credentials are not persisted in Git checkouts, and imported Actions are pinned to exact commits. Dependabot proposes weekly Action updates. Node 24 is selected through `.nvmrc`; `npm ci` uses `package-lock.json`.

## Versioning and Mac downloads

Squash-merge feature PRs with conventional titles:

| Commit prefix | Version change |
| --- | --- |
| `fix:` | Patch, for example 1.1.0 → 1.1.1 |
| `feat:` | Minor, for example 1.0.0 → 1.1.0 |
| `feat!:` or a `BREAKING CHANGE:` footer | Major, for example 1.1.0 → 2.0.0 |
| `chore:`, `docs:`, `test:` | No release by itself |

Every push to `main` runs the same verification suite before Release Please creates or updates a release PR. The initial manifest starts at 1.0.0 and scans changes after the initial repository commit. Release Please updates `package.json`, `package-lock.json`, `CHANGELOG.md` and `.release-please-manifest.json`. Review and merge its release PR to create a `vX.Y.Z` tag and GitHub release.

`app.config.ts` reads the package version, and the Mac build stamps both bundle version fields from that value before code signing. EAS production build numbers remain separately managed by `appVersionSource: remote` and `autoIncrement`; do not overwrite them with marketing versions.

The release workflow uploads the Apple Silicon and Intel Mac ZIPs and checksums that passed in that same run. It verifies the release SHA equals the built SHA. Publication is part of the release workflow because tags/releases created with `GITHUB_TOKEN` do not trigger a separate release workflow. If uploading fails, rerun the failed upload job before the run's artifacts expire.

Automation uses the repository-scoped `GITHUB_TOKEN`; no personal release token is stored. The repository's **Allow GitHub Actions to create and approve pull requests** setting is enabled, while default token permissions remain read-only. The release job explicitly requests the write permissions it needs and does not approve or merge PRs. GitHub may require a maintainer to **Approve workflows to run** on bot-created release PRs. Approve those checks before merging; the merged release commit is also verified before publication. See [GitHub workflow triggering](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow) and [Release Please](https://github.com/googleapis/release-please-action).

The downloads are **ad-hoc signed test apps**, require macOS 14+, and are not notarized production installers. Read [Mac testing](MACOS.md) before opening one. Mac notifications remain disabled. No npm package or app-store submission is published by these workflows.

## Public build variables

These three repository Actions variables are configured for Subloom and used by CI/release builds:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_EAS_PROJECT_ID
```

They are intentionally bundled client configuration. Never replace the public Supabase key with a service-role or secret key. Releases fail if any required public setting is absent. Forks without these variables can still compile the guest interface. EAS development/preview/production environments have their own copies; update both locations when changing projects.

## Backend deployment and mobile builds

The **Deploy backend or build mobile** workflow is manually dispatched from `main`, uses the `production` environment, and serializes runs per target. Configure secrets in **Settings → Environments → production**:

| Target | Environment secrets | Additional setup |
| --- | --- | --- |
| `supabase` | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` | Use a scoped Supabase token limited to this project and the required deployment permissions. |
| `mobile` | `EXPO_TOKEN` | Configure EAS signing/APNs/FCM credentials and an Android `GOOGLE_SERVICES_JSON` file variable before a noninteractive build. |

These secrets are not configured by this change. No broad local Supabase/Expo login credential is copied into GitHub. The production environment accepts only the `main` branch. Secrets reach only the final target step, after installation and app/backend checks. Dispatch fails on missing credentials. See [Supabase CI environments](https://supabase.com/docs/guides/deployment/managing-environments) and [Expo CI builds](https://docs.expo.dev/build/building-on-ci/).

Choose `supabase` to preview then apply pending migrations, deploy functions, and check security advisors through the existing deployment script. Seeds, custom roles, Vault changes and function pruning are excluded. This does not install scheduler/provider secrets or configure SMTP; follow [setup](SETUP.md). Database migrations are forward-only; recover a failed deployment with a reviewed corrective migration instead of blindly reversing schema changes.

Choose `mobile`, a platform and `preview` or `production` to run EAS Build and wait for its result. EAS owns signing and produces the downloadable native binaries. Production increments build numbers; the repository package version controls the marketing version. Builds can consume EAS quota. This workflow does not submit to stores or send a test push.

## First merge order

1. Merge the app/sync/Mac feature PR into `main`.
2. Retarget its stacked CI/CD PR to `main`, then merge that PR after its checks pass.
3. Wait for the first main-branch verification and generated release PR.
4. Review the version/changelog, approve bot CI if GitHub requires it, then merge the release PR.
5. Download the matching architecture's Mac test ZIP from the GitHub release. Configure deployment secrets separately when ready to run backend/mobile delivery.
