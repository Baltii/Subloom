# Test and device runbook

## Checks executed

On 2026-10-09, TypeScript and ESLint passed, **141 Vitest tests passed**, all **ten Edge Functions** passed Deno checks, and **10 provider/auth/webhook tests passed**. The updated Mac shell compiled and passed strict code-signature verification. The configured Resend server key was absent from all 97 latest Mac/web/iOS/Android assets; see `docs/verification/bundle-secrets.json`.

**20 live checks passed** against hosted Supabase Auth, PostgREST, Realtime and Edge Functions using two disposable accounts and a second session for one account. These covered OTP verification/refresh/logout, same-account create/update/delete propagation, owner-protected Realtime markers, RLS isolation, stale-write conflicts, push token/account rotation, malformed test-push requests, cloud export and account deletion. Cleanup completed with no leftover test accounts. The OTPs were generated administratively; this does not test SMTP delivery. See `docs/verification/live-smoke.json`.

Three hosted jobs are active (`docs/verification/scheduler.json`). Both workers rejected missing cron credentials with 401 and accepted the private cron credential with 200; the empty-queue execution recorded no failures (`docs/verification/workers.json`). Security advisors returned three warnings for intentional authenticated SECURITY DEFINER RPCs and no errors; see [security review](SECURITY.md).

EAS project ownership was verified. iOS and Android had no signing/push credentials. Public build settings are configured for all environments (`docs/verification/eas-config.json`); no signed iOS/Android binary or physical-device push test has run. The automated suites sent no email, push, OCR or inbound forwarding. A separate user-requested Supabase SMTP test to the user’s Gmail address succeeded using Resend’s temporary test sender; Resend reported delivered and the original sender was restored. The configured subloom.io sender remains blocked until domain verification. See `docs/verification/smtp.json`. Mac notifications are disabled by request.

Browser checks verified tracking, searchable selectors/calendar pickers and Settings at desktop and 390px phone widths. Screenshots are in `docs/screenshots`. The latest Settings check preserved the existing sample workspace. Expo dependency compatibility passed earlier, and the latest web/iOS/Android bundle exports passed after the sync changes; bundle exports do not prove native compilation or device storage/permission behavior.

## Hosted automation

After CLI login and `npm run deploy:supabase`, run `npm run test:live`. It creates two uniquely tagged, disposable Auth accounts, generates their OTPs without sending mail, tests real OTP verification/refresh/logout, same-account second-device sessions, Realtime owner isolation and deletion markers, CRUD, idempotency, conflicts, malformed input, push-device registration ownership, worker restrictions, Edge Function authentication, cloud export and account deletion. It cleans up only accounts created by its own run and records credential-free results in `docs/verification/live-smoke.json`.

The script obtains a server key through the authenticated CLI in process memory. Alternatively, set `SUBLOOM_SERVER_ENV_FILE` to a private file containing `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`. Never use a public build variable for that key. The test accounts use non-deliverable addresses and suppress email; synthetic push tokens never enter the delivery queue. Provider delivery, SMTP templates, resend/expiry UX and offline Mac workflows require the acceptance steps below. A failed live test is a failed check, not evidence of deployment readiness.

## Automated local checks

```sh
npm ci
npm run check
npm run check:backend
npm run test:backend
EXPO_OFFLINE=1 npx expo install --check
EXPO_OFFLINE=1 npx expo export --platform all
npm audit
```

Domain tests cover minor-unit/rational calculations, USD/TND/JPY precision, anchored January-31 billing, leap years, quarters/custom intervals, overrides, trial transitions, paid-through cancellations, DST/local time, quiet hours, reminder IDs, deterministic classification, untrusted HTML, duplicate evidence and ambiguous plans/prices. Store tests cover durable outbox/data commits, queued revisions, concurrent writes, quota failure, guest upgrade and identity isolation. Database tests cover real SQL RLS/ownership, CRUD/idempotency/conflicts, malformed inputs, atomic candidate confirmation/rollback, reminder invalidation, delivery leasing, webhook replay, rate limits, push ownership and cascading deletion. Ten sync regressions test account switches during upload/pull, offline retry, torn-snapshot prevention, concurrent local edits, conflict strategies and listener cleanup. Twelve notification tests cover safe routes, silent permission refresh, Android channel ordering, Expo token rotation, scoped consent and listener cleanup. Backend tests mock HTTP at the provider boundary and test sanitized failure behavior, push privacy, signatures, size limits and signed digest opt-out; they do not send anything.

## Native E2E

