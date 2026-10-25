# Private ideas and feedback

Settings → Feedback opens the Ideas & feedback form. It is also searchable in Quick actions. Guests and signed-in users can submit without Pro or a GitHub account.

The form uses a topic, one message field, and an optional reply email. Its short inbox title is generated from the message, so people do not need to write a separate subject. The website at [Ideas & feedback](https://subloom-landing.baltii.tn/feedback) uses the same public endpoint and private email delivery, with a `website@` version label.

Submissions contain a category (`idea`, `problem`, or `feedback`), title, message, optional reply email, app version and platform. The app does not attach account IDs, subscription records, screenshots or logs. Submissions are separate from synced account data and are not automatically included in account deletion or account exports.

## Review your inbox

New feedback is emailed to **baltii.ahmed@gmail.com** using the existing Resend sender. The category, full message, optional reply email, app version and platform are included. If the sender supplies a reply email, it becomes the email’s Reply-To address. The recipient is fixed in the server code and cannot be selected by app users. No automatic reply is sent to the submitter.

The database keeps a private backup. Open the [Subloom Table Editor](https://supabase.com/dashboard/project/fdjsmpmgrwzmqovzundx/editor), select the `public` schema, and open `app_feedback`. Sort by `created_at` descending. Update `status` from `new` to `reviewing`, `planned` or `closed` as you process messages. Keep message contents unchanged while email delivery is pending, so provider retry requests remain identical.

Only project administrators and server credentials can read or manage this table. Guests and authenticated app users cannot read, insert, update or delete submissions directly. Row-level security remains enabled without client policies. Delete messages manually when no longer needed, including any optional contact details.

## Deployment and verification

Apply the `feedback_inbox` and `feedback_email_delivery` migrations, then deploy `submit-feedback` and `send-feedback-email`. `npm run deploy:supabase` includes these changes. Sending reuses the server-only `RESEND_API_KEY` and `EMAIL_FROM` settings. The submission function intentionally has gateway JWT verification disabled so guests can submit, with validation and rate limiting in the handler. The delivery worker requires the existing `CRON_SECRET`.

The submission endpoint attempts delivery immediately. The `subloom-feedback` cron job retries queued messages every minute using the existing Vault scheduler settings. `supabase/ops/install-cron.sql` includes this job, and `npm run configure:scheduler` verifies it alongside the reminder jobs. Install the worker before installing its cron job.

`email_sent_at` and `email_provider_id` record provider acceptance, not proof of inbox delivery. Failed sends retain the backup and retry with exponential backoff, up to eight attempts. `email_error` shows pending/failed delivery; messages with exhausted attempts or `email_first_attempt_at` more than 23 hours old need manual review. This retry window stays inside Resend’s 24-hour idempotency window. Stable provider keys, canonical saved content and leased claims prevent normal retries or simultaneous workers from sending duplicates.

The app reports success only after the backend confirms the matching request ID. Retrying the same request cannot create a duplicate or overwrite the original. Editing a failed message creates a new request ID. Form input remains available after delivery errors and navigation warns before discarding unsent changes.

The function limits request sizes and applies hourly, daily, and overall quotas through the existing atomic rate-limit function. Hosted requests use the Cloudflare-provided `CF-Connecting-IP` value to derive a keyed hash; the raw address is not saved by this feature. Untrusted `X-Forwarded-For` chains are ignored. Missing ingress metadata shares a fallback bucket. Deployments outside hosted Supabase must review their ingress/header trust before enabling this endpoint publicly. Existing rate-bucket retention clears inactive entries.

Relevant references: [Cloudflare request headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip), [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), and [Resend’s send API](https://resend.com/docs/api-reference/emails/send-email).

## Illustration

`assets/illustrations/feedback-conversation.webp` was generated with the built-in image generation tool for this feature, then compressed to a transparent WebP (768 × 628, about 42 KB). The prompt describes two soft matte forest-green and mint conversation bubbles, one smiling, with a small ivory paper plane; no text, logos, gradients or decorative glow. The website reuses this public asset. Entrance and success animations play once and honor reduced-motion preferences.
