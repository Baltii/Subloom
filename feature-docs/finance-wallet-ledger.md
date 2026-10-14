# Cards and recorded transactions

Settings → Subscription tools → Cards & transactions (also Quick actions). Add/edit/archive custom cards, Apple Wallet labels and Google Wallet labels using a name and optional last four digits. These are tracking metadata: a wallet entry does not connect a bank, import Wallet contents or authorize payments. No full card number, expiry, CVV or credential fields are accepted.

Record original-currency payments/refunds, dates, settled/pending/failed status and optional card/subscription links. History is independent of forecast renewals and app activity; only manually recorded settled entries enter spending totals. Guests save durably through existing local feature storage; accounts use an owner-isolated version-checked finance journal. Conflicts preserve form input and require reload. Account changes reset forms; demo editing is disabled. Archive cards to retain history. Up to 50 card labels and 300 transactions per journal, 50 search matches displayed. Existing reset/deletion and JSON export include this data.

Apply the finance_journal migration and deploy export-data before account use. Local PostgreSQL integration tests exercise RLS, version conflicts, invalid payloads and account deletion. No live payment provider is enabled by this PR.

Merge order: 1. codex/finance-wallet-ledger → main; 2. codex/finance-exchange-rates → codex/finance-wallet-ledger; 3. codex/finance-renewal-controls → codex/finance-exchange-rates. This stack is independent of the existing payment/control-center feature branches.

Verification on the finalized cards branch: `npm run check` passed (33 files, 223 tests), `npm run check:backend` passed, and `npm run test:backend` passed (22 tests). Initial web/iOS/Android exports passed; final combined-stack exports are recorded in the third feature document. Browser checks exercised guest card and transaction saving, persistence after reload, immediate updates on returning from forms, and compact/desktop layouts. Native device behavior and hosted deployment remain untested.
