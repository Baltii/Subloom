# Feature setup — 2026-10-11

Target: existing test project `fdjsmpmgrwzmqovzundx`. App origin: **http://localhost:8081**, selected by the owner. These deployments use the existing Supabase and Resend configuration. No sending domain, paid plan or external identity provider was purchased or registered.

`codex/macos-local-reminders` is rebased onto `codex/team-sso`. It contains all ten features, Mac storage/reminders, CI and the previously uncommitted email templates. The original history and email changes remain on local backup branch `codex/backup-macos-before-feature-rebase`. PR #3 follows #13 in the stack; merge the feature PRs in the order listed in [README](README.md).

| Order | Feature                                             | Setup completed                                                              | Remaining requirement                                                                    |
| ----- | --------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1     | [Budgets](monthly-budgets.md)                       | Migration 001, cloud settings and version checks                             | None for testing                                                                         |
| 2     | [Savings simulator](savings-simulator.md)           | Included in the rebuilt app; no extra service                                | None for testing                                                                         |
| 3     | [CSV import/export](csv-import-export.md)           | Included in the rebuilt app; no extra service                                | None for testing                                                                         |
| 4     | [Calendar export](calendar-export.md)               | Included in the rebuilt app; private ICS export                              | None for testing                                                                         |
| 5     | [Cancellation assistant](cancellation-assistant.md) | Migration 001 and cloud checklist storage                                    | None; merchant cancellation remains manual                                               |
| 6     | [Price history](price-history.md)                   | Migration 002 and server capture trigger                                     | None for testing                                                                         |
| 7     | [Family workspaces](family-workspaces.md)           | Migration 003 and the compatible SSO guards from 005                         | None for testing                                                                         |
| 8     | [Google/Apple login](google-apple-login.md)         | Local web/native redirect allowlist                                          | Google and Apple credentials; live browser/device callbacks                              |
| 9     | [Mailbox discovery](mailbox-discovery.md)           | Migration 004, two deployed functions, private encryption key and return URL | Gmail and Microsoft OAuth app credentials/consent; live scanning                         |
| 10    | [Team SAML SSO](team-workspaces-sso.md)             | Migration 005, tenant guards and denied non-SSO access                       | Eligible Supabase SAML configuration, organization domain and IdP metadata; live sign-in |

All five new migrations were applied separately at their corresponding steps. Twelve Edge Functions are active. The existing three scheduling/delivery/retention jobs remain active. Google and Apple are disabled in the live Auth settings, no Gmail/Microsoft client secrets are configured, and the SSO provider list is empty. The last three feature PRs therefore remain drafts.

## Repeat setup one feature at a time

Authenticate the Supabase CLI with access to the intended project and configure `.env.local` with its public URL/key. Preview any step by adding `--plan`; omit it to apply its schema prerequisites.

```sh
npm run setup:feature -- budgets --plan
npm run setup:feature -- budgets
npm run setup:feature -- savings
npm run setup:feature -- csv
npm run setup:feature -- calendar
npm run setup:feature -- cancellation
npm run setup:feature -- price-history
npm run setup:feature -- family
npm run setup:feature -- social
npm run setup:feature -- mailbox
npm run setup:feature -- sso
npm run deploy:supabase
npm run test:live
```

The setup command checks hosted migration history, uses a temporary migration directory and preserves already-applied later versions when repeating earlier steps. It refuses unknown remote migrations. It does not repair history, prune functions, seed data, change Vault, register providers or claim live provider setup is finished. Local per-step reports are in ignored `build/feature-setup/`.

## Continue with credentials in this order

1. **Google login:** create a Google OAuth web client and configure its client ID/secret in [Supabase Auth providers](https://supabase.com/dashboard/project/fdjsmpmgrwzmqovzundx/auth/providers). Register `https://fdjsmpmgrwzmqovzundx.supabase.co/auth/v1/callback` as the provider callback, and `http://localhost:8081` as the testing web origin. Test login/logout and account isolation in the local browser.
2. **Apple login:** configure the Services ID, Team ID, Key ID and generated OAuth secret from the private `.p8` signing key in the same dashboard. Apple domain registration and secret renewal are external requirements. Follow [Apple setup](google-apple-login.md) before testing.
3. **Gmail discovery:** enable Gmail API and configure an OAuth client with offline read-only Gmail consent. Add the authorized test user. Supply server-only `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET`.
4. **Outlook discovery:** register an Entra application and configure delegated `Mail.Read`/`offline_access`. Supply server-only `OUTLOOK_CLIENT_ID` and `OUTLOOK_CLIENT_SECRET`. Both mailbox providers use `https://fdjsmpmgrwzmqovzundx.supabase.co/functions/v1/mailbox-callback`. Test connect, manual scan, refresh, disconnect and revoked consent separately for each provider.
5. **SAML:** verify the project's SAML eligibility, obtain the organization's domain and IdP metadata URL/XML, register the provider and assign test users. Validate both correct-provider access and denied wrong-provider access. Do not upgrade the billing plan without the owner's approval.

The generated mailbox key is backed up in private `~/.config/subloom/fdjsmpmgrwzmqovzundx/mailbox.env` with owner-only permissions, outside Git. `MAILBOX_APP_URL` is `http://localhost:8081/mailboxes`. Preserve this encryption key when adding the provider variables to that private file, then run `supabase secrets set --project-ref fdjsmpmgrwzmqovzundx --env-file <private-file>`. Never put OAuth secrets in `EXPO_PUBLIC_*` variables or commit that file.

Hosted Auth now uses site URL `http://localhost:8081` and exact redirects `http://localhost:8081/auth-callback` and `subloom://auth-callback`. Existing SMTP, email confirmation, OTP length and MFA configuration were preserved. Review `supabase config diff --project-ref fdjsmpmgrwzmqovzundx` before changing hosted auth settings. Production HTTPS hosting and its exact URLs must be configured later.

Use the local browser for initial OAuth testing. The Mac wrapper currently opens external sign-in pages in the system browser; returning the authorization code to the wrapper's own PKCE storage still needs integration and live verification. Adding a redirect allowlist alone does not complete that transport. Signed iOS/Android callbacks also remain pending rebuilt device binaries.

## Verification

The combined branch passes 195 app/Postgres integration tests, 22 backend tests, TypeScript, ESLint, native storage tests (17 checks), a signed Mac build and the running Mac asset-server tests (8 checks). Ten email templates generate HTML/plain-text previews; see [email templates](email-templates.md).

Hosted security advisors report no errors. Twelve warnings identify intentionally authenticated, guarded `SECURITY DEFINER` RPCs; those access boundaries are covered by database and hosted checks. One warning concerns disabled leaked-password protection; the current app uses email OTP/social/SSO flows. This is a recorded configuration limitation, not a blanket security certification.

All 25 hosted smoke checks passed, including settings sync, immutable price history, family invitations/billing, denied non-SSO access and private mailbox token/RPC isolation. Disposable QA accounts were cleaned up. The live smoke test uses email-suppressed accounts and tests actual Auth, PostgREST, Realtime and Edge Functions. It sends no email/push and connects no personal mailbox. Provider consent, actual mailbox scanning, SAML sign-in and real device notification delivery are separate release checks.
