# Cancellation Watch

Open Quick actions, Subscription Radar, or a canceled subscription’s cancellation planner. Watch identifies user-imported, manually matched debit records in the same currency that occur after the later of a user-recorded cancellation date and paid-through date. A provider confirmation reference must have been recorded through the cancellation assistant. Existing canceled subscriptions can now record a missing reference without resetting the original cancellation date.

Flags request human review; they are not confirmed billing errors. Record open/contacted/resolved/expected status and a note. Possible later matched credits are displayed without automatically resolving a case. Export a plain-text evidence packet containing the supplied confirmation, cancellation/access dates, charge record and possible credits. No complaint, bank dispute, cancellation request, or refund is submitted automatically. Provider account links come from the existing first-party catalog.

Review metadata uses durable guest storage and owned, version-checked cloud settings; signed-in loading/saving needs a connection. Export/reset/account deletion include review history. Apply cancellation_watch after subscription_radar. No new provider credentials. This is PR 3 of 8, stacked on Subscription Radar.

Launch market: Europe and UK. Imported records only; bank-feed partners remain unconfigured.

Validation: npm run check passed (33 test files, 224 tests); Expo web/iOS/Android exports passed. Desktop dark appearance and empty state were inspected in the browser. Device runtime remains untested.
