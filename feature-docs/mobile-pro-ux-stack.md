# Mobile and Pro UX feature stack

Start from `release-candidate`. Merge these ready-for-review PRs in order; each PR targets its predecessor.

1. `feat/pro-access-gates`: mark statement import, transaction export and expanded card/wallet capacity with Pro badges. Open the complete, closable full-screen Pro purchase/restore experience on locked actions. Use verified workspace access, re-check at action time and update at expiry. Preserve free manual tracking, reminders, calendar, backups, three billing labels and access to existing records after downgrade.
2. `fix/pro-card-themes`: adapt the illustrated membership card to all accent palettes and light/dark appearance; keep the canonical logo green/mint.
3. `feat/cards-wallets-navigation`: replace the Transactions navigation destination with Cards & Wallets on mobile and desktop. Keep Transactions available in Quick actions and show card/wallet management there without a search.
4. `feat/mobile-filter-sheets`: one Filters button on subscriptions and calendar. Edit a draft in the existing bottom sheet, Apply atomically, Clear to defaults, and discard changes on dismissal. Keep search visible.
5. `feat/subscription-view-switcher`: grouped icon-only List/Timeline controls with accessible labels and selected states.
6. `feat/personalized-home-greeting`: greet the current client by available profile name, with a warm guest fallback and wave emoji.

Validation: run the repository check suite for each delta, export web/native routes and assets, and inspect desktop/compact layouts, theme variants and keyboard controls. Record actual results in each PR.


## Completed delivery

All six tasks are implemented. Merge the ready PRs in this order: [#67 Pro access](https://github.com/Baltii/Subloom/pull/67) → [#68 theme-aware card](https://github.com/Baltii/Subloom/pull/68) → [#69 Cards & Wallets navigation](https://github.com/Baltii/Subloom/pull/69) → [#70 filter sheets](https://github.com/Baltii/Subloom/pull/70) → [#71 icon switcher](https://github.com/Baltii/Subloom/pull/71) → [#72 Home greeting](https://github.com/Baltii/Subloom/pull/72). Each PR targets its predecessor; #67 targets `release-candidate`.

Final verification: `npm run check` passed (typecheck, lint, 61 test files / 358 tests). Web, iOS and Android exports passed. Brand consistency passed. Web inspection covered 320/390/1440/1940px, blue/light and violet/dark cards, free Pro entry and close/Escape, filter draft dismissal/Apply/Clear, Cards & Wallets/default Quick actions, keyboard Timeline selection and guest greeting. The independent review's only correction, 48×48 view-switcher targets, was resolved and confirmed with refreshed screenshots.

Native UI interaction, live provider sign-in/checkout/restore, populated-data UI and OS reduced-motion emulation were not exercised. Named greetings and entitlement isolation are covered by source/unit checks. Existing uncommitted work in the original checkout was preserved. Design evidence and the scoped review are recorded in `.impeccable/surfaces/mobile-pro-ux-stack.md`; global design and theme tokens remain unchanged.

Follow-up: `feat/pro-membership-experience` reconciles the earlier local membership tracking, cancellation and ending-reminder work with this completed stack. Its PR targets `feat/personalized-home-greeting`; merge it after #72.
