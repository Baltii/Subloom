# Monthly category budgets

Open Settings → Monthly budgets. Choose a category, currency and positive monthly limit. Saving the same category/currency replaces its limit; remove deletes it. Alerts appear in the budget screen at 80% and 100% of estimated recurring monthly cost. Paused, canceled and expired items are excluded; trial recurring prices are included. This is a forecast, not a bank ledger. Currency totals are never converted or combined. Email/push budget alerts are not part of this screen.

Guest budgets persist on this device (localStorage on web, SQLite on native). Account budgets persist in Supabase; loading/saving requires a connection. Writes use version checks, so concurrent device edits fail visibly rather than overwrite newer settings. Guest settings are not automatically transferred on login. Demo edits are disabled.

## Setup

Apply `202610110001_feature_settings.sql` with `supabase db push`. Existing public Supabase URL and publishable/anon key are sufficient; no additional credentials. RLS isolates each account and account deletion cascades settings. Local reset clears feature settings too.

## Validation

`npm run check` includes threshold, mixed currency, excluded status and PostgreSQL isolation/conflict tests. No production migration is applied by this PR.
