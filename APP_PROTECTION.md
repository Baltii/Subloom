# App protection

Settings → Security controls a device-local app lock. PIN and passkey protection start disabled. Users can enable either method, use both as alternatives, change their PIN, disable either method after verifying an existing method, or lock immediately. Disabling the last method removes the launch challenge.

Protection covers every workspace on the installation, including guest mode and signed-out data. It remains enabled across account changes, exports, sync, and local workspace resets. It is separate from Supabase sign-in and does not change account authentication or backend permissions.

## Lock behavior

- A cold start waits for protection settings before mounting protected screens, navigation, dialogs, toasts, or update notices.
- iOS/Android lock when AppState leaves `active`. Web locks on page visibility changes and page hiding. Desktop shells also send a background event on app/window deactivation.
- Notification navigation waits until hydration and unlocking complete. Deep links still enter through the same root gate.
- Locking unmounts protected screens, including open dialogs. Unsaved screen-local form state is discarded; saved data remains intact.
- Unlocking, changing or disabling security methods requires a valid existing PIN or signed passkey assertion. No unlock flag is persisted.
- Storage errors or malformed settings keep the app closed and provide a retry action. Verification results arriving after a new background event cannot unlock the app.

## PIN

PINs are exactly six ASCII digits, entered twice on setup. They are never stored directly. Each PIN has a cryptographically random 128-bit salt and a 256-bit PBKDF2-SHA256 verifier with 600,000 iterations. Comparison does not exit at the first different character.

The fifth wrong attempt starts a 30-second wait. Subsequent failures double it, up to 15 minutes. Attempt counts and deadlines persist across restarts. Successful PIN or passkey verification clears them. Passkey verification remains available during PIN cooldowns.

There is no unauthenticated PIN reset. A user who forgets the PIN can unlock with their enabled passkey, then change it. Without either method, resetting installation/browser data may be necessary and can lose guest data. Encourage a backup unlock method before enabling protection.

## Passkeys and platform availability

Passkeys currently use WebAuthn in supported secure web browsers. Registration requests a discoverable ES256 credential with required user verification. Enrollment is saved only after an assertion proves possession. Assertions verify a new random challenge, expected origin and RP ID, credential ID, presence/verification flags, counter progression when used by the authenticator, and an ECDSA signature against the stored public key. Private keys remain with the authenticator/password manager.

Passkeys are scoped to the browser origin and this local installation. They do not sign users into a Subloom account or sync app-lock settings across devices. Removing passkey protection stops Subloom from accepting that credential; users can separately remove it from their password manager.

The native iOS/Android builds, WKWebView Mac shell and Electron Windows shell currently expose PIN protection only. The UI marks passkeys unavailable rather than presenting a biometric check as a passkey. Supporting native passkeys requires a native credential provider integration and a verified HTTPS relying-party domain with Apple associated-domain and Android asset-link configuration. Rebuild desktop shells for their new secure-storage bridge operations.

## Storage and security boundary

Mobile uses Expo SecureStore (device-only, when-unlocked Keychain accessibility on iOS). macOS uses a dedicated Keychain item. Windows encrypts the configuration with Electron safeStorage and atomically replaces a dedicated file in the user's app-data folder. Browsers store the verifier/public key configuration in localStorage. Secrets are separate from workspace snapshots, exports, and synced preferences.

This is an application privacy gate, not data-at-rest encryption or a substitute for OS account/device security. Subscriptions and cached account sessions retain their existing storage and sync behavior. Someone who controls the OS account, browser development tools, or same-origin script execution can bypass a local gate. Clearing browser storage also removes its local protection. Backend sync and reminders continue while the UI is locked.

## Verification

- `npm run check`: repository policy, TypeScript, ESLint, and the full test suite. App-lock tests cover crypto compatibility, persistence, cooldowns, reauthentication, storage failures, cancellation, and background races. Passkey tests use real ECDSA signatures with simulated WebAuthn responses, including negative challenge/origin/RP/flag/signature/counter cases.
- `npm run test:windows`: includes secure-storage persistence, encryption unavailability, corrupted files, and failed-write preservation tests. Encryption transport is simulated in these tests; Windows DPAPI still needs a Windows-device check.
- Export web and mobile bundles, compile the Mac bridge, and inspect Settings → Security at desktop and phone widths. Native secure storage and real authenticator prompts must also be exercised on physical target devices before release.

References: [WebAuthn specification](https://www.w3.org/TR/webauthn-3/), [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).
