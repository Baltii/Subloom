# App protection

Settings → Security controls a device-local app lock. PIN and passkey protection start disabled. Users can enable either method, use both as alternatives, change their PIN, manage a recovery code, disable either method after verifying an existing method, or lock immediately. Disabling the last method removes the launch challenge and revokes its recovery code.

Protection covers every workspace on the installation, including guest mode and signed-out data. It remains enabled across account changes, exports, sync, and local workspace resets. It is separate from Supabase sign-in and does not change account authentication or backend permissions.

## Lock behavior

- A cold start waits for protection settings before mounting protected screens, navigation, dialogs, toasts, or update notices.
- iOS/Android lock when AppState leaves `active`. Web locks on page visibility changes and page hiding. Desktop shells also send a background event on app/window deactivation.
- Notification navigation waits until hydration and unlocking complete. Deep links still enter through the same root gate.
- Locking unmounts protected screens, including open dialogs. Unsaved screen-local form state is discarded; saved data remains intact.
- Backgrounding also remounts the lock screen, clearing partial PIN/recovery input and any freshly displayed recovery code from its transient state. Copy/save the recovery code before switching away; after a reset, the new PIN still works if the on-screen code was dismissed.
- Unlocking, changing or disabling security methods requires a valid existing PIN or signed passkey assertion. No unlock flag is persisted.
- Storage errors or malformed settings keep the app closed and provide a retry action. Verification results arriving after a new background event cannot unlock the app.

## PIN

When both methods are enabled, the lock screen first offers Passkey or PIN. A single enabled method opens directly to its screen. PIN entry uses one accessible numeric password input behind six masked cells, supporting paste, keyboard editing and automatic verification after the sixth digit. Settings and recovery require explicit confirmation before changing credentials.

PINs are exactly six ASCII digits, entered twice on setup. They are never stored directly. Each PIN has a cryptographically random 128-bit salt and a 256-bit PBKDF2-SHA256 verifier with 600,000 iterations. Comparison does not exit at the first different character.

The third wrong PIN blocks PIN verification for exactly ten minutes, including after restart. After the deadline, a new set of three attempts is available. PIN-only protection shows “3 attempts wrong. Try again later.” With both methods, it shows “3 attempts wrong. Try another method.” and a passkey action. Successful PIN or passkey verification clears the PIN block. Duplicate input events and rerenders do not submit the completed PIN again.

## Recovery without an unauthenticated bypass

First-time protection setup generates a cryptographically random 128-bit recovery code, displayed once as eight groups of four hexadecimal characters. Only a domain-separated SHA-256 verifier is saved. The code itself is not synced, exported, logged, or retained in storage. Users explicitly copy/save it to a password manager or another safe location. Existing installations can create a code in Settings after unlocking and verifying their current PIN or passkey; a previously missing code cannot be invented while locked.

“Can’t unlock?” offers another enabled method or a saved recovery code. Recovery requires a valid code and a confirmed new six-digit PIN. A single write replaces the old PIN, revokes the old local passkey, consumes the old recovery code, clears PIN lockout, and stores a fresh recovery verifier. The app stays locked; after saving the replacement recovery code, users unlock normally with their new PIN. No account session or support override authorizes a reset. A canceled or failed write never reports successful recovery or changes the active credentials.

Recovery guesses have an independent three-attempt, ten-minute block that does not block known PIN/passkey methods. Browser credential operations use an origin-wide Web Lock and reread the current record under it, preventing concurrent tabs from reusing a consumed code. Secure browsers with Web Locks are required for browser app protection. Native shells use their single app instance. Format version 2 accepts/migrates version 1 without granting it a recovery code; older clients fail closed on the new record rather than silently dropping recovery fields. The original storage key is retained so an older client cannot mistake protection for a new empty installation.

If every method and the saved recovery code are lost, there is no supported bypass to protected local data. Synced account data can be accessed after normal account authentication on another device. Unsynced data cannot be recovered through support. This is explained before setup and in the locked recovery help, without suggesting that clearing the lock alone can safely recover data.

## Passkeys and platform availability

Passkeys currently use WebAuthn in supported secure web browsers. Registration requests a discoverable ES256 credential with required user verification. Enrollment is saved only after an assertion proves possession. Assertions verify a new random challenge, expected origin and RP ID, credential ID, presence/verification flags, counter progression when used by the authenticator, and an ECDSA signature against the stored public key. Private keys remain with the authenticator/password manager.

Passkeys are scoped to the browser origin and this local installation. They do not sign users into a Subloom account or sync app-lock settings across devices. Removing passkey protection stops Subloom from accepting that credential; users can separately remove it from their password manager.

The native iOS/Android builds, WKWebView Mac shell and Electron Windows shell currently expose PIN protection only. The UI marks passkeys unavailable rather than presenting a biometric check as a passkey. Supporting native passkeys requires a native credential provider integration and a verified HTTPS relying-party domain with Apple associated-domain and Android asset-link configuration. Rebuild desktop shells for their new secure-storage bridge operations.

## Storage and security boundary

Mobile uses Expo SecureStore (device-only, when-unlocked Keychain accessibility on iOS). macOS uses a dedicated Keychain item. Windows encrypts the configuration with Electron safeStorage and atomically replaces a dedicated file in the user's app-data folder. Browsers store the verifier/public key configuration in localStorage. Secrets are separate from workspace snapshots, exports, and synced preferences.

This is an application privacy gate, not data-at-rest encryption or a substitute for OS account/device security. Subscriptions and cached account sessions retain their existing storage and sync behavior. Someone who controls the OS account, browser development tools, or same-origin script execution can bypass a local gate. Clearing browser storage also removes its local protection. Backend sync and reminders continue while the UI is locked.

## Verification

- `npm run check`: repository policy, TypeScript, ESLint, and the full test suite. App-lock tests cover crypto compatibility, persistence, exact three-attempt/ten-minute cooldowns, reauthentication, masked/method-choice rendering, storage failures, cancellation, background races, recovery consumption/rotation, legacy migration and concurrent-tab replay. Passkey tests use real ECDSA signatures with simulated WebAuthn responses, including negative challenge/origin/RP/flag/signature/counter cases.
- `npm run test:windows`: includes secure-storage persistence, encryption unavailability, corrupted files, and failed-write preservation tests. Encryption transport is simulated in these tests; Windows DPAPI still needs a Windows-device check.
- Export web and mobile bundles, compile the Mac bridge, and inspect Settings → Security at desktop and phone widths. Native secure storage and real authenticator prompts must also be exercised on physical target devices before release.

References: [WebAuthn specification](https://www.w3.org/TR/webauthn-3/), [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/), [OWASP recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
