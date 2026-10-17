# Virtual card plans

PR 5 of 8, based on Renewal Autopilot. Merge Cards & Wallets → Radar → Watch → Autopilot → Virtual Card Plans → Reserve → Value Coach → Family Settlements. Apply the included migration before account use. Guest/account export and reset cover saved plans.

The owner chose personal consumers, Europe and UK, with no approved issuing partner. Therefore this PR deliberately ships plans and simulations, not issued cards. Store one currency-specific monthly cap, requested authorization state and date-only stop date per subscription. Review matched imported debit/credit history and export an unenforced plan. No card number or credentials are created. Simulations use imported debits only, do not replenish caps with credits, and exclude pending authorizations, fees, FX and unknown transactions.

Live issuance remains blocked on a partner approved for a European/UK consumer flow, exact launch countries, KYC/consent UX, server-owned issuer IDs, funding, signed and deduplicated webhooks, idempotent commands and issuer-confirmed state. Merchant-ID restriction availability must be verified with that partner. A payment decline does not terminate a provider contract. No Stripe secrets, fake active cards or issuance buttons are shipped.

Official references checked: https://docs.stripe.com/issuing and https://docs.stripe.com/issuing/global and https://docs.stripe.com/issuing/controls/spending-controls.

Validation: npm run check passed (35 files, 229 tests); Expo web/iOS/Android exports passed. Compact dark empty state inspected at 390×844. Live issuer/device runtime untested and unavailable.

Final review correction: subscription selection is disabled while control fields have unsaved changes; an explicit discard action restores saved values. Changing the subscription currency requires entering a new cap rather than reinterpreting an old currency amount.
