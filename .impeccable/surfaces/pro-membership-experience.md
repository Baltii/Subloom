# Pro membership experience

## Scope and authority

This is an Operate-mode extension of the existing Subloom interface for Expo React Native, responsive web and desktop wrappers. It documents the seventh feature delta on `feat/pro-membership-experience`, compared with `origin/feat/personalized-home-greeting` (#72). Merge after #67 → #68 → #69 → #70 → #71 → #72. The production/default branch remains `release-candidate`.

`PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, `brand/GUIDE.md` and the generated brand master remain authoritative. The earlier six-feature surface decisions remain in `mobile-pro-ux-stack.md`. This task extends membership status, cancellation and confirmed-date tracking; it does not establish a new visual world or approve global token changes. No new dependency, raster asset or logo geometry is introduced by this delta.

## Surface decisions

- **Membership identity:** `ProBadge` places a crown and “Subloom Pro” beside account/sidebar identity only when workspace access is active and the workspace is not sample data. It reads entitlement through the existing access hook. It is distinct from `ProFeatureBadge`, which identifies a paid capability without asserting membership.
- **One membership composition:** `/pro` reuses the stack's `ProMembershipCard` and original transparent membership WebP. The reconciled delta removes the duplicate local card/illustration and the redundant inverse-brand change. The canonical `Brand` still consumes generated identity data: green/forest on light surfaces and mint on dark surfaces, independently of the selected accent.
- **Responsive task order:** the page caps content at 1000px. At the existing 900px wide threshold, the membership card and feature summary sit beside the billing card. Compact layouts place billing immediately after the membership card, then features. Below 380px, the card uses the compact mark and stacks its artwork below the copy. These are local layout decisions, not new breakpoints or global type roles.
- **Status and pricing:** free, trial, active, ending, unavailable, payment-attention, support-review and error/retry paths use the existing semantic primitives. Monthly (€2.99) and yearly (€24) choices retain explicit cadence, renewal/trial terms and a final-total explanation. Active membership shows its returned plan and billing/trial/ending date. Offline copy describes the existing verified-access limit rather than inventing a current billing date.
- **Contextual access:** the existing full-screen, closable `ProAccessProvider` continues to show the complete page with the named capability. It preserves the underlying editor and clears requests on owner changes. Statement imports remains the pictured contextual example.
- **Cancellation:** the named “Cancel subscription” action opens the shared confirmation, explains renewal stopping, the end date, continued record access and any outstanding invoices, then calls billing. Success appears only after processor cancellation is confirmed; the returned end date drives the success copy and refreshed tracking. Busy/repeated requests use existing protections and failures retain recovery. Disconnecting billing or deleting the tracking record explicitly does not stop renewal. Ordinary merchant cancellation still means recording the user's action with that provider.
- **Automatic tracking:** confirmed active/trial purchases create one deterministic, billing-owner-bound “Subloom Pro” record. Processor purchase, period, anchor, trial, cancellation and ending timestamps are converted through the workspace timezone into the existing date-only model. The interval and original EUR amount remain explicit; this does not create transaction/payment-history facts.
- **Managed data and user choices:** manual paths cannot change the managed identity, financial, recurrence or status fields. Subscription detail/actions route plan changes to Pro; existing notes and billing labels are preserved, and reminder choices remain editable. Reconciliation preserves those choices and uses the durable save/outbox path. A tracking-save failure reports recovery while leaving valid billing access intact.
- **Deletion and isolation:** removing tracking persists a dismissal so later refreshes do not recreate that record, including synced deletions. It does not cancel billing. Reconciliation checks hydration, sample data, workspace identity and billing owner before saving; the existing current-owner/auth guards remain. No save is authorized by display names or membership labels.
- **Reminder meaning:** existing reminder settings, quiet hours, privacy mode and trial-reminder consent continue to apply. Pro's paid-through event can produce an ending reminder; copy says access ends and renewal is canceled. Ending events stop recurrence expansion. The backend template and constraint migration add the corresponding `ending` kind without claiming notification delivery was exercised.

## Incumbent system comparison

| Area | Applied decision |
| --- | --- |
| Product | Keeps everyday tracking, Calendar, reminders, backup and existing records available after downgrade. Billing-email verification for a local workspace is explicitly separate from cloud-sync sign-in. |
| Color and identity | Resolves hero/text/secondary, surface/border, action and feedback pairs from the existing theme. The logo remains green/mint across Blue and Violet accents. |
| Type | Keeps Manrope headings and DM Sans reading/control text. Card headline variants, 40px pricing and small status labels are local component sizes. |
| Spacing and shape | Retains the stack's 24/32px card spacing, 24px membership radius, shared bordered cards, chips, buttons, fields and confirmations. |
| Depth and imagery | Tonal fills, thin borders and existing modal dimming provide structure. The retained financial raster provides tactile depth; there is no new shadow system or alternate botanical mark. |
| Motion and access | Preserves bounded 240ms artwork feedback with `ReduceMotion.System`, shared reduced-motion paths, named actions, selection/busy/error semantics and visible web focus. The logo itself is not animated. |
| Previous stack | Preserves Cards tabs/default Quick actions, filters, List/Timeline icons, contextual Pro gate and the owner-safe Overview greeting. |

Global design files are intentionally preserved. `DESIGN.md`'s earlier artwork inventory does not enumerate the membership raster already introduced by the preceding stack; this surface and `mobile-pro-ux-stack.md` carry that local inventory. `PRODUCT.md`'s prohibition on accepting payments/verifying cards continues to govern tracked merchant records and billing labels; paid Subloom membership uses the existing external billing flow and does not make those labels verified payment instruments. Neither observation authorizes an unsolicited global rewrite. No additional visual-system drift was established in this comparison.

## Evidence and review scope

Six React Native web captures under `.impeccable/review/pro-membership-experience/` were inspected:

| Capture | Evidence |
| --- | --- |
| `desktop.png` | Blue/light at 1440px; two-column card, features and billing layout. |
| `mobile.png` | Blue/light at 390px; card followed by billing. |
| `pro-320.png` | Blue/light at 320px; compact mark and vertically stacked artwork. |
| `upgrade-modal.png` | Compact full-screen Statement imports context with visible close control. |
| `pro-dark-mobile.png` | Violet/dark at 390px with mint brand and paired reading colors. |
| `user-1940.png` | Violet/dark wide composition. Parent measured the actual browser viewport as 1940×1064, DPR 1; the stored 1664×1064 transport image retains the full composition. |

The finish review in `/private/tmp/subloom-membership-finish-review.md` gives **ship within the supplied adaptive web/source scope**, with no remaining material correction. The parent manually exercised contextual gate opening/Escape dismissal, compact layout/themes and the preserved Cards tabs/greeting. Membership badges, active membership, cancellation confirmation and resulting tracking/reminder states are source/test-reviewed; these captures do not picture those runtime states.

Final execution evidence was supplied by the parent and checked against the saved logs; this documentation pass did not rerun implementation checks:

- App typecheck and lint passed; 372 tests passed in 62 files (`/private/tmp/subloom-membership-check.log`).
- Backend typechecks and 38 backend tests passed (`/private/tmp/subloom-membership-backend-check.log`, `/private/tmp/subloom-membership-backend-tests.log`).
- All 9 Windows tests passed (`/private/tmp/subloom-membership-windows.log`).
- Web, iOS and Android exports completed (`/private/tmp/subloom-membership-export.log`, output `/private/tmp/subloom-membership-export`).
- Parent reported brand drift validation passing for 30 outputs and 63 manifest entries.

Native hardware, live provider authentication, checkout, cancellation, notification delivery and OS reduced-motion behavior were not exercised. Native exports do not prove safe areas, assistive-technology traversal, font scaling, gestures or device performance. No HTML/CSS detector result is claimed for these React Native components. The migration and function changes are PR work only; no live rollout is part of this handoff.
