# Setup and deployment

## Local preview and native development

Use Node 22.13+ (or a supported newer LTS), npm, and the committed lockfile. `npm ci` also installs the Deno test runtime. Run `npm run dev` for the localhost web preview. `npm start` starts Metro for a development client. `npm run ios` needs full Xcode, CocoaPods and an iOS simulator/device; `npm run android` needs the Android SDK, Java and an emulator/device. Internet access is needed for first dependency installation and EAS builds.

The initial experience works without `.env`. Copy `.env.example` to `.env.local` to configure cloud features. Public fields are the Supabase project URL, **publishable/anon** key and EAS project UUID. Never use a service-role key in the app. Public build variables are visible in bundles. Restart Metro after environment changes.

## Supabase

1. Create separate development and production Supabase projects. Obtain the project URL and publishable/anon key from the dashboard. Set the public mobile values in `.env.local` and the corresponding EAS environment.
2. The official Supabase CLI is pinned in this repository. Authenticate from Terminal, then preview the migrations targeting the hosted URL configured in `.env.local`:

   ```sh
   npx supabase login --agent no --output-format text
   npm run deploy:supabase -- --plan
   ```

3. Deploy the pending migrations and ten functions, then run the live acceptance script:

   ```sh
   npm run deploy:supabase
   npm run test:live
   ```

   Deployment uses server-side function bundling, so Docker is not required. It does not seed sample data, prune other functions, change Vault secrets, install Cron or configure SMTP/provider credentials. It runs security advisors after deployment. If the CLI requests a database password, enter it in Terminal or use the private `SUPABASE_DB_PASSWORD` environment variable; never put it in an `EXPO_PUBLIC_` variable. See the [test runbook](TESTING.md) for the disposable-account checks.

4. Each function has `verify_jwt=false` deliberately: authenticated endpoints validate the bearer token using Supabase `getUser`; webhooks validate Svix signatures; worker endpoints validate a constant-time cron secret; digest preferences validate an expiring HMAC token. Turning off gateway JWT checks does not bypass these independent checks. Verify these routes against a staging project before release.
5. For the complete local backend, install Docker and run `supabase start`, then `supabase db reset` and `supabase functions serve --env-file /path/to/server-secrets.env`. Use values from `supabase status` for the app and local mail inbox for OTPs. Real providers require reachable webhook URLs. PostgreSQL WASM tests are not a replacement for this full stack.

### Authentication email

Enable email signup and email confirmation. The app uses `signInWithOtp` and `verifyOtp({type:'email'})`; its code-entry field accepts the numeric OTP length configured by Supabase. In **Authentication → Email Templates**, install `supabase/templates/auth-otp.html` in both **Magic link/OTP** and **Confirm signup**, with subject `Your Subloom sign-in code`. The template must contain `{{ .Token }}`; a link-only default template does not work with the code-entry screen.

The current hosted SMTP host/port/user were verified, and a temporary `onboarding@resend.dev` test was delivered to the user’s Gmail address. The original `subloom.io` sender was restored and remains blocked until the domain is verified in Resend. Confirmation/magic-link code templates are installed for this project. Resend’s test sender is limited to the Resend account’s email and is for development only.

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

The hosted Subloom project now has all three jobs installed. To install or reconcile them for the configured project, run:

```sh
npm run configure:scheduler
```

This command generates a cron secret, deploys it to Edge Functions, installs `pg_cron`/`pg_net`, stores matching Vault values, and replaces only the three named jobs. The private credential file is `~/.config/subloom/<project-ref>/scheduler.env` with mode 0600; it stays outside Git. Preserve it for reruns. If an existing remote cron secret has no matching local file, the script stops instead of overwriting it. Temporary secret-bearing SQL is private and deleted after use. Results contain no credentials.

For manual installation, enable Supabase Cron (`pg_cron`) and `pg_net`. In Vault create secrets named **subloom_project_url** (`https://YOUR_PROJECT_REF.supabase.co`) and **subloom_cron_secret** (exactly the function `CRON_SECRET`). Then run `supabase/ops/install-cron.sql` in the hosted SQL editor. It replaces only the three named Subloom jobs:

- Every minute: schedule due users and dispatch reminders.
- Daily at 03:17 UTC: purge aged evidence/delivery metadata.

