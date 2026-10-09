# Setup and deployment

## Local preview and native development

Use Node 22.13+ (or a supported newer LTS), npm, and the committed lockfile. `npm ci` also installs the Deno test runtime. Run `npm run dev` for the localhost web preview. `npm start` starts Metro for a development client. `npm run ios` needs full Xcode, CocoaPods and an iOS simulator/device; `npm run android` needs the Android SDK, Java and an emulator/device. Internet access is needed for first dependency installation and EAS builds.

The initial experience works without `.env`. Copy `.env.example` to `.env.local` to configure cloud features. Public fields are the Supabase project URL, **publishable/anon** key and EAS project UUID. Never use a service-role key in the app. Public build variables are visible in bundles. Restart Metro after environment changes.

## Supabase

1. Create separate development and production Supabase projects. Obtain the project URL and publishable/anon key from the dashboard. Set the public mobile values in `.env.local` and the corresponding EAS environment.
2. Install the official Supabase CLI. Authenticate, then link the appropriate project:

   ```sh
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

3. Deploy the nine functions:

   ```sh
   supabase functions deploy
   ```

4. Each function has `verify_jwt=false` deliberately: authenticated endpoints validate the bearer token using Supabase `getUser`; webhooks validate Svix signatures; worker endpoints validate a constant-time cron secret; digest preferences validate an expiring HMAC token. Turning off gateway JWT checks does not bypass these independent checks. Verify these routes against a staging project before release.
5. For the complete local backend, install Docker and run `supabase start`, then `supabase db reset` and `supabase functions serve --env-file /path/to/server-secrets.env`. Use values from `supabase status` for the app and local mail inbox for OTPs. Real providers require reachable webhook URLs. PostgreSQL WASM tests are not a replacement for this full stack.

### Authentication email

Enable email signup and email confirmation. The app uses `signInWithOtp` and `verifyOtp({type:'email'})` with a six-digit code. In **Authentication → Email Templates**, install `supabase/templates/auth-otp.html` in both **Magic link/OTP** and **Confirm signup**, with subject `Your Subloom sign-in code`. The template must contain `{{ .Token }}`; a link-only default template does not work with the code-entry screen.

Configure custom SMTP with host `smtp.resend.com`, port `465` (TLS) or `587` (STARTTLS), username `resend`, and a server-side Resend API key as the password. Use a verified sender and follow [Resend's SMTP settings](https://resend.com/docs/send-with-smtp). Disable link/open tracking on auth emails. Set the production Site URL to an owned support/app page; allow only needed redirect URLs (development localhost and `subloom://**` for native deep links). OTP entry does not depend on browser redirects.

Enable the project-level **email address changed** and **sign-in method linked/removed** security notifications when these account operations are available. `supabase/templates/auth-security.html` is a generic branded notification template that can be used for each with an appropriate subject. Supabase Auth owns verification and security sends; the reminder worker owns welcome/renewal/trial/candidate/digest sends. See [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates).

Apple/Google OAuth UI is intentionally unavailable until provider client IDs, redirect handling, account-linking and applicable store requirements are implemented and tested. Email OTP is the working authentication path.

### Guest upgrade

Connect an account from Settings, verify its email, then explicitly choose **Import my guest subscriptions**. Stable IDs prevent duplicates on retries, and sample data is excluded. The original guest snapshot remains available after signing out. Cloud-only use does not silently erase guest data. Offline account writes remain queued until authenticated synchronization succeeds; conflicts require choosing cloud or local values in Settings.

## Server secrets and Resend

Generate separate random 32-byte cron and email-preferences secrets. Put the following in a private server-only env file outside the repository; never print it or upload it as an artifact:

```dotenv
RESEND_API_KEY=re_REPLACE_WITH_SERVER_API_KEY
RESEND_WEBHOOK_SECRET=whsec_REPLACE_WITH_INBOUND_SIGNING_SECRET
RESEND_DELIVERY_WEBHOOK_SECRET=whsec_REPLACE_WITH_STATUS_SIGNING_SECRET
EMAIL_FROM=Subloom <reminders@YOUR_VERIFIED_DOMAIN>
INBOUND_DOMAIN=receipts.YOUR_VERIFIED_DOMAIN
APP_LINK_BASE=subloom://
CRON_SECRET=REPLACE_WITH_RANDOM_SECRET
EMAIL_PREFERENCES_SECRET=REPLACE_WITH_A_DIFFERENT_RANDOM_SECRET
```

Then deploy the secret file with `supabase secrets set --env-file /absolute/path/to/server-secrets.env`. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` inside functions automatically. Restrict access to these secrets, use separate provider keys per environment, and rotate webhook/cron keys through controlled deployment.

1. Verify a Resend sending domain and configure its SPF/DKIM records. Use a sender on that domain. Separate auth SMTP and API reminder keys if practical.
2. Configure an inbound receiving domain with Resend's provided DNS/MX records. Its exact domain must match `INBOUND_DOMAIN`. Use an API key permitted to retrieve received messages; webhooks contain identifiers, while the function retrieves receipt text using the Receiving API.
3. Create an `email.received` webhook to `https://YOUR_PROJECT_REF.supabase.co/functions/v1/inbound-receipt`; deploy its signing secret as `RESEND_WEBHOOK_SECRET`.
4. Create a separate webhook for `email.delivered`, `email.bounced`, `email.complained` and `email.failed` to `/functions/v1/email-status`; deploy its signing secret as `RESEND_DELIVERY_WEBHOOK_SECRET`.
5. In the authenticated app, create/copy a private forwarding address in Settings → Receipt forwarding. Addresses expire in 90 days, can be revoked immediately, and are limited to three active addresses. Forward a non-sensitive staging fixture. The webhook verifies the raw-body signature and timestamp, checks the exact recipient, hashes the random identifier, claims the provider event transactionally, and creates a **pending** candidate. It ignores attachments; forward readable email text or import an image separately.

