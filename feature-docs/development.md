# Development and build guide

This guide contains the operational details behind the [project README](../README.md). The production/default branch is `release-candidate`. Historical delivery records in this folder can describe retired tools or older deployment arrangements; use the current source and this guide for the present workflow.

## Local configuration

Use Node.js 24 from [`.nvmrc`](../.nvmrc) and npm. Run `npm ci` in the repository root, then `npm run dev` for the web app at http://localhost:8081. The current welcome tour ends with **Use on this device** or **Create or sign in**. A new guest workspace starts empty.

Guest tracking, pasted-text receipt detection, and CSV imports work without provider credentials. For account sync, put the public values in an ignored `.env.local`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
EXPO_PUBLIC_EAS_PROJECT_ID=your-eas-project-id
```

[`.env.example`](../.env.example) lists the public fields and comments on optional server configuration. Do not copy server secrets into `EXPO_PUBLIC_*`. Expo, EAS, and Mac entry points load only public dotenv configuration and filter known inherited secret variables before invoking Expo.

## App, website, and native development

- **App web preview:** `npm run dev` at the root; http://localhost:8081.
- **Landing page:** run `npm ci` and `npm run dev` in `landing/`; http://localhost:3000. Its production check is `npm run build` in that directory.
- **Android:** install the Android SDK/JDK tooling and run `npm run android`.
- **iOS:** on macOS with Xcode installed, run `npm run ios`.
- **EAS:** `npm run eas -- build --platform android --profile preview` requests a cloud build using the project’s existing EAS configuration and authenticated account. Cloud builds require their corresponding credentials and can consume build quota.

Native development uses an Expo development client, not Expo Go. Development-client builds need the development server; the CI test APK described below is a separate bundled app.

## Guest and account storage

Guest subscriptions, receipt candidates, preferences, and activity are durably saved before an edit is reported as successful. Mobile uses SQLite; the web preview uses localStorage; Windows keeps the web storage in a persistent app profile; the Mac app uses atomic native snapshot files.

Guest data stays separate when signing in or out. Importing guest records into an account is an explicit action. Account sync uses owner-isolated storage, a durable mutation outbox, idempotent server operations, revision signals, and explicit conflict resolution. Reconnect/foreground refreshes do not make a failed write appear successful.

Currencies remain separate. Recurring-cost estimates use exact minor units and rational calculations; renewal dates retain their date-only and account-timezone meaning. Statements are user-supplied records, not bank authentication or evidence of verified payment success/failure.

Export a guest backup from Settings before clearing browser storage, uninstalling, or replacing an app. Mac files are private to the OS user but are not separately encrypted; protect the device and its backups.

## Mac test app and reminders

Run `npm run build:macos` to build `build/Subloom.app`; `npm run open:macos` opens it. The app bundles the web interface, works without Metro, and requires macOS 14+. The test app is ad-hoc signed, not a notarized App Store distribution.

For the existing replacement workflow, `npm run build:macos -- --update` creates `build/Subloom-update.app`. Quit the running copy before opening the replacement. Keeping its bundle identifier and storage origin preserves the native workspace. Snapshot files live in the app sandbox under `Library/Application Support/Subloom/Snapshots`; validated existing WebKit data migrates on first launch.

Enable **Settings → Mac notifications**, then use **Send a Mac test notification**. These local reminders need no Subloom account, Apple login, paid developer membership, or APNs credentials. macOS notification permission is required; Focus and banner settings can suppress visible alerts.

Up to 48 upcoming reminders within a year stay scheduled while the app is closed. Opening or returning to the app, or editing subscriptions, refreshes the schedule. Device consent is separate from account-wide mobile push preferences. Switching workspaces cancels the preceding workspace’s reminders.

Run `npm run test:macos:storage` for native snapshot persistence and bridge-origin checks.

## Windows test app

On Windows, install the root and desktop dependencies, then build the installer:

```sh
npm ci
npm --prefix windows ci
npm run test:windows
npm run build:windows
npm run test:windows:app
```

The output is `build/windows/Subloom-<version>-windows-x64-setup.exe` and its SHA-256 checksum. The app bundles the Expo web export in a sandboxed Electron shell and launches without Metro or a web server. Its stable app identity, `persist:subloom` browser session, and `subloom-app://bundle` origin retain the workspace across updates.

The installer is currently unsigned. Windows uses the app’s web capabilities; Mac local reminders and mobile push registration are not available on Windows. See the [Windows guide](../windows/README.md) for platform behavior, storage, and browser sign-in details.

## Android test APKs