Install Maestro from its [official documentation](https://docs.maestro.dev/) and use a **disposable preview build/emulator**, not a personal workspace. `guest-tracking.yaml` clears the app's local state. iOS keychain credentials can outlive app data reset; use a clean simulator or ensure the test is signed out first. Prefer an EAS preview/simulator build containing the JS bundle so the development-client launcher does not interrupt the flow.

```sh
maestro test tests/e2e/guest-tracking.yaml
maestro test tests/e2e/receipt-review.yaml
maestro test -e SUBSCRIPTION_ID=YOUR_STAGING_UUID -e SUBSCRIPTION_NAME=YOUR_STAGING_NAME tests/e2e/reminder-deep-link.yaml
```

The YAML files are supplied but **not executed** here. Adjust selectors only after inspecting the native accessibility hierarchy; labels and stable test IDs are included. The routing flow alone does not prove push delivery. Add receipt file/photo fixture tests using the native picker on each OS, including canceled selection, an oversized image, invalid MIME and a denied permission.

## Staging cloud acceptance

Use a dedicated project, two verified staging accounts and non-sensitive fixtures. Keep SMTP/provider keys in server configuration.

1. Request/verify OTP, test invalid/expired code, resend, foreground token refresh and logout. Connect an account with guest subscriptions; import explicitly, retry import and check it creates one copy while preserving the guest workspace.
2. Create/edit/delete from account A and read from account B using the normal anon client. Confirm B sees none of A's data, direct writes fail, forged ownership fails and no service-role key exists in the client.
3. Go offline, make two edits and terminate/restart. Reconnect and verify the outbox drains once, totals remain correct and no operation is dropped. Edit the same row on a second device; resolve both cloud/local strategies explicitly.
4. Create a forwarding alias, send the receipt fixture from a staging sender, and verify one pending candidate. Replay the signed event; send a screenshot/text version with matching evidence; confirm no duplicate candidate/subscription. Revoke/expire the alias and ensure it accepts no new receipts. Tamper with/stale the webhook signature and verify 401.
5. Configure Vision and import a non-sensitive screenshot; accept consent, verify OCR and editable review. Test unsupported image types, size/rate limits, missing key, provider timeout and malformed responses. Missing fields must remain required.
6. Enable verified email reminders. Use a subscription renewing tomorrow, one-day reminder, timezone `UTC`, an already reached reminder hour and disabled quiet hours (`start=end`). Invoke the cron endpoints from a secure operator environment or wait for the installed jobs. Check event/delivery status and receive the actual test email. Replay dispatch; ensure one provider ID. Edit/pause immediately before send and verify suppression.
7. Test bounce/complaint webhook signatures and suppression, email change to an unverified destination, weekly-digest opt-in/opt-out, no mutation on GET, signed-token expiry and idempotent unsubscribe POST.
8. Export and compare all cloud pages, then delete **only the disposable staging account**. Verify cascading subscriptions/candidates/deliveries/aliases are gone, other user's records remain, cached data is cleared locally, and other offline-device cache limitations are disclosed.

## Real push and simulated payload

On an actual iPhone and Android device with configured APNs/FCM, install the staging build, sign into the staging account and enable Mobile push reminders and register each phone. Send a test notification from Settings; verify that the worker dispatches it and the device receives it. Turn off only one device and confirm another remains enabled. Register a token; test denial and later OS re-enablement. Use the scheduler scenario above for actual renewal/trial/high-threshold notifications on two devices. Verify Expo tickets **and receipts**, then tap the notification and confirm the correct subscription opens while foregrounded, backgrounded and cold-started.

For an isolated transport/navigation test, use Expo's official [push notification tool](https://expo.dev/notifications) with the **staging device token** and a non-sensitive body. Use `data: {"path":"/subscription/YOUR_STAGING_UUID"}`. If enhanced push security is enabled, use a scoped backend request instead of disclosing its access token in a public tool. This is a test push, not evidence the scheduler has run. Never embed service keys or personal receipt data in test payloads.

Test expired device tokens and malformed provider responses. Force a staging timeout and inspect `unknown` push outcomes; don't force blind retry after uncertain acceptance. Change privacy mode and confirm the lock screen hides merchant/price. Verify local reminders do not produce duplicates: this app intentionally uses the server as the only reminder authority.

## Device/accessibility matrix

| Scenario                                                 | Required evidence                                                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Small Android phone; notched/Dynamic Island iPhone; iPad | Safe areas, scrolling, keyboard avoidance, tab/header controls and long values visible                            |
| VoiceOver/TalkBack                                       | Meaningful labels, focus order, form errors and switches; details/actions usable without swiping                  |
| Maximum practical font size                              | No clipped price, button, heading or date; forms and dialogs scroll appropriately                                 |
| Reduced motion                                           | No decorative entrance/press scaling/navigation slide; swipe unavailable but equivalent Details actions remain    |
| System/light/dark                                        | Appearance persists, follows OS in system mode, maintains contrast                                                |
| Airplane mode / weak network                             | Cached home/list, durable saves, clear pending/conflict indicator, no fake delivery                               |
| Termination/background/foreground                        | Data/outbox survive, listeners don't duplicate, auth refresh and notification navigation recover                  |
| Large subscription list                                  | Virtualized list/search remain responsive; measure on physical devices rather than claiming 60 FPS from a browser |

Record model, OS version, build commit, screenshots, provider IDs and results without receipt text, email destinations or credentials. Store device/provider validation evidence alongside the release checklist.
