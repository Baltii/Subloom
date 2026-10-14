# Daily currency reference rates

Finance shows monthly recurring estimates converted to the preference currency, alongside original amounts and provider observation dates. Calculations use integer/rational minor-unit arithmetic, including JPY (0 decimals) and TND (3). Missing rates never become 1:1 conversions; observations older than 7 days are flagged. Rates are mid-market references, not card settlement prices or crypto market prices.

Frankfurter v2 is free/open source, requires no key, and supports all ten app currencies (USD as common base). The cron-authenticated refresh-exchange-rates Edge Function validates a complete response and upserts historical daily observations atomically. Clients have read-only access to reference rates via a security-invoker latest-rate view. A public device cache permits offline estimates. Personal subscription or transaction data is not sent to the rate API.

Deploy the exchange_rates migration and refresh-exchange-rates, set the server CRON_SECRET, configure existing Vault names subloom_project_url/subloom_cron_secret, and run supabase/ops/install-finance-cron.sql. This schedules one refresh at 17:30 UTC daily; invoke once after installation to populate initial rates. Inspect cron.job_run_details and net._http_response for failures. Cron installation is intentionally an operator step, not a production side effect of migration. No hosted deployment was performed.

Verified the live Frankfurter response on 2026-10-14: all nine USD quote currencies returned valid observations, including TND. Unit tests cover cross rates, precision and missing rates; PostgreSQL tests verify read-only grants/latest observations. Deno tests reject partial, duplicate, future, stale and invalid rates.

Merge order: finance-wallet-ledger → finance-exchange-rates → finance-renewal-controls. Base this PR on codex/finance-wallet-ledger; merge cards before rates, then the wallet/crypto feature.

Verification on the finalized currency branch: `npm run check` passed (35 files, 226 tests), `npm run check:backend` passed, and `npm run test:backend` passed (24 tests). The product guidance now explicitly distinguishes dated currency estimates from original recorded prices. Final combined-stack exports are recorded in the third feature document.
