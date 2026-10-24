# Pro membership experience

This feature preserves the unfinished local membership work and reconciles it onto the six-PR mobile/Pro UX stack. Base: `feat/personalized-home-greeting` (#72). Merge #67 → #68 → #69 → #70 → #71 → #72 before this PR.

## Behavior

- Account/sidebar badges use current verified workspace access and update at expiry.
- Membership details show trial/paid pricing, billing dates, tracking status and period-end cancellation with explicit confirmation. Automatic refresh and a visible error retry keep recovery available.
- Confirmed processor data creates one managed Subloom Pro subscription through the existing durable save/outbox path. Original EUR prices and account-timezone dates are retained; no payment transaction is fabricated. Notes/reminder choices survive updates.
- Billing-managed dates/status cannot be manually overwritten through list actions, editors or the cancellation assistant. Management routes open the Pro page. Removing the tracking entry does not cancel billing, and suppression survives later refreshes/sync.
- Renewal cancellation schedules an access-ending reminder instead of an upcoming-charge message. Existing channel consent, quiet hours, privacy and delivery validation continue to apply.
- Direct cancellation is authenticated, uses the existing billing lease, confirms the canonical processor result and keeps current-period access. Flexible-billing portal `cancel_at` schedules are recognized without sending another cancellation mutation.
- The earlier themed/compact membership card, canonical brand geometry, closable upgrade modal, navigation, filter sheets, icon view controls and greeting are retained. Duplicate illustration/card changes were reconciled; no dependency changes are included.

## Verification

- `npm run check`: passed; 62 test files / 372 tests, including owner isolation, exact expiry, refresh de-duplication, cancellation identity, marker-storage failure, managed-field protection, deletion suppression, schema constraints and reminder/date semantics.
- `npm run check:backend`: passed.
- `npm run test:backend`: passed; 38 tests, including cancellation preservation/idempotency, portal scheduling, unrecognized plans and processor failure.
- `npm run test:windows`: passed; 9 tests.
- `node scripts/expo.mjs export --platform all --max-workers 2`: passed for web, iOS and Android.
- `node scripts/build-brand.mjs --check`: passed; 30 vector/token/component exports and 63 manifest entries.
- Adaptive web review: 320/390/1440/1940px, blue/light and violet/dark, signed-out membership page, contextual full-screen gate and Escape dismissal. Independent finish review: ship within web/source scope. Paid membership/cancellation runtime, live provider/Stripe flows, native hardware and OS reduced motion were not exercised.

## Rollout

No live changes were deployed. After merging the stack, apply `20261023204406_pro_plan_ending_reminders.sql`, then deploy the affected `pro-billing`, `stripe-webhook`, `delete-account`, `schedule-reminders` and `send-reminder` functions before releasing the client. `send-reminder` consumes the shared updated models, reminder rules and email templates. The status response's tracking field is optional for older backend responses; direct cancellation needs the updated billing endpoint.

The unrelated `bun.lock`, `landing/bun.lock` and `landing/.openai/` files remain outside the commits. A source/asset backup of the original local edits was retained at `/private/tmp/subloom-membership-backup`.
