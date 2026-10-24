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

The output is `build/windows/Subloom-<version>-windows-x64-setup.exe` and its SHA-256 checksum. The installer targets Windows x64; Windows on ARM can use x64 emulation. CI builds and launches it on `windows-2025`.

## Data and sign-in

The installed app uses a stable `com.subloom.windows` identity, the `persist:subloom` browser session, and a fixed `subloom-app://bundle` origin. Guest workspaces, owner-specific snapshots, settings, and the app's PKCE verifier use the existing web persistence code. Installing an update retains that profile. The installer does not request administrator access or delete app data during uninstall.

The renderer has no Node or filesystem access. Bundled files are served through a custom protocol, browser permissions are denied by default, remote pages cannot replace the app window, and external links are limited to HTTPS. The preload exposes bounded browser-auth and local notification operations. Every operation checks the sending frame and app origin; arbitrary IPC, filesystem access and external navigation remain blocked.

Provider sign-in and mailbox consent open the system browser. The installer registers `subloom://`; only a matching callback for a pending request returns to the app. The shell pins Supabase OAuth requests to the native return address. The existing OAuth code then exchanges the code in the profile that created the verifier. A missing desktop bridge fails explicitly, and browser sign-in can be canceled from the app. Root-slash callback variants are accepted without relaxing the host or route checks. Keep `subloom://auth-callback` and `subloom://mailboxes` in the backend's allowed redirects, as for the existing native apps. No new OAuth provider secret is required.

Run `npm run test:desktop:oauth` to verify the hosted Google callback with a canceled public OAuth flow. It does not sign in, create an account, read management credentials, or exchange a session token. CI runs this before producing a Windows installer and exercises the exported sign-in screen through the preload and a simulated Windows return event. The browser's website session does not sign the desktop profile in automatically; start sign-in from the app.

## Windows system notifications

Settings → Reminders → Windows notifications enables local system reminders, including for guest workspaces. Use **Send a Windows test notification** to verify delivery and **Open Windows notification settings** if Windows blocks banners. Install with the NSIS installer so the Start Menu shortcut exists. The shell assigns its app identity and Electron toast activator to that shortcut.

Keep Subloom running or minimized: reminders stop when the process exits, and this implementation does not register a background service or receive mobile push. Up to 48 upcoming reminders are held in memory and refreshed after edits, workspace changes, on focus, and every five minutes. Windows sleep can delay alerts; alerts more than 15 minutes late are skipped to avoid a burst after waking.

Consent is stored per local workspace. Scheduled and visible alerts are removed on disable, sign-out, workspace change, navigation reload, and quit. Notification clicks open only validated internal routes belonging to the active workspace. The existing local planner preserves account timezone, quiet hours, trial/reminder preferences, privacy mode, and original currencies. Demo workspaces never schedule reminders. Only consent booleans persist in the desktop notification file; subscription text stays in the existing workspace store.

The Mac-specific widget and Android/iOS push registration remain separate platform features. Provider sign-in still depends on the existing backend/provider configuration.

## Release downloads

The GitHub workflow uploads the installer and checksum as `windows-x64`; a published stable release receives that installer alongside Android and Mac binaries. Release builds use the canonical `assets/icon.png` without changing the brand.

These Windows installers are currently unsigned. Windows may show an unknown-publisher/SmartScreen warning. Trusted publisher signing requires a Windows signing certificate or signing service. The existing Android APK uses the Expo test key, and the Mac app is ad-hoc signed without Apple notarization. These are downloadable test builds, not store-signed releases.
