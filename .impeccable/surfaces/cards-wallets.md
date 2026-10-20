# Cards & wallets

- Routes: `/billing-methods`, `/subscription/new`, `/subscription/edit`, subscription details and `/subscriptions?billing=...`.
- Purpose: identify which saved card or wallet is assigned to each subscription, and find subscriptions by that method.
- Reuse: incumbent Page/Card, Button/IconButton, Field, Chips, SelectField and PickerSheet; semantic theme pairs; Manrope headings and DM Sans/tabular figures. The manager opts into a 1076px outer page width (1000px content plus two 38px desktop gutters), keeping its title, actions and list aligned. Phone gutters and existing page defaults are unchanged.
- Interaction: add/edit card type + four digits or wallet provider, optional nickname, inline method creation with draft preservation, searchable assignment/filter, per-method linked count, removal confirmation, failed-save input retention and reload. Non-editable sample workspace controls remain disabled.
- Data: stable owner-scoped source UUID; four-digit text preserves leading zeroes. No invented balances, account connection, full card numbers, CVV or wallet addresses. Missing methods remain unavailable until reassigned. Older free-text billing notes remain readable.
- Motion: existing bounded button feedback and sheet fade; existing system reduced-motion handling, no new entrance animation.
- Taste: Pastel consumer, seed 35175425, palette/type retained from Subloom. The masked method and linked subscription count provide the product-specific identity. No external visual assets or design-token changes.
- Validation: 312 tests in 53 files plus typecheck/lint; web/iOS/Android exports; source taste lint 0 FAIL/0 WARN; CUA web review at 390, 768 and 1440px, light/dark, keyboard, creation, edit, inline add, reload and billing filters. See `feature-docs/cards-wallets.md` for explicit runtime limitations.
