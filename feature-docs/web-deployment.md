# Production web deployment

Subloom is hosted at **https://subloom.baltii.tn** on the existing `baltiis-projects/subloom` Vercel project, connected to `Baltii/Subloom`. The production branch is `main`. Features are reviewed on `release-candidate` before promotion to `main`.

## Build and routing

`vercel.json` declares the complete deployment contract:

- Install with `npm ci` on the project's existing Node 24 runtime.
- Build the Expo web application with `npm run export:web`.
- Publish only the generated `dist` directory.
- Resolve client-side routes to the application entry point, including direct visits and reloads on `/payments`, `/finance` and `/auth-callback`.
- Send `nosniff` and no-referrer headers.

The original Vercel setup used the generic Other preset without a build command/output directory. Its deployments could report Ready while serving no application entry point, causing the custom domain's 404. The explicit build configuration fixes that for subsequent GitHub deployments. The domain was already verified and assigned to the correct Vercel project; no DNS change or domain purchase was needed.

`.vercelignore` excludes local environment files, caches and native build products from CLI uploads. `.vercel/` stays out of Git. Do not deploy the repository root or the old `.vercel/output/static` folder as the website: those are not Expo's web export.

## Public app configuration

The existing public values are configured for both Vercel production and preview:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_EAS_PROJECT_ID`

They are embedded by Expo during the build. Changing them requires a new deployment. No Resend, mailbox, OCR, service-role, cron or other server secrets belong in Vercel's client build configuration.

## Backend and callbacks

The existing Supabase project `fdjsmpmgrwzmqovzundx` has the integrated schema (23 migrations), 14 deployed functions and four scheduling/retention jobs. This includes the daily reference-rate refresh at 17:30 UTC. Initial reference rates cover all nine supported USD quote currencies and retain each provider's observation date.

The production Auth site URL is `https://subloom.baltii.tn`; its exact `https://subloom.baltii.tn/auth-callback` redirect is allowed alongside the existing localhost and `subloom://auth-callback` redirects. Google, SMTP, email confirmation, eight-digit OTP and MFA settings were preserved. Mailbox app returns use `https://subloom.baltii.tn/mailboxes`.

Live deployment testing found the Bitcoin function could not boot because a shared import lacked its `.ts` extension. The import is explicit now, and backend checks no longer enable sloppy import resolution. Shared test fixtures use explicit extensions too. The hosted smoke workflow subsequently passed **27 checks** with zero failed checks and zero failed disposable-account cleanups. It sends no real email/push, connects no personal mailbox and moves no money.

Local validation passed TypeScript, lint, **291 app/Postgres tests**, strict backend checks and **24 backend tests**. The expensive family-ledger capacity fixture now seeds its bulk history efficiently in its disposable local test database; the real admission trigger is enabled for permission, correction and capacity-limit assertions. Production database triggers are unchanged by that test optimization.

## Verification after a production deployment

1. Confirm the production deployment's Git commit matches `main`.
2. Open the custom domain, complete a guest first run, add/edit a synthetic subscription and reload to verify persistence.
3. Open Calendar, Activity, Settings, the payment hub, transaction journal and control-center screens. Test a compact viewport and keyboard navigation.
4. Request a nested route directly and reload it. Verify the root HTML's JavaScript, font and illustration URLs return their actual asset types rather than fallback HTML.
5. Check browser errors and validate the public Supabase configuration and reference-rate access.
6. For backend changes, run `npm run test:live` against disposable, email-suppressed accounts and verify cleanup.

Optional provider limitations and upstream package advisories from [the initial readiness review](app-readiness.md) still apply. In particular, personal Google consent, Apple, Gmail/Outlook, OCR, general-recipient email delivery, mobile push and SAML need their documented credentials/configuration and separate live verification. A working guest website does not certify those external flows.
