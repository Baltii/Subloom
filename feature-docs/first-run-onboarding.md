# First-run welcome tour

Subloom opens a three-step welcome flow for a workspace that has not completed setup. Existing completed guest workspaces and accounts keep their current entry behavior. The existing account sync check runs before setup, so an account with saved subscriptions/preferences does not get replaced by an empty workspace.

1. **Less juggling. More clarity.** A subscription organizer illustration introduces keeping subscriptions together.
2. **See what’s coming next.** A calendar and bell introduce renewal dates and trial endings, without requesting notification permissions or implying alerts are already enabled.
3. **Your space. Your choice.** Choose **Create or sign in** to open the existing authentication screen, or **Use on this device** to open a real, empty local workspace. Currency and timezone remain editable under their summary. This does not add demonstration records.

Continue, Back and Skip intro stay within these three steps; skipping leads to the final choice. The completion flag is saved through the existing durable snapshot path before navigation. Failed saves leave the flow open with an error and retry. The authentication destination is rendered explicitly after the save, avoiding a competing home redirect. A new signed-in account that still needs setup opens directly at the final setup step; existing account data is loaded first. Authentication, guest import and owner isolation are otherwise unchanged. The connected authentication screen now offers **Open Subloom**.

The palette control opens the existing theme picker, with two columns even inside a narrow desktop sheet. All eight accents and light/dark/system appearance save through the existing preference path and immediately recolor the page and its original 2D vector illustrations. No external illustrations, logo requests, bitmap dependencies or new packages are needed. A currency change clears the prior currency-specific renewal threshold; subscription amounts and original currencies are untouched.

Settings → Data & privacy → **Welcome tour** opens `/onboarding?tour=1` to replay without clearing subscriptions or resetting the completion flag. Theme and region edits in a replay are real preference changes; completing it preserves subscription data.

## Design

Taste direction retained from Subloom: **Pastel consumer**, seed **35175425**, existing typography and palette. The product’s recurring-subscription organizer, renewal calendar and device choice supply the visual identity. Original vector artwork follows semantic theme colors; there are no invented balances, prices or financial totals. Illustrations are decorative and hidden from assistive technology. Progress is announced as “Step N of 3”; copy updates use a polite live region. Existing button/sheet motion honors reduced motion; no new motion loops were introduced. Desktop uses an illustration/text split, compact layouts stack and scroll, and the smallest header uses the compact brand mark.

## Validation

- `npm run check`: typecheck/lint and **54 files / 321 tests** passed. Added durable completion/theme/region, failed-save retry, identity isolation and replay data-preservation coverage. Existing sync tests cover returning accounts bypassing onboarding.
- Web, iOS and Android JavaScript exports passed. Native exports do not confirm device interaction behavior.
- Taste source lint on the onboarding route, original artwork and theme picker: **0 FAIL / 0 WARN**.
- The existing Maestro guest scenario now advances through both introduction steps and expands currency/timezone before completing setup; it has not been run on a simulator/device for this change.
- Browser verification is pending: automatic approval review blocked opening the new localhost preview, treating it as a retry of the earlier local-origin restriction. A request to authorize another attempt is pending. No alternate browser mechanism was used to bypass the denial.

## Delivery and merge order

Branch `codex/first-run-onboarding` builds on `codex/billing-methods` at `310f758`. Its ready-for-review PR targets that predecessor, so its diff contains only onboarding changes. Merge billing PR #47 into `release-candidate` first, then merge this feature into `release-candidate` after GitHub retargets it. A later release promotion updates `main`.

The user explicitly requested updating the live Vercel deployment while opening this PR. Production will be deployed from a clean archive of the reviewed feature commit, including the billing predecessor, without merging or changing the existing feature PRs. This is a CLI production deployment, rather than the project’s usual `main` Git-triggered release; a subsequent production deployment of `main` can replace it. Deployment identity and actual verification results are recorded once complete.
