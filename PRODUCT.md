# Subloom

## Product and users

Subloom helps people track personal subscriptions, understand recurring costs and manage their own renewal reminders. Family and team workspaces support shared subscription records and cost splits. Shared billing records do not charge participants.

## Primary jobs

- Add, find, edit and review subscription records.
- See upcoming renewals and estimated recurring costs in their original currencies.
- Review receipt candidates before accepting them.
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
- Google/Apple, Gmail/Outlook and SAML integrations require external configuration. The Mac authentication browser returns callbacks to the app; live provider verification still needs credentials.
- Destructive actions explain their scope and require deliberate confirmation. Failed saves preserve input and show recovery.
- Keyboard navigation, clear focus, sufficient contrast, usable touch targets, light/dark appearance and reduced motion must remain supported.

## Current UX request

The owner requested a clean, easy interface with smooth animations, better settings, subscription management, quick actions, alerts, confirmations and user flows. Preserve the established Subloom identity while reducing friction in these tasks.
