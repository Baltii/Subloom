# Subloom

**Take control of your subscriptions.** An Expo React Native app for iOS and Android, with a responsive web preview, durable offline tracking, precise recurring-cost estimates, editable receipt detections, and a Supabase reminder backend.

## Run the app

Use Node 22.13+ and npm. No provider credentials are needed for guest tracking or pasted-text detection.

```sh
npm ci
npm run dev
```

Open [localhost:8081](http://localhost:8081). Choose **Create my personal space** for an empty, persistent guest workspace, or **Explore a clearly labeled sample first** for illustrative data. Sample data never syncs or sends reminders. It can be exited in Settings.

```sh
npm run check
npm run check:backend
npm run test:backend
npm run export:web
```

For mobile, use an **Expo development build**, not Expo Go. See [setup](docs/SETUP.md) for Supabase, Resend, OCR, APNs/FCM, and EAS instructions.

## What works

- Subscription CRUD, catalog search without invented prices, recurrence dates, status changes, provider links, notes, category filters, sorting, timeline and activity.
- Integer minor-unit prices and rational calculations; accurate per-currency monthly/annual estimates, month-end and leap-year anchors, timezone-aware upcoming renewals.
- Guest SQLite persistence on mobile; identity-scoped offline cache, durable mutation outbox, idempotent transactional cloud sync and explicit version-conflict resolution after account configuration.
- Light/dark/system appearance, accessible controls, reduced-motion support, animated summaries, native swipe-to-pause/resume, and pull-to-refresh.
- Local text/HTML receipt parsing, screenshot selection, missing-field review, candidate deduplication, confirmation/update/dismissal. OCR requires the configured backend and explicit consent.
- Deployable authenticated Edge Functions, owner-isolating RLS, hard-to-guess revocable forwarding addresses, signed inbound webhooks, scheduled push/email reminders, delivery receipts, quiet hours, high-renewal thresholds and optional digests with signed opt-out links.
- Full cloud export and cascading account deletion endpoints; local export and reset for guests.

## Verification and release status

This repository contains working implementation and automated tests. Live authentication, OCR, inbox forwarding, email/push delivery, native binaries and store submission require external project credentials and device validation. They have **not** been verified against a live deployment here. Provider tests use explicit mock HTTP adapters; they send no email or notifications.

The dependency audit still reports upstream high-severity findings in Expo/React Native tooling. See [known limitations](docs/KNOWN_LIMITS.md) before a store release. This is not a claim of production certification.

## Documentation

- [Setup and deployment](docs/SETUP.md)
- [Architecture and milestone boundaries](docs/ARCHITECTURE.md)
- [Tests and native-device runbook](docs/TESTING.md)
- [Security, privacy and retention](docs/SECURITY.md)
- [Known limits and integration roadmap](docs/KNOWN_LIMITS.md)

Source: `src/app` routes; `src/components` design system; `src/domain` shared pure logic; `src/services` persistence/providers; `src/store` durable state; `supabase/migrations` schema and RLS; `supabase/functions` server integrations. No bank connection, mailbox OAuth scanning, paywall, automatic merchant cancellation, or advertising SDK is enabled.
