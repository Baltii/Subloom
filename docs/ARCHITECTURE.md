# Subloom architecture & executable sequence

## Feasibility and boundaries

Expo SDK 57 (React Native 0.86, React 19.2) is the current stable SDK at implementation time. SDK-compatible native packages are resolved with `expo install`. Production push notifications require a development/production build, EAS project ID, APNs/FCM credentials, and permission. The web preview implements tracking but cannot receive native push.

The app cannot cancel a merchant subscription or inspect other apps' subscriptions. Provider account links and recording cancellations are explicit, separate actions. There is no bank access. Receipt scanning is opt-in; all detections are pending and editable until confirmed. No AI extractor is used.

## Structure

- Expo Router screens in src/app; reusable accessible token-based UI.
- Pure domain modules: calendar-date recurrence with Temporal, integer minor-unit/rational money, deterministic detection, timezone-aware reminder planning.
- A single durable local snapshot per identity (SQLite on native, browser storage on web) includes data and an outbox in the same commit. Guest mode works without credentials. Zustand handles UI and durable state; TanStack Query orchestrates server synchronization.
- Supabase owns authenticated remote data. An idempotent transactional RPC applies outbox operations with optimistic version checks. Conflicts are surfaced, never silently overwritten. Guest migration preserves the original guest snapshot.
- Supabase RLS restricts every user-owned table. Server-only ingestion/delivery tables cannot be changed by clients.
- Server jobs create versioned deterministic notification events and leased per-channel deliveries. Resend idempotency and Expo receipts handle provider delivery outcomes. Push does not offer exactly-once delivery across a crash immediately after provider acceptance; uncertain results are recorded for inspection.

## Implementation order

1. Scaffold, tokens, routing, onboarding, responsive home and reusable cards.
2. Calendar/money tests, durable CRUD, filters/details/activity/settings, auth and sync.
3. Secure schema, server reminder scheduler, push registration and email templates.
4. Catalog, text/image import, deterministic extraction, review/confirmation, signed inbound webhook and revocable aliases.
5. Strict type checks, lint, automated domain/integration contract tests, web bundle and browser verification; EAS/Maestro and security runbooks.

## Future milestones

Gmail/Outlook OAuth scanning needs a separate consent and provider verification release. Android notification listening needs Play policy review and a native module. Neither is represented as available. RevenueCat, paywalls, exchange-rate conversion, historical spending comparisons, and predictive savings are intentionally deferred. Totals use accurate per-currency subtotals without invented FX rates. The server scheduler creates the optional weekly digest on Monday in each user's timezone.

## Documentation sources

- [Expo SDK compatibility](https://docs.expo.dev/versions/latest/)
- [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [Supabase Expo authentication](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Scheduled Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [Resend webhook signatures](https://resend.com/docs/webhooks/verify-webhooks-requests)
