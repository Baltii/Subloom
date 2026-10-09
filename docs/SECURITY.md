# Security and privacy review

## Implemented boundaries

The Supabase service-role key, Resend keys, Vision key, webhook secrets and cron/HMAC secrets remain in server configuration. Mobile contains only public project configuration. Native refresh credentials are stored in SecureStore using chunked, generation-switched writes; web credentials use browser storage and depend on the web origin's security. Session refresh/listeners are cleaned up.

All user-owned PostgreSQL tables have RLS. Client reads require ownership; cloud mutations use an authenticated, transactionally locked `apply_operation` RPC. Push registration has explicit owner policies. Mutation IDs are unique and idempotent; subscription revisions enforce conflicts; confirmation changes the subscription and pending candidate in one transaction. Cross-user UUID reuse, confirmation and device registration are rejected. Workers re-read ownership, current subscription versions, channels, quiet hours, verified email and device status before delivery.

Authenticated Edge Functions verify the session through Auth `getUser`. Server-only endpoints verify constant-time cron secrets or raw-body Svix signatures with timestamp checks. Inbound events are claimed transactionally for replay/retry safety. Aliases use cryptographic random identifiers, hashed lookup, exact recipient-domain checks, 90-day expiration and revocation. Knowing an alias allows forwarding to that account, but only creates a pending candidate. No sender is trusted to authorize a subscription.

Uploads have streaming size limits and allowlisted types; OCR checks magic bytes. Inbound messages are limited and attachments ignored. Extraction executes no receipt instructions, code, embedded URLs or scripts. No LLM provider receives receipt data. Vision receives only the user-selected image after consent. Extracted candidates are schema validated, confidence is a configurable heuristic, ambiguous fields stay missing, and no candidate becomes tracked without explicit confirmation.

Requests to Resend, Expo and Vision use fixed provider endpoints and bounded timeouts. Errors do not include provider bodies, secrets or full receipts. Provider test adapters are used only in tests. Production paths fail when providers are unavailable rather than returning simulated success.

## Data handling and retention

| Data                                                                 | Location                                                                                  | Retention/deletion                                                                       |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Subscription details, extracted candidates, preferences and activity | Identity-scoped SQLite/browser cache and authenticated Supabase tables                    | Until user deletion/reset; account deletion cascades cloud rows                          |
| Refresh credentials                                                  | Native SecureStore; web browser storage                                                   | Session lifecycle/logout                                                                 |
| Original pasted text                                                 | Screen memory                                                                             | No cloud persistence; released on leaving screen                                         |
| Selected image / imported document                                   | Picker cache and screen memory; OCR image sent transiently to backend/Vision with consent | Temporary device copies can exist in OS/app caches; no raw Subloom cloud receipt storage |
| Evidence metadata (fingerprint, hashed sender, provider message ID)  | Supabase                                                                                  | 90 days, via installed retention job                                                     |
| Notification events, destinations and delivery status                | Supabase                                                                                  | 90 days, cascading removal through events                                                |
| Webhook replay records                                               | Supabase                                                                                  | 30 days; signature timestamp validation still rejects stale replays                      |
| Rate-limit buckets                                                   | Supabase                                                                                  | One day                                                                                  |
| Mutation result IDs                                                  | Supabase                                                                                  | Until account deletion, to deduplicate old offline retries                               |
| Forwarding addresses                                                 | Supabase                                                                                  | Expire/revoke; account deletion removes them                                             |

`purge_retained_metadata` performs bounded batches of 5,000 rows per class; monitor backlog and increase job frequency if needed. Configure provider receipt retention, Supabase backups and platform logs separately. Account deletion cannot retroactively erase independent provider backups or already delivered mail. Data cached on another offline device is not remotely erased until that device reconnects or clears local storage.

SQLite and browser snapshots are **not application-level encrypted**. They rely on device/app sandbox protection, OS encryption and browser-origin isolation. Do not claim end-to-end encryption. Exclude sensitive caches from device backups or implement reviewed SQLCipher/key lifecycle before a stricter threat model requires it. Supabase server access and support access must be controlled and audited by the operator.

Guest data survives account connection unless the user chooses deletion. Account export reads all cloud pages after queued sync; guest export clearly identifies its local scope. Account deletion removes both the account and guest snapshots on the initiating device. Signing out retains the separate guest workspace; the account's cached data remains identity scoped and is not shown to another account.

## Release checklist

- [ ] Configure production domains, SMTP, OTP templates, secret rotation, Supabase backup/access policy and restrictive redirect allowlist.
- [ ] Run full local/staging Supabase tests with two real accounts, including expired sessions, guest upgrade, offline conflict recovery and deletion.
- [ ] Verify no server credentials are present in Expo public config, compiled bundles, Git, logs, crash reports or exported archives.
- [ ] Test inbound signatures, stale/repeated webhooks, oversized/chunked uploads, alias revocation, rate limits and malformed parser/provider output against deployed endpoints.
- [ ] Review and resolve/accept upstream dependency findings with a written reachability assessment; see KNOWN_LIMITS.md. No store release is approved by passing unit tests alone.
- [ ] Test physical-device push permission denial, private lock-screen content, deep links, token invalidation, multi-device delivery and update-before-send races.
- [ ] Verify Resend acceptance/status ordering, idempotent retries, bounce/complaint suppression and digest opt-out. Do not call provider acceptance “seen by user.”
- [ ] Load-test scheduler/sender execution limits and alert on lag, unknown outcomes, failed jobs and retention backlog.
- [ ] Confirm Google Vision data processing terms, quota/budget, processor disclosures and receipt-consent copy for deployment region.
- [ ] Supply a real support address/site, public privacy policy, store account-deletion information and app-store privacy disclosures.
- [ ] Complete VoiceOver/TalkBack, large text, reduced motion, contrast, background/foreground and real-device performance review.

Disclose email/account identifiers, subscription financial information, selected receipt content, device push tokens and external processors (Supabase, Resend, Expo Push, optional Google Vision). No bank credentials, payment-card numbers, advertising identifier or unrelated mailbox/notification data is requested. No advertising/profiling SDK or analytics SDK is installed. Future crash monitoring must redact payloads and obtain the appropriate consent/disclosure.

The audit checklist is a release workflow, not a legal or security certification. Record completed checks with evidence for the actual deployment.
