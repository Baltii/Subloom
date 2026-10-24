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
