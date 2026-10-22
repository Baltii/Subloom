# Subloom for Windows

The Windows app packages the existing Expo web export in a sandboxed Electron shell. Android continues to use Expo's native Android project; macOS keeps the existing Swift/WebKit app. Windows does not require a running web server or an Expo account to launch.

## Build on Windows

Use the Node version in `.nvmrc`, then run from the repository root:

```sh
npm ci
npm --prefix windows ci
npm run test:windows
npm run build:windows
npm run test:windows:app
```

Set the same public `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_EAS_PROJECT_ID` values used by the existing app. Only public app configuration belongs in the export. Windows tools have their own lockfile so Electron is not installed for Android, Mac, or website builds.

The output is `build/windows/Subloom-<version>-windows-x64-setup.exe` and its SHA-256 checksum. The installer targets Windows x64; Windows on ARM can use x64 emulation. CI builds and installs it on `windows-2025`, launches the installed app, reinstalls it, and checks both running-process detection and workspace persistence.

## Data and sign-in

The installed app uses a stable `com.subloom.windows` identity, the `persist:subloom` browser session, and a fixed `subloom-app://bundle` origin. Guest workspaces, owner-specific snapshots, settings, and the app's PKCE verifier use the existing web persistence code. Installing an update retains that profile. The installer does not request administrator access or delete app data during uninstall.

The renderer has no Node or filesystem access. Bundled files are served through a custom protocol, browser permissions are denied by default, remote pages cannot replace the app window, and external links are limited to HTTPS. The preload exposes only a bounded browser-auth operation.

Provider sign-in and mailbox consent open the system browser. The installer registers `subloom://`; only a matching callback for a pending request returns to the app. The existing OAuth code then exchanges the code in the profile that created the verifier. Keep `subloom://auth-callback` and `subloom://mailboxes` in the backend's allowed redirects, as for the existing native apps. No new OAuth provider secret is required.

Windows uses the app's web capabilities. The Mac-specific widget, local notification bridge, and Android/iOS push registration are not Windows features. Provider sign-in still depends on the existing backend/provider configuration.

## Release downloads

See [release workflow details](../feature-docs/windows-release-downloads.md). The GitHub workflow uploads the installer and checksum as `windows-x64`; a published stable release receives that installer alongside Android and Mac binaries. Release builds use the canonical `assets/icon.png` without changing the brand.

These Windows installers are currently unsigned. Windows may show an unknown-publisher/SmartScreen warning. Trusted publisher signing requires a Windows signing certificate or signing service. The existing Android APK uses the Expo test key, and the Mac app is ad-hoc signed without Apple notarization. These are downloadable test builds, not store-signed releases.

## CrossOver process detection

The installer checks the native process table for `Subloom.exe`. CrossOver can provide a PowerShell stub that returns success for every command, which caused the original installer to report a running app even in a fresh bottle. The native check avoids that false positive. If Subloom is actually running, close it and choose Retry; a silent installer returns exit code 2. Process-inspection errors stop with exit code 3. Installation does not force-close a workspace.

The Windows CI test now exercises the actual installer: fresh installation, guest setup and restart, reinstallation with the app closed, refusal while the installed app is running, and reinstallation after closing it with guest data retained. CrossOver compatibility of the installer does not establish compatibility of Electron's full Chromium runtime; the supported Windows checks run on real Windows.