The [Build Android test APK workflow](../.github/workflows/android-apk.yml) supports manual runs. Trusted PR and production checks also call it. Successful runs upload an `android-apk` artifact containing a standalone APK and SHA-256 checksum, retained for 14 days. The APK bundles JavaScript and needs no Metro server. It targets arm64 phones and x86_64 emulators.

It compiles in release mode with Expo’s test signing key. It cannot update an EAS/store-signed install. Use a spare device/emulator, or export guest records before uninstalling an existing copy. Store-signed builds continue through the manual EAS workflow and require the configured Expo token and signing credentials.

### Firebase build configuration

`google-services.json` is intentionally ignored. Keep it at the repository root for local native builds, or set `GOOGLE_SERVICES_JSON` to its file path. GitHub Android CI restores the encrypted repository secret into a private temporary file, validates the Android package, and deletes the temporary file after building. Fork PRs do not receive it; their shared source checks still run.

EAS has a secret file variable of the same name configured for development, preview, and production. Server service-account files remain outside app configuration and client bundles. Firebase client keys are still extractable from installed apps; API/application restrictions matter, and removing a tracked file does not revoke a key or erase Git history. See the [configuration cleanup record](firebase-config-secrets.md).

## Optional integrations

Core local tracking does not depend on these services. Provider features need their own setup and live verification:

| Integration                            | Current boundary                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Android push                           | FCM v1 credentials and Firebase/EAS build configuration are configured. Device delivery still needs verification.                     |
| iOS push                               | APNs setup and device delivery remain pending.                                                                                        |
| Email and Auth SMTP                    | Existing Resend setup uses its restricted test sender. A verified sender domain and `EMAIL_FROM` are required for general recipients. |
| Screenshot OCR                         | Requires a restricted server-side Vision credential, explicit processing consent, and a live OCR check.                               |
| Receipt forwarding                     | Requires the receiving domain, signed inbound/delivery webhooks, app-link configuration, and end-to-end delivery checks.              |
| Mailbox discovery and social callbacks | Require their provider OAuth settings, consent/callback configuration, and live checks.                                               |

Backend schema and server integrations are in `supabase/`. Deployment is a separate operation; running the app locally does not deploy migrations, functions, scheduler jobs, or provider configuration. Preserve existing server encryption, scheduler, and signing keys. Never commit credentials or put server-only values in client build configuration.

The focused app does not enable direct bank connections, automatic merchant cancellation, payment processing, or team/SSO screens. A saved billing note does not authenticate a bank or card. Review the [current scope](focused-subscription-tracker.md) before interpreting historical feature documents.

## Checks and releases

```sh
npm run check
npm run check:backend
npm run test:backend
npm run export:web
node scripts/build-brand.mjs --check
```

Run the checks appropriate to your changes. Backend checks use Deno. `npm run preview:emails` builds an illustrative HTML/plain-text gallery in `build/email-templates/` without loading credentials or sending messages; see [email templates](email-templates.md).

Pull requests run shared app/backend checks, all-platform JavaScript exports, the landing production build, both Mac builds, the Windows installer and app checks, and Android APK builds for trusted branches. Successful app workflows retain downloadable build artifacts for 14 days. Production pushes to `release-candidate` run verification before Release Please versioning. Manual deployments reject other branches.

Merging a version PR creates a stable release. The [release asset workflow](../.github/workflows/release-assets.yml) attaches Android APKs, the Windows x64 installer, Mac arm64/x64 app ZIPs, and their checksums after verification. It reuses build artifacts only when their source SHA matches the release tag; otherwise it rebuilds the exact tagged source. Automated releases call that workflow directly, while manually published releases also trigger it. A manual run can rebuild assets for an existing stable tag.

Release tags must match `vX.Y.Z`, belong to the `release-candidate` history, and agree with the package version. Older tags that predate Windows support do not gain newer Windows code under an older version number. Inspect the assets on the specific release; see [release download details](windows-release-downloads.md). The [earlier artifact guard record](release-artifact-guard.md) describes the preceding skip-only behavior.

Automated checks and bundles do not certify physical-device behavior or live provider delivery. Dependency audit findings in upstream Expo/React Native tooling were recorded in earlier readiness reports; check the current dependency tree before a store release rather than treating those dated counts as current.

## Contributor conventions

Follow [AGENTS.md](../AGENTS.md#branch-and-commit-naming). New work starts from `release-candidate`; stacked features use separate ready-for-review PRs against their predecessors and document merge order. Use the agreed purpose-based branch prefixes and Conventional Commits. Keep unrelated local work out of your commits.
