# Test and device runbook

## Checks executed

On 2026-10-09, application TypeScript and ESLint checks passed, 111 Vitest tests passed, nine Edge Functions passed Deno checks, and 10 provider/auth/webhook tests passed. Expo dependency compatibility check passed. `expo export --platform all` produced web JavaScript and iOS/Android Hermes bundles successfully. This is a **bundle export**, not a signed native build.

Browser testing verified labeled-sample onboarding, manual creation, renewal-date editing, restart/reload persistence, text receipt extraction, editable confirmation, missing-field validation, safe dismissal and phone-sized layout. Screenshots are in `docs/screenshots` when captured. No real private receipt or account was used.

No full Supabase instance, physical devices, iOS/Android native binaries, EAS cloud build or Maestro test has run here. No live email, push, OCR, Apple/Google OAuth or mailbox access was exercised. SQL integration tests execute the actual migrations and RPC in PostgreSQL WASM (PGlite), with test auth roles and identity context; Supabase Auth/PostgREST and mobile storage implementations require separate integration validation.

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

Domain tests cover minor-unit/rational calculations, USD/TND/JPY precision, anchored January-31 billing, leap years, quarters/custom intervals, overrides, trial transitions, paid-through cancellations, DST/local time, quiet hours, reminder IDs, deterministic classification, untrusted HTML, duplicate evidence and ambiguous plans/prices. Store tests cover durable outbox/data commits, queued revisions, concurrent writes, quota failure, guest upgrade and identity isolation. Database tests cover real SQL RLS/ownership, CRUD/idempotency/conflicts, malformed inputs, atomic candidate confirmation/rollback, reminder invalidation, delivery leasing, webhook replay, rate limits, push ownership and cascading deletion. Backend tests mock HTTP at the provider boundary and test sanitized failure behavior, push privacy, signatures, size limits and signed digest opt-out; they do not send anything.

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

On an actual iPhone and Android device with configured APNs/FCM, install the staging build, sign into the staging account and enable push. Register a token; test denial and later OS re-enablement. Use the scheduler scenario above for actual renewal/trial/high-threshold notifications on two devices. Verify Expo tickets **and receipts**, then tap the notification and confirm the correct subscription opens while foregrounded, backgrounded and cold-started.

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
