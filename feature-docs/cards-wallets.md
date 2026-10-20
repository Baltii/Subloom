# Cards, wallets and subscription billing methods

Open **Cards & wallets** from the subscription list, Settings → Tools, Quick actions, or a subscription’s details. Add up to 50 methods. New cards require a card type and exactly four digits; leading zeroes are preserved and full numbers are rejected rather than truncated. Wallets offer Apple Wallet, Google Wallet, RedotPay, Crypto wallet, PayPal and Other wallet. Both kinds accept an optional nickname. No expiry, security code, account credentials or wallet address is requested. Existing bank records remain readable/removable, and old optional expiry metadata is preserved when editing a card.

The subscription creation/edit form has a searchable **Billing method** picker and inline **Add a card or wallet**. Inline creation preserves the subscription draft and selects the saved method. An assignment is committed with the subscription, its activity and its existing durable outbox. The list and details display the method label. Filter by all methods, all cards, all wallets, one saved method, or not assigned/unavailable; existing category, status, name and timeline controls still compose with that filter. Each method’s subscription count opens that exact method’s list.

## Storage and compatibility

- Method records extend the existing `payment_sources` feature setting with optional `cardBrand` and `walletProvider` fields. Existing records and legacy links still parse. No new database migration or provider integration is needed.
- New assignments use a stable `billing:<source UUID>` reference in the existing subscription `paymentMethod` field. `billing:none` explicitly clears an assignment and overrides an old profile link. Existing free-text notes remain readable and unchanged unless the user chooses another method. Neither names nor last-four digits are used as identifiers.
- Editing a method updates the displayed label on every linked subscription. Removing a method never reassigns its subscriptions to another source; unavailable references are shown explicitly and are included in the not assigned/unavailable filter.
- Guest metadata uses existing durable device feature storage. Account metadata uses the existing owner-scoped, version-checked settings RPC and requires connectivity to load or change. Failed saves retain editor input and expose reload/retry. Source selectors and filters do not pretend a failed load is an empty saved profile. Subscription changes keep their existing offline save/outbox behavior.
- The explicit guest import copies billing metadata before importing subscriptions, preserving IDs and the guest copy. Retry deduplicates methods and preserves account records. A failed method write blocks subscription import; a failed subscription write can leave safely reusable imported metadata. Identity changes stop the import before it can use another workspace.
- The existing JSON archive includes method metadata and subscription references. CSV carries the existing `paymentMethod` field, including assignment references; it is not a standalone backup of saved methods.

## UI and validation

The screen answers “Which cards and wallets pay for my subscriptions?” using real saved methods and linked counts. It reuses Subloom’s Manrope/DM Sans typography, semantic theme colors, Page/Card controls, selected states, visible keyboard focus, and inherited system reduced-motion behavior. A page width option aligns the new manager’s title and list without changing existing page defaults.

Taste direction: **Pastel consumer**, seed **35175425**, with the existing palette and typography retained. No redraws or downloaded assets. The feature’s signature content is the masked card label beside its linked subscription count. Sparse accounts stay sparse; no balances, expiry warnings, charts or invented numbers are introduced.

Validation on the final implementation:

- `npm run check`: passed, **53 test files / 312 tests**, including type checking and linting.
- Web, iOS and Android JavaScript exports: passed.
- Tests cover exact four-digit validation, leading zeroes, provider/type consistency, stable IDs with identical card digits, legacy notes/links, clearing assignments, removed-method fallback, card/wallet/specific filters, the 50-method limit, durable guest saves, failed disk writes, atomic subscription/outbox persistence, account isolation, guest import ordering/retry and identity changes. Existing PostgreSQL/RLS tests round-trip the extended profile and deny other-owner reads.
- Browser checks on the exported web app: card and wallet creation; full-number rejection; inline wallet creation with an intact subscription draft; create/edit assignment and reload; saved-card edit propagating to its linked subscription; all-card, all-wallet and exact-method filters; keyboard activation/selection; compact and wide navigation; light/dark appearance; initial empty state. Layouts inspected at **390 × 844**, **768 × 1024**, and **1440 × 1000**. Review evidence is local in `.impeccable/review/billing-methods/`.
- Taste source lint: **0 FAIL / 0 WARN**. Browser visual checks used the available CUA browser surface; the skill’s separate CDP inspector was not run.
- Not exercised: native device runtime, live signed-in account UI, OS/browser reduced-motion emulation, forced account-network errors and the 50-record UI. Automated tests cover persistence/error/limit behavior; native exports do not prove native interaction behavior.

Merge order: this standalone feature PR targets `release-candidate` after the merged cancellation-guide feature (#45). Merge this PR first, then promote the verified release branch to `main`. No unrelated open feature PR is required.
