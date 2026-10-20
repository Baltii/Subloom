# First-run onboarding

- Purpose: introduce subscription tracking and upcoming renewals in no more than three steps, then offer authentication or local use.
- Entry: existing persisted `onboarded` flag; account sync is checked first. Returning users keep their workspace. Settings → Data & privacy → Welcome tour safely replays the flow.
- Jobs: Continue, Back, Skip intro, choose accent/appearance, optionally adjust currency/timezone, create/sign in or use this device. Completion waits for the durable save; failures retain setup inputs.
- Identity: Subloom’s bloom mark, subscription organizer, renewal calendar/bell and connected devices. All three illustrations are original theme-aware vector art with no fake financial records.
- Theme/type: retained Pastel consumer direction (seed 35175425), existing Manrope/DM Sans and semantic colors. All eight accents and light/dark/system appearance apply immediately to illustrations and controls. No new packages.
- Layout: desktop split with artwork sized to its column; compact layouts stack and scroll. Header uses the compact brand below 360px. A compact option keeps theme choices in two columns inside the sheet.
- Accessibility/motion: decorative SVG hidden, visible step count plus accessible progress, polite step-copy announcements, labeled existing controls. No new animations beyond inherited reduced-motion-aware feedback.
- Validation: 321 tests / 54 files plus typecheck/lint and web/iOS/Android exports passed; Taste source lint 0 FAIL / 0 WARN. Local browser review was blocked by automatic approval review and retry authorization is pending. Native interaction and signed-in UI were not tested for this change.
- Delivery/merge order: billing PR #47 → release-candidate, then onboarding PR → release-candidate, later promote release to main. Requested live CLI deployment is independent of PR merges; see `feature-docs/first-run-onboarding.md` for actual deployment results.
