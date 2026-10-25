# Subloom in-app updates

## Delivery plan

1. Ship a fixed verification key and signed, stable-release manifest. Validate versions, source commit, platform, download location, length and hashes before accepting a release.
2. Add Windows NSIS updates using electron-updater and Mac updates using Sparkle. Preserve existing app identities and storage locations. Download in the background; restart/install only after a user action.
3. Add compatible Expo updates on iOS/Android. Offer complete APK updates only to the GitHub test-signed Android distribution; the Android installer enforces signing compatibility and asks the user to confirm.
4. Publish verified installer artifacts first and signed manifests last. Expose version, checks, progress, errors and restart actions in Settings. Test tampering, incomplete releases, old versions, platform mismatch, offline failures and data preservation.

## Trust and release operations

`updates/trust.json` contains the public Ed25519 verification key. The private 32-byte seed is stored in the encrypted GitHub Actions secret `SUBLOOM_UPDATE_SIGNING_SEED`; a local recovery copy is in the ignored `.update-keys/` directory. Back that copy up securely. Never commit, print, upload as an artifact or embed the private seed in an app. Key rotation needs a transition release trusted by already installed clients.

The release workflow uses the existing reviewed release-tag/commit checks and only signs artifacts produced by successful verification jobs. The signed JSON manifest binds the exact artifact bytes and repository URLs to a stable version. Sparkle uses architecture-specific feeds and archive signatures from the same key. Windows verifies the signed manifest and rechecks the downloaded installer before allowing restart. The updater cannot accept a URL from the renderer.

Existing installations require one manual installation of the updater-enabled release. After that, updates replace application files and preserve stored subscriptions, settings and authentication. Old, incomplete or unsigned releases are never offered for automatic installation. Failed downloads leave the installed app usable.

Mac archives keep the existing bundle identifier and sandbox container. Developer ID signing/notarization and Windows Authenticode publisher signing remain separate distribution improvements; the update archive signatures do not remove OS publisher warnings.

Expo updates use the existing EAS project, separate production/preview/test channels and fingerprint runtime compatibility. Native API changes require a new binary. Publishing an Expo update needs an authorized Expo account/token; this feature does not purchase a plan or publish an OTA update by itself. Compatible downloaded updates are applied on user-requested reload or a later launch.

No update automatically clears user storage, removes an existing app, changes Pro ownership, signs a user out or interrupts an editor to restart. Browser users receive deployments through normal page refreshes.

## First release and later updates

Merge the stack in order: protocol, desktop, mobile, then Settings/release integration. The next release must run the updated verification and asset workflow. It uploads the Windows `latest.yml` beside its installer and publishes `subloom-updates.json` plus both Mac appcasts only after all four installer artifacts are available. A failed build or missing signing secret prevents feed publication. Install that release once on existing devices; earlier binaries cannot gain a native updater from a web deployment.

At every launch, Subloom checks for a compatible update and offers a bottom notice with **Update now** and **Later**. Downloads show their current state and available progress, and do not block use of the app. Windows uses differential downloads when a blockmap is available, falling back to the full installer; the final installer still passes the signed-release checks. Browser exports include `app-version.json` so open tabs can detect newer releases without reloading automatically.

You can also use **Settings → App updates**. Windows checks and downloads a verified installer; Mac opens Sparkle’s native update window; direct Android APK builds download a verified APK and open Android’s installer. Downloads never uninstall the current app. Declining installation leaves the current app available. Save or discard editor drafts first. The browser offers a normal refresh.

For EAS/store iOS and Android builds, configure an authorized `EXPO_TOKEN` repository secret for the existing Expo project before running **Publish compatible mobile app update** on `release-candidate`. That manual workflow tests the source and publishes to the `production` channel using EAS production environment variables and fingerprint runtime matching. Preview builds use the `preview` channel. Native dependency/configuration changes need a new binary; this workflow does not make store/native replacements automatic. GitHub test APK builds disable OTA and use only their own installer feed.

Release smoke test on spare devices: install the updater-enabled bootstrap, create a subscription and a draft, publish a newer verified release, confirm the update is detected, confirm the draft blocks restart, save it, install, and verify subscriptions/preferences/session survive reopening. Also test declining Android’s prompt, going offline, interrupted downloads, and the supported Mac architectures. Local signature/protocol tests and package builds do not replace this two-version device test.
