# Subscription Value Coach

PR 7 of 8, based on Renewal Reserve. Merge Cards & Wallets → Radar → Watch → Autopilot → Virtual Card Plans → Reserve → Value Coach → Family Settlements. Apply the included migration before account use. Check-ins and quotes use durable guest/account settings, with export/reset support.

Optional monthly usage counts and keep/review/rotate goals show cost per use from matched imported net charges or labelled current recurring estimates. Zero uses and unavailable paused-status estimates do not invent a ratio. Currency-specific monthly/annual comparisons require the user to confirm comparable plan prices and supply a reference. Category overlap is only a review prompt. Rotation illustrations require 2–12 active monthly services in the same category/currency and explain fixed prices, one active service each month, immediate provider changes and no fees or overlapping access. No usage is collected from providers and no subscriptions are canceled or changed automatically.

Validation: npm run check passed (37 files, 236 tests); Expo web/iOS/Android exports passed. Browser check-in save confirmed a $120/year synthetic subscription with five uses shows the labelled $10 monthly estimate and $2/use. Native runtime untested.

Final review correction: check-ins and quotes show the newest 30 initially, with progressive disclosure for every saved record. Deleted-subscription check-ins remain visible and removable. Subscription selection preserves pending usage/quote drafts through explicit save/discard controls.
