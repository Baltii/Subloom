# Cards & wallets

Open Settings → Subscription tools → Cards & wallets, Quick actions, or a subscription’s details. Add up to 50 named cards, banks, or wallets. Cards store only optional last-four digits and expiry; full card numbers, security codes, and banking passwords are rejected/not requested. Link each subscription to one source. The hub shows original-currency recurring estimates, upcoming scheduled charges, expiry warnings, and a review checklist when payment details change. Mark a service reviewed only after checking its billing provider. Moving/removing a link changes Subloom metadata only.

Guests use durable existing feature-setting storage. Signed-in users use the existing version-checked, owner-isolated settings RPC; loading and saving requires a connection. Errors keep form input, and reload recovers version conflicts. Demo edits are disabled. Account deletion cascades settings; guest reset and JSON export include payment-source metadata.

Apply the payment_sources migration before signed-in use. No provider credentials or funds are involved. This is PR 1 of 8: Cards & Wallets → Radar → Cancellation Watch → Autopilot → Virtual Card Plans → Reserve → Value Coach → Family Settlements. The feature stack starts from main; the separate Android build fix PR remains independent.
