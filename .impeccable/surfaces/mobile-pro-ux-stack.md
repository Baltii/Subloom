# Mobile and Pro UX stack

## Scope and authority

This is an Operate-mode extension of the existing Subloom interface for Expo React Native on iOS/Android and responsive web/Mac. It covers `/pro`, contextual Pro access, `/billing-methods`, main navigation and Quick actions, `/subscriptions`, `/calendar`, and the Overview greeting. No new visual world, approved composition, dependency or global token change was requested. `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json` and the existing brand master remain authoritative.

The reviewed implementation is the feature stack from `origin/release-candidate`, including the final correction setting both SubscriptionViewSwitcher dimensions to 48.

## Surface decisions

- **Pro discovery and access:** `ProFeatureBadge` identifies statement imports, transaction exports and expanded card/wallet capacity. A badge describes a paid capability, rather than asserting that the current user owns Pro. `useProAccess` reads existing workspace access, rechecks it when acting and schedules an expiry refresh. `ProAccessProvider` presents the complete contextual Pro page in a closable full-screen modal without replacing the underlying editor. Owner changes clear the request. Existing billing services remain responsible for purchase, restore and entitlement verification.
- **Membership card:** `ProMembershipCard` uses the existing `hero`, `heroText` and `heroSecondary` pairs. The canonical `Brand` component keeps the Fourfold Bloom and supplied wordmark green/forest in light appearance and mint in dark appearance, independently of the chosen accent. The new decorative transparent WebP has prompt/provenance sidecars; it adds no new identity symbol. At widths below 380, the mark is compact and the artwork stacks below the copy. Wide layouts place the membership/benefits column beside the billing column.
- **Navigation:** Cards & wallets replaces Transactions in the sidebar and bottom tabs. The transaction route remains available elsewhere. Card/wallet management appears in the default Everyday Quick actions group without a search. Method records remain billing labels; the UI does not imply card verification or money movement.
- **Filtering:** one `FilterSheet` trigger serves each of subscriptions and Calendar. Opening copies applied values into a draft; dismissal discards draft changes; Apply commits the draft together and closes; Clear commits defaults immediately and closes. The footer keeps Apply and Clear available. The trigger shows the active count and a readable applied summary. Subscription search stays visible outside the sheet.
- **Filter contents:** subscriptions groups Status, Category, Billing method and Sort by. Calendar groups Event type and Currency. Existing loading/error recovery remains, including disabled billing-method choices until loaded. Defaults are all statuses/categories/methods with renewal-date sort, or all event types/currencies. Currency notes retain original-currency meaning; Timeline continues to follow event dates.
- **View controls:** List and Timeline use one icon-only grouped toolbar. Each named button is at least 48×48, with a 20px Lucide icon, selected accessibility state and web pressed state. The group uses the existing mint ground, surface selection and primary/secondary icon colors; the browser focus-visible treatment remains available.
- **Greeting:** Overview renders `Hi!, <profile name> 👋` only when display metadata belongs to the active non-guest owner. Missing, unusable or other-owner metadata yields `Hi! 👋`. The helper tries the existing profile-name fields in order, normalizes whitespace/control characters and ignores values over 80 characters. Names are display-only and do not determine identity, access or storage.

## Incumbent system comparison

| Area | Application in this stack |
| --- | --- |
| Colors | Reuses resolved semantic pairs across all eight accents and light/dark appearance. No palette primitives changed. Brand identity remains independent of accent. |
| Typography | Retains Manrope 700 headings and DM Sans labels/body. Pro-card headline sizes are local component variants (26 compact / 32 wide), not new font roles. |
| Spacing and shape | Uses the existing 24/32 spacing steps, 24px card radius and pill geometry. FilterSheet reuses PickerSheet and its adaptive shape. The 48px view targets are a local accessibility correction, not a replacement for the shared control scale. |
| Depth | Retains tonal surfaces, semantic borders and existing modal dimming. Raster artwork supplies tactile depth; no new shared shadow system. |
| Focus and controls | Reuses named actions and shared buttons/chips. View controls expose names and selection; shared web focus styling applies. Required actions do not depend on hover. |
| Motion | Retains shared sheet/button motion and reduced-motion handling. The card's bounded 240ms decorative artwork response uses `ReduceMotion.System`; the full-screen Pro modal switches to no animation when reduced motion is enabled. Logo geometry itself is not animated. |
| Data | Preserves free manual tracking, reminders, Calendar, JSON backup, three combined free billing labels, 50 Pro labels and access to existing records after downgrade. Existing guest persistence, owner-isolated saves, billing services, original currencies and date-only logic remain in charge. |

`DESIGN.md` and `.impeccable/design.json` are intentionally unchanged: these are surface applications of the incumbent system, with no durable approved system change. Shared primitives already include 44px compact controls; this existing native-platform consideration was not globally repaired or promoted to a new 48px system rule. No additional visual-system drift was established in this scoped comparison.

## Evidence and review scope

The recorded visual evidence is 13 React Native web captures under `.impeccable/review/mobile-pro-stack/`, spanning 320, 390, 1440 and 1940 widths, with Blue light and Violet dark examples:

- Pro: `mobile.png`, `desktop.png`, `pro-320.png`, `user-1940.png`, `pro-dark-mobile.png`, `pro-dark-desktop.png`.
- Navigation/Overview: `cards-mobile.png`, `home-mobile.png`.
- Filters/views: `calendar-sheet-mobile.png`, `subscriptions-sheet-mobile.png`, `subscriptions-sheet-desktop.png`, `subscriptions-mobile.png`, `subscriptions-desktop.png`.

The finish review found one material issue: the new view targets were 44×44. The final source sets both dimensions to 48; the parent measured rendered 48×48 targets and refreshed all four subscription captures. The focused finish verdict is **ship within the original web/source evidence scope**, with no remaining material correction. That verdict verifies the correction and its affected captures; it does not claim a new broad review of every final surface.

The parent manually exercised free Pro entry, modal close/Escape, draft dismissal/Apply/Clear, Cards tab/default Quick actions, Enter selecting Timeline and the guest greeting. Repository checks passed: 358 tests in 61 files, typecheck and lint, including all 16 accent/appearance contrast combinations and greeting fallback/owner isolation. The final web/iOS/Android export completed after the 48px correction (`/private/tmp/subloom-ui-final-export.log` ends `Exported: /private/tmp/subloom-ui-final-export`). Brand validation passed for 30 vector/token/component outputs and 63 manifest entries. These execution results are supplied by the parent; this documentation pass did not rerun them.

Native device/runtime behavior, live provider login, purchase/payments/restore, populated-data UI interactions and OS reduced-motion behavior remain untested. Existing reduced-motion paths are retained in source. Named signed-in greetings are covered by source/unit evidence, not a pictured signed-in session. Web captures and native exports do not prove safe areas, assistive-technology traversal, font scaling, gestures, modal stacking or device performance. No HTML/CSS detector result is claimed for React Native components.
