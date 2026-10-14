# Subscription Radar

Open Quick actions or Cards & wallets → Subscription Radar. Import a CSV statement (up to 2 MB), map distinct columns, choose charge-sign convention/default currency/payment source, review rows, and explicitly import. Dates must be ISO YYYY-MM-DD and amounts plain decimals. Supported currencies use exact minor units, including TND and JPY. Original statement files are not uploaded or saved; only mapped records are persisted. Charges and credits stay distinct.

History is limited to 300 rows / 128 KiB. Exact normalized rows with the same date, amount, currency, source and reference are skipped; supply distinct references for otherwise identical legitimate charges. Raw merchant descriptions do not execute as formulas/HTML. Full account/card numbers are rejected in mapped merchant/reference fields.

Review bounded merchant/currency match suggestions; confirm a subscription or keep unmatched, and ignore/restore records. Matching does not mutate a subscription. Three distinct dates with consistent weekly/monthly/yearly cadence surface possible recurring payments; review before adding a subscription through the existing durable save/outbox path. Differences compare imported charges to the current recorded price and can include taxes/fees/period differences. Missing charges never imply payment failure.

Guest history persists locally; account history uses owned, version-checked settings and needs a connection. JSON export/reset/account deletion cover history. Apply subscription_radar after payment_sources. No bank credentials or live bank feed is enabled; bank connections need market/provider setup. This is PR 2 of 8, stacked on Cards & wallets.