The scheduler leases 25 users per invocation and revisits users approximately every five minutes at low load. The sender claims up to five deliveries per invocation to bound sequential provider calls, each limited to 15 seconds. Leases and idempotency recover interruption. Load-test throughput and use carefully bounded concurrency before increasing traffic. Monitor scheduling lag, not just HTTP success. Weekly digests are generated by the same scheduler on Monday in the user's timezone; no additional weekly job is needed.

Inspect `cron.job_run_details`, `net._http_response`, scheduling failure counts and delivery states without logging destinations, raw receipts or tokens. Alert on jobs absent/failed, persistent `unknown` push outcomes, growing retry queues, bounce spikes and stale `next_check_at`. Purge cron/network response logs according to the platform's operating policy. Configure backup retention and access for Supabase separately.

See [Supabase scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions). The Cron installer is operator configuration, not an automatic migration, so local database tests don't need hosted extensions.

## Screenshot OCR

Enable Google Cloud Vision in a dedicated Cloud project, enable billing, and create an API key restricted to the **Cloud Vision API**. Set it server-side as `GOOGLE_VISION_API_KEY`. Establish quotas, budget alerts, processing/data-region requirements and an external processor agreement before production use.

The app explicitly explains the destination and asks consent before upload. The authenticated function rate-limits requests, accepts JPEG/PNG/WebP only, checks size and magic bytes, calls the fixed Vision endpoint with a 15-second timeout, and validates the response. No raw image or OCR body is stored in Subloom cloud storage or logs. Without the key, screenshot reading reports an error and text import remains available. See [Vision OCR](https://docs.cloud.google.com/vision/docs/ocr).

## Native push and EAS

Mac notifications are disabled by request; account sync works in the standalone Mac app. Use [the Mac instructions](MACOS.md). EAS project `@baltii/subloom` is linked and its public Supabase/project settings are configured for development, preview and production. Neither platform has push/signing credentials configured yet.

Use `npm run eas -- <command>` in this repository: the wrapper loads local public configuration for EAS app-config evaluation and excludes server integration keys from the child environment.

1. Set owned iOS bundle and Android package IDs in `app.config.ts`. The current `com.subloom.app` is a replaceable project identifier.
2. Install and authenticate the EAS CLI, then link this project:

   ```sh
   npm install --global eas-cli
   npm run eas -- login
   npm run eas -- init
   ```

   Set `EXPO_PUBLIC_EAS_PROJECT_ID` to the linked project's UUID. See [EAS build setup](https://docs.expo.dev/build/setup/).

3. Configure Apple team/APNs credentials and Android Firebase/FCM v1 credentials through `npm run eas -- credentials --platform ios` and `npm run eas -- credentials --platform android`, following [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/). Android requires the Firebase `google-services.json` for `com.subloom.app` plus an FCM v1 service-account key uploaded to EAS. App config reads `GOOGLE_SERVICES_JSON` (an EAS file variable) or a local `google-services.json`. The service-account key is server-only and must never be bundled or committed. Follow [Expo FCM v1 setup](https://docs.expo.dev/push-notifications/fcm-credentials/). iOS requires a paid Apple Developer account and APNs/signing credentials.
4. Build:

   ```sh
   npm run eas -- build --platform ios --profile development
   npm run eas -- build --platform android --profile development
   npm run eas -- build --platform ios --profile simulator
   ```

5. Install on physical devices. Connect a verified staging account, then enable Mobile push reminders and enable delivery on each phone in Settings. You can turn off one phone while preserving reminders on the other devices. Use Send a test notification after registration; queued means the worker has accepted the request, not that the device received it. The permission prompt is contextual. Denial produces a useful error. Server reminders require an account, enabled channel and synced subscription; guest/sample mode never pretends to deliver.
6. For enhanced Expo push security, enable it in Expo and set a scoped `EXPO_ACCESS_TOKEN` on the backend. The worker handles tickets, polls receipts and revokes invalid device tokens. A provider-accepted ticket is not proof the user saw a notification. See [Expo sending/receipts](https://docs.expo.dev/push-notifications/sending-notifications/).
7. Complete the device tests, release review and dependency audit before `eas build --profile production` and store submission. Build configuration is included; no native binary has been built or uploaded here.

Incoming share extensions are not enabled in this release. Photo selection, document import and pasted text work through supported APIs. Expo's [SDK 57 incoming sharing](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/) is experimental, and its iOS app-opening mechanism is explicitly not officially supported by Apple. A production share extension is a separate native milestone.
