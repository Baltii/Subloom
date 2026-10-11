# Recorded price history

Settings → Price history lists saved prices and billing periods by subscription revision. Price/currency/interval changes create entries; unrelated edits do not. Comparable entries display the absolute increase/decrease; changing currency or billing period disables that comparison. No exchange conversion, bank charge verification or invented history.

Guest history is part of the same durable snapshot transaction as subscription edits. Legacy data loads an empty history; the first change captures the previous current-price baseline. A subscription with no history displays a labeled current-price baseline. CSV creations record their initial price. Account history is captured by a database trigger after accepted subscription writes; retries and unrelated edits do not duplicate entries. The migration backfills only the current price, labeled baseline. Deleted subscriptions/accounts cascade their history. Guest import into an account starts new account history from the imported current price; previous guest history stays with the guest workspace.

The screen loads cloud history when connected and can show local records if that load fails. Local pending edits are clearly labeled; resolve conflicts before relying on comparisons. Revisions identify entries, not verified price-change dates. Captured dates are when Subloom recorded the data, not necessarily the merchant’s effective date.

Apply `202610110002_price_history.sql`, then deploy the updated export-data function. No new credentials. Stacked after cancellation assistant. `npm run check` tests price/period detection, persistence and database trigger isolation/deduplication/cascades. Account JSON export includes server history; guest JSON export includes local history.
