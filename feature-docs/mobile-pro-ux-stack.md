# Mobile and Pro UX feature stack

Start from `release-candidate`. Merge these ready-for-review PRs in order; each PR targets its predecessor.

1. `feat/pro-access-gates`: mark statement import, transaction export and expanded card/wallet capacity with Pro badges. Open the complete, closable full-screen Pro purchase/restore experience on locked actions. Use verified workspace access, re-check at action time and update at expiry. Preserve free manual tracking, reminders, calendar, backups, three billing labels and access to existing records after downgrade.
2. `fix/pro-card-themes`: adapt the illustrated membership card to all accent palettes and light/dark appearance; keep the canonical logo green/mint.
3. `feat/cards-wallets-navigation`: replace the Transactions navigation destination with Cards & Wallets on mobile and desktop. Keep Transactions available in Quick actions and show card/wallet management there without a search.
4. `feat/mobile-filter-sheets`: one Filters button on subscriptions and calendar. Edit a draft in the existing bottom sheet, Apply atomically, Clear to defaults, and discard changes on dismissal. Keep search visible.
5. `feat/subscription-view-switcher`: grouped icon-only List/Timeline controls with accessible labels and selected states.
6. `feat/personalized-home-greeting`: greet the current client by available profile name, with a warm guest fallback and wave emoji.

Validation: run the repository check suite for each delta, export web/native routes and assets, and inspect desktop/compact layouts, theme variants and keyboard controls. Record actual results in each PR.
