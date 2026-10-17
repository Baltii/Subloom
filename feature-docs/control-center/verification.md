# Control-center verification

Recorded 2026-10-12 from the completed implementation's review packet and reviewer follow-up. This is a handoff of actual results and limits, not a production-readiness claim or a fresh whole-surface audit.

## Scope and disposition

The evidence covers Cards & Wallets Hub, Subscription Radar, Cancellation Watch, Renewal Autopilot, virtual card plans, Renewal Reserve, Subscription Value Coach and Family Settlement Center. Cards and Radar were already implemented in parent PRs #22/#23; six additional feature screens form the current extension. The direction remains Operate and preserves the established Subloom design.

The initial review found four material issues. The bounded follow-up scored all four **resolved** and returned **ship at the fix-list scope**:

| Finding                      | Correction and evidence                                                                                                                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Annual-equivalent cadences   | Shared `hasAnnualCadence` recognizes month/quarter cadences of at least one calendar year; Autopilot and Reserve use it. Annual-equivalent tests were added.                                                                                                                                      |
| Independent draft protection | Autopilot rule/reference and Reserve payday/bucket drafts retain independent guards. Virtual and Coach subscription selection protect unsaved fields through explicit save/discard. Browser correction checks confirmed disabled virtual subscription switching and both independent back guards. |
| Coach progressive disclosure | Bounded show-more controls expose saved check-ins and quotes, including check-ins for deleted subscriptions. Browser correction checking reached all 32 check-ins.                                                                                                                                |
| Financial confirmation facts | Family confirmations display the captured subscription, payer/billing owner and split shares for a charge, or sender/recipient for settlement/request, alongside amount, date and reference. This correction was reviewed in source; the signed-in family browser flow remains untested.          |

## Automated checks

| Check                                        | Actual result                                                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check` (TypeScript, ESLint, Vitest) | Passed after corrections: **39 test files / 242 tests**. The packet's earlier 239-test result is superseded by its correction round. |
| Expo exports                                 | **Web, iOS and Android exports passed.** Bundle exports do not establish native runtime behavior.                                    |
| Backend check                                | Passed.                                                                                                                              |
| Backend tests                                | **22 tests passed.**                                                                                                                 |
| Local Supabase advisors                      | Could not connect because the local Supabase database was unavailable/not running. No successful advisor verdict is claimed.         |

PGlite tests cover family membership, split snapshots, receipt authority, conflicts, history caps and cascade behavior. Correction tests include annual-equivalent cadence handling and same-currency imported net charges. The handoff records the checks performed by the implementation/review workflow; it does not claim an additional documentation-stage rerun.

## Browser evidence

All eight screens have desktop **1280 × 900 dark** and compact **390 × 844 light** screenshot evidence in `/Users/baltii/Documents/ChatGPT/Subloom/.impeccable/review/control-center`:

| Surface                  | Desktop dark                   | Compact light                   |
| ------------------------ | ------------------------------ | ------------------------------- |
| Cards                    | `cards-desktop-dark.jpg`       | `cards-compact-light.jpg`       |
| Radar                    | `radar-desktop-dark.jpg`       | `radar-compact-light.jpg`       |
| Watch                    | `watch-desktop-dark.jpg`       | `watch-compact-light.jpg`       |
| Autopilot                | `autopilot-desktop-dark.jpg`   | `autopilot-compact-light.jpg`   |
| Virtual plans            | `virtual-desktop-dark.jpg`     | `virtual-compact-light.jpg`     |
| Reserve                  | `reserve-desktop-dark.jpg`     | `reserve-compact-light.jpg`     |
| Coach                    | `coach-desktop-dark.jpg`       | `coach-compact-light.jpg`       |
| Settlements guest gating | `settlements-desktop-dark.jpg` | `settlements-compact-light.jpg` |

Changed screens were recaptured after correction; unchanged Cards/Radar/Watch captures remained valid. Additional compact evidence captures Coach pagination and Autopilot/Reserve draft dialogs. These local review files are preserved in the ignored review directory and are not committed shipping raster assets. They use JPEG/JFIF encoding with .jpg filenames; dimensions match the listed desktop and compact sizes.

Synthetic browser flows recorded in `/Users/baltii/Documents/ChatGPT/Subloom/.impeccable/review/control-center/packet.md`:

- A $120/year subscription and five-use Coach check-in saved and showed a $10/month estimate and $2/use.
- A confirmed $12/month versus $120/year comparison showed $24 annual savings and 10 monthly payments.
- A $40 USD Reserve planning bucket reduced the gap for a $120 expected bill to $80.
- An Autopilot annual-review rule with a $100 limit and 14-day lead showed both reasons; a reviewed decision persisted after reload.
- A virtual plan with a $100 cap simulated $125 as “would decline” while retaining unenforced labeling.
- After correction, Show more made 32 check-ins reachable. Editing a virtual cap to 105 disabled subscription switching; discard restored the saved 100.
- Saving payday while an unsaved bucket amount of 50 remained still triggered the back guard. Saving a provider confirmation while an unsaved rule limit of 110 remained also triggered it.
- Keyboard Tab focused **Go back** with a visible outline.

## Accessibility and platform limits

Shared source uses system reduced-motion checks, removes button spatial feedback and entrance animation when reduced, and uses `ReduceMotion.System` for chart transitions. Runtime reduced-motion emulation was not tested. The Tab observation establishes the visible Go-back focus result; it is not a complete keyboard or assistive-technology audit.

Native devices and native runtime behavior were not tested. The signed-in family browser flow was unavailable without hosted migration/account setup. Guest gating was captured; family confirmation resolution is supported by source review and database tests, not a signed-in browser exercise. No macOS native-wrapper runtime claim is made by these web screenshots.

## Product and external-action boundaries

The audience is personal consumers in Europe/UK. No approved banking or issuing partner exists for this implementation. Virtual cards remain **unenforced plans and simulations**; Reserve records planning figures and holds no funds. Shared balances derive from recorded paid charges and captured splits; request drafts are reminders and do not charge participants. Manual tracking/cancellation actions do not stop merchant billing.

Recurring projections remain distinct from imported transactions, currencies remain separate, and guest/account storage retains its existing local persistence and owner isolation.

**No hosted migrations, issuer/bank integrations, money movement or external messages were performed.** Supabase advisor connectivity and signed-in family browser coverage remain limitations. The ship disposition applies to the four corrected review findings within this extension, not to external-provider readiness or untested production flows.

At the last recorded CI check, GitHub Actions passed for PRs #22–#28; the final documentation revision in #29 was pending. These hosted CI results are separate from the passing local checks; verify the current head before merging.

Pre-existing design context note: PRODUCT.md’s Platform field uses a descriptive sentence rather than the Impeccable enum `adaptive`. Existing product context was preserved; the new DESIGN.md documents the source-derived cross-platform design.
