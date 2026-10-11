# Savings simulator

Settings → Savings simulator opens a reversible scenario. Select active subscriptions and trials; view monthly/annual potential savings and remaining recurring cost per currency. It never edits subscriptions, cancels a merchant account or sends a notification. Selection lasts only while this screen is mounted.

Estimates use existing integer/rational recurring-cost calculations and current recorded prices. Annual prepaid contracts do not imply a refund. Trials use their future recorded price. Paused/canceled/expired items and stale/duplicate selection IDs are excluded. Currency conversion is deliberately unavailable.

## Setup and dependency

No credentials or migration. This PR is stacked after monthly budgets to preserve the shared Settings navigation changes. Merge its parent first, then retarget this PR to main.

## Validation

`npm run check`: mixed currency, inactive subscriptions, duplicate/stale selection and no mutation tests.
