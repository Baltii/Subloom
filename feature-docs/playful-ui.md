# Playful payment UI and accent themes

The UI adds a tonal Cards & Wallets CTA and a contrasting Subscription Radar CTA to the overview, plus icon actions for renewal rules, reserves, family balances, receipt import and appearance. Original 3D wallet/cards/coins and recurring-payment calendar illustrations support these tasks. Onboarding and the payment hub's empty state reuse the financial artwork. Existing financial estimates, currencies and renewal dates keep their meaning.

Settings → Preferences offers Green, Blue, Red, Violet, Orange, Yellow, Pink and Black & white. Accent and System/Light/Dark appearance are separate preferences. Semantic success, warning and error colors do not change with the accent. Swatches and appearance controls have explicit selected states on native and pressed states on web, visible checks and keyboard focus.

`accentTheme` defaults to Green when older snapshots or cloud preference records are parsed. It travels through the existing durable preference save/outbox path; guest records remain local and account caches stay isolated. The current JSON preference contract accepts the additive field without a new database migration. Older clients that rewrite an entire preference record can reset the accent to Green; upgrading clients preserves the new field.

Success alerts use a check icon and remain for 4.5 seconds; error alerts use a warning icon and remain for 8 seconds. Both can be dismissed and expose live alert semantics. Completed control-center saves emit specific confirmations. Validation errors show their first human-readable issue instead of schema JSON; failed saves retain drafts. Feature-action alerts are scoped to the identity that started the action.

## Asset provenance

The two original assets were created with the built-in Imagegen tool and optimized to transparent WebP (about 61 KB combined). Exact generation prompts are committed beside each asset under `assets/illustrations/`, with provenance sidecars. They contain no merchant logos, card details, return projections or currency symbols. The abandoned flower character is excluded.

Thiings was considered at the owner's suggestion. Its current [terms](https://www.thiings.co/terms) restrict the free license to personal, non-commercial use and require a paid tier for commercial app use. No Thiings assets are bundled.

## Verification — 2026-10-13

- `npm run check`: passed TypeScript, lint and 262 tests across 40 files.
- Palette contrast tests: 16 accent/appearance combinations, including body text, CTA foregrounds, hover colors, selections and feedback; all tested pairs pass 4.5:1. The original Green action color was darkened slightly to `#087C65` to pass on the selected mint surface.
- Storage tests cover old preference defaults, durable guest accent reloads, separate owners, queued account preferences, failed disk saves and readable validation messages.
- Expo exports: web, iOS and Android passed using `--platform all`.
- WebKit browser checks: 1440×1000, 390×844 and 820×1000; light and dark, financial CTA routing, theme save/reload, visible selection, Tab focus, payment empty state, invalid-date draft retention and successful save feedback. Review captures use synthetic guest records.
- The manual design detector ran once; its only advisory concerns an intentionally added palette color, documented in the theme system.
- Illustration provenance scan: two rasters, none missing metadata.
- Independent Impeccable finish review: `ship` for the changed UI across 14 supplied WebKit viewport captures; no material fixes requested. Scrolled control and alert captures are named as such.

Native runtime, OS reduced-motion settings and signed-in cloud round trips were not exercised. Existing reduced-motion paths remain in shared buttons/toasts; bundle exports do not prove device behavior. No hosted schema changes or deployment are part of this PR.

## Merge order

This UI PR follows Family Settlement Center #29 and targets `codex/control-center-family-settlements`. Merge the existing feature stack in order: #22 → #23 → #24 → #25 → #26 → #27 → #28 → #29, then this UI PR. After its predecessor reaches `main`, retarget this PR to `main`.
