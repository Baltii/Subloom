# Recurring payments control center

Initial audience: personal consumers in Europe and UK. No banking or issuing partner has been approved. Manual payment-source tracking, user-imported statements, review rules, funding plans, usage decisions and recorded family settlements are implemented. Automatic bank feeds, provider renewal orders, live virtual cards, funded wallets and payment transfers remain unavailable. The virtual card feature is explicitly an unenforced planning/simulation foundation.

Merge the PRs in this order, retargeting each successor to main after its parent merges:

| Order | Feature                            | PR                                               | Base                                    |
| ----- | ---------------------------------- | ------------------------------------------------ | --------------------------------------- |
| 1     | Cards & Wallets Hub                | [#22](https://github.com/Baltii/Subloom/pull/22) | main                                    |
| 2     | Subscription Radar                 | [#23](https://github.com/Baltii/Subloom/pull/23) | codex/cards-wallets-hub                 |
| 3     | Cancellation Watch                 | [#24](https://github.com/Baltii/Subloom/pull/24) | codex/subscription-radar                |
| 4     | Renewal Autopilot review rules     | [#25](https://github.com/Baltii/Subloom/pull/25) | codex/control-center-cancellation-watch |
| 5     | Virtual card plans and simulations | [#26](https://github.com/Baltii/Subloom/pull/26) | codex/control-center-autopilot          |
| 6     | Renewal Reserve                    | [#27](https://github.com/Baltii/Subloom/pull/27) | codex/control-center-virtual-plans      |
| 7     | Subscription Value Coach           | [#28](https://github.com/Baltii/Subloom/pull/28) | codex/control-center-reserve            |
| 8     | Family Settlement Center           | [#29](https://github.com/Baltii/Subloom/pull/29) | codex/control-center-value-coach        |

Each feature has its own setup/behavior document in feature-docs. Apply the migrations in stack order for signed-in use, then deploy the changed export-data Edge Function for complete ledger export. This work does not deploy hosted changes or merge the PRs.

Final validation and review evidence are recorded in verification.md. Guests can exercise the personal tools without provider setup. Shared settlements require a signed-in family workspace. Banking/issuing partner choice must verify exact launch-country and consumer-flow coverage, rather than assume general European availability.