Email API requests have a stable idempotency key, bounded retries within the provider's idempotency window, and recorded delivery states. A five-minute grace window allows status events that arrive before acceptance persistence; older untracked events (including Auth SMTP sends) are acknowledged without altering reminder delivery records. Optional digest messages include a signed preference link and one-click unsubscribe headers. GET shows a confirmation form; POST turns off digests. Renewal reminders are controlled through account Settings. Bounces/complaints suppress email at the profile level; after correcting the address or consent, an operator must carefully clear suppression before resuming.

Sources: [Resend webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests), [received email retrieval](https://resend.com/docs/api-reference/emails/retrieve-received-email), [idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Scheduling and retention

Enable Supabase Cron (`pg_cron`) and `pg_net`. In Vault create secrets named **subloom_project_url** (`https://YOUR_PROJECT_REF.supabase.co`) and **subloom_cron_secret** (exactly the function `CRON_SECRET`). Then run `supabase/ops/install-cron.sql` in the hosted SQL editor. It replaces only the three named Subloom jobs:

- Every minute: schedule due users and dispatch reminders.
- Daily at 03:17 UTC: purge aged evidence/delivery metadata.

The scheduler leases 25 users per invocation and revisits users approximately every five minutes at low load. The sender claims up to 50 deliveries per invocation. Provider calls are bounded at 15 seconds, but sequential worst-case batches may exceed hosted execution limits. Leases and idempotency recover interruption; **load-test throughput and reduce batch sizes or add carefully bounded concurrency before increasing traffic**. Monitor scheduling lag, not just HTTP success. Weekly digests are generated by the same scheduler on Monday in the user's timezone; no additional weekly job is needed.

Inspect `cron.job_run_details`, `net._http_response`, scheduling failure counts and delivery states without logging destinations, raw receipts or tokens. Alert on jobs absent/failed, persistent `unknown` push outcomes, growing retry queues, bounce spikes and stale `next_check_at`. Purge cron/network response logs according to the platform's operating policy. Configure backup retention and access for Supabase separately.

See [Supabase scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions). The Cron installer is operator configuration, not an automatic migration, so local database tests don't need hosted extensions.

## Screenshot OCR

Enable Google Cloud Vision in a dedicated Cloud project, enable billing, and create an API key restricted to the **Cloud Vision API**. Set it server-side as `GOOGLE_VISION_API_KEY`. Establish quotas, budget alerts, processing/data-region requirements and an external processor agreement before production use.

The app explicitly explains the destination and asks consent before upload. The authenticated function rate-limits requests, accepts JPEG/PNG/WebP only, checks size and magic bytes, calls the fixed Vision endpoint with a 15-second timeout, and validates the response. No raw image or OCR body is stored in Subloom cloud storage or logs. Without the key, screenshot reading reports an error and text import remains available. See [Vision OCR](https://docs.cloud.google.com/vision/docs/ocr).

## Native push and EAS

1. Set owned iOS bundle and Android package IDs in `app.config.ts`. The current `com.subloom.app` is a replaceable project identifier.
2. Install and authenticate the EAS CLI, then link this project:

   ```sh
   npm install --global eas-cli
   eas login
   eas init
   ```

   Set `EXPO_PUBLIC_EAS_PROJECT_ID` to the linked project's UUID. See [EAS build setup](https://docs.expo.dev/build/setup/).
3. Configure Apple team/APNs credentials and Android Firebase/FCM v1 credentials through `eas credentials`, following [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/). If Firebase configuration requires a `google-services.json`, supply your environment-specific file and `android.googleServicesFile` in app config; don't commit private service-account keys.
4. Build:

   ```sh
   eas build --platform ios --profile development
   eas build --platform android --profile development
   eas build --platform ios --profile simulator
   ```

5. Install on physical devices. Connect a verified staging account, then enable push in Settings. The permission prompt is contextual. Denial produces a useful error. Server reminders require an account, enabled channel and synced subscription; guest/sample mode never pretends to deliver.
6. For enhanced Expo push security, enable it in Expo and set a scoped `EXPO_ACCESS_TOKEN` on the backend. The worker handles tickets, polls receipts and revokes invalid device tokens. A provider-accepted ticket is not proof the user saw a notification. See [Expo sending/receipts](https://docs.expo.dev/push-notifications/sending-notifications/).
7. Complete the device tests, release review and dependency audit before `eas build --profile production` and store submission. Build configuration is included; no native binary has been built or uploaded here.

Incoming share extensions are not enabled in this release. Photo selection, document import and pasted text work through supported APIs. Expo's [SDK 57 incoming sharing](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/) is experimental, and its iOS app-opening mechanism is explicitly not officially supported by Apple. A production share extension is a separate native milestone.
