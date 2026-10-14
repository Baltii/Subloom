# Renewal Autopilot

PR 4 of 8, based on Cancellation Watch. Merge Cards & Wallets → Radar → Watch → Autopilot → Virtual Card Plans → Reserve → Value Coach → Family Settlements. Apply the included migration before signed-in use. Guest rules are local, account rules use the existing owned version checks; export/reset covers both.

Rules evaluate annual renewal review, baseline price increases (recorded prices or explicitly matched imported charges), per-renewal limits and 0–30 day lead time. Decisions are tied to date, price, currency, evidence and rule revision. A changed currency requires updating the limit rather than comparing currencies. Confirmations are user supplied; no billing state is asserted.

This release evaluates rules on screen and opens existing catalog management links. It does not dispatch background notifications, renew a domain, toggle Apple/Google billing, or execute payments. Namecheap requires a server-held API key, provider eligibility, a current renewal quote, idempotency/reconciliation and explicit purchase authority before enabling a renewal adapter. Banking and issuing target Europe/UK; partner selection is pending. Source: https://www.namecheap.com/support/api/methods/domains/renew/

Validation: npm run check passed (34 files, 227 tests); Expo web/iOS/Android exports passed. Desktop dark empty state inspected. Feature settings now refresh on screen focus, and both storage paths reject oversized records before saving. Native runtime untested.

Final review correction: annual rules include equivalent calendar month/quarter cycles of one year or longer. Rule drafts and provider-reference drafts retain independent protection; changing the edited subscription cannot overwrite unsaved rule fields. Limits are cleared when a saved rule has a different currency.
