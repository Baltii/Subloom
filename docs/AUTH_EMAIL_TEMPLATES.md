# Supabase-hosted authentication email templates

The Supabase Auth Site URL is `https://app.subloom.tn` (without a trailing slash). Branded Auth HTML must use **`{{ .SiteURL }}`** instead of hardcoding that domain. When the Site URL changes in Supabase, assets and navigation links in these templates follow automatically.

Do not confuse this with the `APP_LINK_BASE` Edge Function secret: that secret controls **Resend reminder/feedback emails**, not Auth Go templates.

## Template sources

- `supabase/templates/auth-otp.html`: Subloom code-based sign-in and sign-up. Uses `{{ .Token }}` as required by the app's `signInWithOtp()` / `verifyOtp({ type: "email" })` flow.
- `supabase/templates/auth-security.html`: a generic security notification, suitable only for notification types whose message matches this content. Enable notifications deliberately; do not change an Auth flow to a link-based confirmation without updating the client.

All links, logo and illustration URLs in these two HTML files use `{{ .SiteURL }}`.

## Apply to the hosted Supabase project

**Merging a PR or deploying Edge Functions does not update hosted Supabase Auth templates.**

1. In the Subloom Supabase project, go to **Authentication → URL Configuration**, and confirm that the Site URL is exactly `https://app.subloom.tn` (without a trailing slash). Keep `https://app.subloom.tn/auth-callback` and `subloom://auth-callback` in the redirect allowlist.
2. Open **Authentication → Email Templates**. For the **Magic Link** template (Subloom's email-code sign-in), paste the entire contents of `supabase/templates/auth-otp.html`. For **Confirm signup**, use that OTP template if the project uses code-based signup rather than click-to-confirm. Keep the token placeholder `{{ .Token }}` intact.
3. For any **Security notification** where this generic text is applicable, use `supabase/templates/auth-security.html`. Don't enable unrelated email notifications merely to apply this template.
4. Review other hosted templates that are **not represented by these two repository files**: invitations, recovery, email change, reauthentication and individual security notices. Change **branding/assets/navigation** from old absolute Subloom domains to `{{ .SiteURL }}` where applicable. Preserve verification links such as `{{ .ConfirmationURL }}`, and preserve `{{ .TokenHash }}` when it is already used for an actual verification flow. Don't replace these verification URLs with `{{ .SiteURL }}`.
5. Save the templates in the dashboard and test a code-based sign-in, signup (if enabled) and an applicable security email. Confirm the logo/illustration URLs and links resolve to `https://app.subloom.tn`.

Do **not** use `{{ .RedirectTo }}` as the base for hosted email images or for the OTP email's ordinary navigation buttons: it can contain a native `subloom://` callback or a different allowed redirect. `{{ .ConfirmationURL }}` is used for verification when an email explicitly offers one-click confirmation and shouldn't be replaced with a generic app homepage.

The local CLI config maps the magic-link and signup-confirmation templates to `auth-otp.html` for the project's OTP workflow. Hosted settings are managed separately by the Supabase Dashboard or Management API.

## Verify code changes

- `npm test` includes unit checks that render each template against two different example Site URLs, verifying that no hardcoded production hostname remains and that OTP tokens are preserved.
- `npm run preview:emails` substitutes `{{ .SiteURL }}` only **for offline previews**. In real Auth messages, Supabase performs the substitution.
- Remember: no real email is sent by these tests or previews.
