# Standalone Mac test app

The updated local app is `build/Subloom-update.app`. Quit the running Subloom copy before opening it, because both share one bundle identifier and loopback port. The original `build/Subloom.app` is preserved. Open it in Finder or run:

```sh
open build/Subloom-update.app
```

It contains the exported interface, fonts and assets and runs without Metro or a browser tab. The Supabase URL and public key from `.env.local` are bundled at build time. Guest tracking and pasted-text receipt review work locally; cloud sync and account features require the hosted migrations and functions. The hosted schema and functions are now deployed; live same-account sync and ownership tests passed. This build does not itself deploy Supabase.

## Rebuild

Use `npm run build:macos -- --update` to build a separate replacement while the original is running. Quit Subloom before rebuilding the original path with `npm run build:macos`. On this Mac, full Xcode is installed at `/Applications/Xcode.app`; the script uses it without changing the system developer-directory setting.

```sh
npm run build:macos
npm run open:macos
npm run test:macos
```

The binary targets the build machine's architecture, requires macOS 14+, and is signed locally with an ad-hoc identity. It is for testing on this Mac. Distribution to other Macs requires Apple Developer signing, notarization and separate validation. Xcode project generation, EAS and iOS Simulator are not required for this shell.

## Storage and permissions

An AppKit window hosts WKWebView with its persistent website data store. Guest data and Auth sessions use the app's web storage, separate from the localhost:8081 browser preview. Closing and reopening the same bundle identifier preserves its data. This is web storage, not the mobile SQLite/SecureStore implementation.

The sandboxed asset server binds only `127.0.0.1:48187`. Its origin stays fixed so web storage remains stable. It serves bundled public assets, rejects writes, unexpected Host headers and path traversal, and exposes no native JavaScript bridge or privileged API. A second copy cannot claim the same port; quit the existing copy before opening another.

Receipt file selection uses the native file panel; export uses the native save panel. The app has sandbox network access and user-selected file access. External HTTPS and mail links open through macOS. Mac system notifications are disabled by request. Mobile push, share extensions, native SQLite, Keychain session storage and iOS/Android permissions are outside this shell's scope. Email reminders can work after server/provider configuration.

## Verification

On 2026-10-09, the Swift build and strict code-signature verification passed. The installed sandboxed app launched and displayed the bundled onboarding interface. The automated loopback checks are recorded in `docs/verification/macos-server.json`.

Hosted authentication/CRUD and Realtime passed live backend checks. Interactive Mac account login/offline recovery, actual SMTP/OCR delivery, native file import/export and restart persistence still need acceptance testing. The updated bundle compiled and was signature-verified; its running user workspace was not interrupted to launch a second copy. The existing domain/store/SQL/provider suites validate shared logic but are not evidence these Mac integrations have run.
