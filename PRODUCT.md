# Subloom

## Product and users

Subloom helps people track personal subscriptions, understand recurring costs and manage their renewal reminders. The consumer release focuses on Europe, with reviewed statement imports for real transaction records. It does not accept payments or verify cards.

## Primary jobs

- Add, find, edit and review subscription records.
- See upcoming renewals and estimated recurring costs in their original currencies.
- Review receipt candidates before accepting them.
- Import bank statements, review recurring charges and confirm subscription matches.
- Configure appearance, currency, timezone, reminders and data preferences.
- Record cancellation only after handling billing with the merchant.

## Platform

Expo React Native for iOS and Android, a responsive web app, and a macOS WebKit wrapper around the web interface. The owner confirmed on 2026-10-11 that UX improvements should balance Mac/desktop and mobile.

## Stack

Existing Expo Router, React, React Native, Reanimated, React Hook Form, Zod, Zustand and Supabase. Preserve this stack and its existing icon/font assets.

## Constraints and product truth

- Guest tracking works without an account and saves edits durably on the current device.
- Signed-in changes use the existing durable outbox and owner-isolated cloud sync.
- Sample data is labelled, isolated and does not send reminders.
- Stored subscription prices, transactions and recorded spending preserve their original currencies. Finance shows separately labelled currency estimates using dated reference rates; these are not bank settlement prices.
- Pausing tracking, deleting records and recording cancellation do not stop merchant billing.
- Email, push, receipt processing and mailbox access respect the existing consent and provider setup requirements.
- Google/Apple and Gmail/Outlook integrations require external configuration. The Mac authentication browser returns callbacks to the app; live provider verification still needs credentials. Direct bank access requires an approved bank-data provider and is not part of the current implementation.
- Destructive actions explain their scope and require deliberate confirmation. Failed saves preserve input and show recovery.
- Keyboard navigation, clear focus, sufficient contrast, usable touch targets, light/dark appearance and reduced motion must remain supported.

## Current UX request

The owner requested fewer tools and a credible consumer release, with Europe as the target market. Keep subscription tracking, calendar, reminders, spending, receipts, transaction imports and data controls. Remove crypto tools, card simulations, reserve/value plans, family settlements, team SSO and duplicate finance screens. Manual card-label forms must not resemble verified payment setup. The owner has no bank-data provider account yet; the current import path uses reviewed statements without claiming a bank connection.
