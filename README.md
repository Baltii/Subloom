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

For mobile, use an **Expo development build**, not Expo Go. Configure Supabase, Resend, OCR, APNs/FCM, and EAS for the integrations you enable.

The updated standalone Mac test app is `build/Subloom-update.app`. Quit the running Subloom copy, then open this replacement. It keeps the same bundle identifier and storage origin. Rebuild separately with `npm run build:macos -- --update`; it bundles the web interface and runs without Metro. This ad-hoc signed test app requires macOS 14+.

## What works

- Subscription CRUD, catalog search without invented prices, recurrence dates, status changes, provider links, notes, category filters, sorting, timeline and activity.
- Integer minor-unit prices and rational calculations; accurate per-currency monthly/annual estimates, month-end and leap-year anchors, timezone-aware upcoming renewals.
- Guest SQLite persistence on mobile; identity-scoped offline cache, durable mutation outbox, idempotent transactional cloud sync, owned Realtime revision signals, foreground/reconnect refresh and explicit version-conflict resolution. Multiple devices signed into the same account share subscriptions, preferences, receipt candidates and activity.
- Light/dark/system appearance, accessible controls, reduced-motion support, animated summaries, native swipe-to-pause/resume, and pull-to-refresh.
- Local text/HTML receipt parsing, screenshot selection, missing-field review, candidate deduplication, confirmation/update/dismissal. OCR requires the configured backend and explicit consent.
- Deployable authenticated Edge Functions, owner-isolating RLS, hard-to-guess revocable forwarding addresses, signed inbound webhooks, scheduled push/email reminders, delivery receipts, quiet hours, high-renewal thresholds and optional digests with signed opt-out links.
- Full cloud export and cascading account deletion endpoints; local export and reset for guests.

## Verification and release status

Supabase migrations and all ten Edge Functions are deployed. On 2026-10-09, 141 application tests, 10 backend tests and 20 live Auth/PostgREST/Realtime/Edge Function checks passed. The live checks used disposable accounts and two sessions for one account, verifying CRUD, account isolation, conflict rejection, deletion signals and push registration ownership. Three hosted scheduler/retention jobs are active; worker authorization and execution returned the expected results.

Mobile push registration, token refresh, per-device consent and test notification queuing are implemented. EAS ownership is verified, and public configuration is set for all three build environments. APNs and FCM credentials are absent, so actual iOS/Android delivery and signed mobile builds remain pending. Mac notifications are disabled by request. Resend SMTP passed a user-requested real send through the temporary test sender. The configured sender still needs domain verification; OCR and email forwarding require provider setup and live delivery validation.

The dependency audit still reports upstream high-severity findings in Expo/React Native tooling. Review these before a store release. This is not a claim of production certification.

Source: `src/app` routes; `src/components` design system; `src/domain` shared pure logic; `src/services` persistence/providers; `src/store` durable state; `supabase/migrations` schema and RLS; `supabase/functions` server integrations. No bank connection, mailbox OAuth scanning, paywall, automatic merchant cancellation, or advertising SDK is enabled.
