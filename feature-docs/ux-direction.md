# UX improvement contract

Mode: Operate. Extend the established green Subloom interface; keep existing fonts, icons, functionality and truthful copy about billing, consent and sample data. Balance desktop/Mac with phones.

## Direction contract

THESIS: Put a subscription task or preference within reach without scanning unrelated controls.

OWN-WORLD: Retain Subloom's forest/mint palette, DM Sans/Manrope typography, restrained bordered surfaces and Lucide icons. Selection, focus and state carry the accent.

STORY: Find the subscription or setting, perform one named action, understand the result and continue without losing context.

FIRST VIEWPORT: Settings shows its title, compact section navigation and one readable group. Subscriptions shows search, filters, view selection and rows with accessible actions. The primary add action remains clear.

FORM: A refinement of the established operating interface, directly shaped from the owner's requested tasks; no replacement visual world or concept seed is required.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## First viewport and hierarchy

Settings presents five understandable groups: account, preferences, reminders, tools, and data/privacy. Only the chosen group is expanded, with a short description and useful controls visible immediately. Tools have their own group instead of being mixed into receipt settings. Mobile uses a compact horizontal section selector; desktop retains the app navigation and readable content width.

Subscriptions keeps search and status filters, adds clear list/timeline selection and a labelled row action menu. Quick actions are available throughout the app and through a keyboard shortcut on desktop. Empty filtered lists offer a way to clear filters.

## Signature interaction and motion

The signature interaction is a responsive quick-action sheet: search for an action, use it, and return to the task. Subscription row actions use the same protected-focus sheet pattern. Motion acknowledges a press, changes a selected section, and opens/closes a sheet. Most feedback runs in 150–240 ms; content does not wait through page-load choreography. Reduced motion preserves state and feedback without spatial animation.

## State and flow requirements

- Draft subscription changes prompt before leaving; saving remains durable before success is shown.
- Delete/cancel dialogs name the affected subscription and explain merchant billing limits. Cancel labels match the task; errors reset when reopening a dialog.
- Busy actions prevent repeated submission. Save failures preserve input and show contextual recovery.
- Web keyboard focus remains visible and returns to the triggering control after sheets close. Escape and platform back close overlays safely.
- Status, price, currency and recurrence are readable in list and detail views. Smaller screens do not depend on hover or swiping to discover actions.
- All existing features remain reachable; provider-dependent flows remain honest about availability.

## Review boundary

Verify desktop and mobile, light and dark states, keyboard use, reduced motion, settings navigation, quick actions, filtering, add/edit/discard, confirmations and error recovery. Run appropriate app checks and bundle exports. Finish with the Impeccable reviewer and documenter, preserving the incumbent visual system in the resulting design documentation.
