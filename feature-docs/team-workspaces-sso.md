# Team workspaces and enterprise SSO

**Hosted setup, 2026-10-11:** Migration 005 applied; hosted non-SSO team creation and private RPC calls are denied. No SAML provider is registered; live organization sign-in remains pending. See [setup progress](setup-progress.md).

Branch: `codex/team-sso`. Depends on the entire feature stack through `codex/mailbox-discovery` (#12), including family workspaces, the shared editor and the PKCE sign-in callback.

## Behavior

Settings → Team workspaces and SSO opens an organization domain sign-in. Supabase routes the domain to the administrator's registered SAML 2.0 identity provider. After a verified SSO session, users can create a team or join with a single-use invitation. The team is bound to the signed session's provider UUID; users cannot choose a different tenant when creating a team.

Owners create/edit/delete shared subscriptions, assign a billing owner, record exact cost splits, create/revoke invitations and manage membership. Members have read-only access. The shared subscription editor and lifecycle are the same as family workspaces. Shared copies strip private notes, payment methods and personal reminders. Shared records remain separate from personal forecasts and reminders. This records billing responsibility; it does not charge anyone or integrate with merchant accounts.

Team reads require both membership and the team's SAML provider in the verified JWT `amr` claim. Every mutation uses the same checks before entering privileged SQL. Wrong-provider or email-code sessions cannot read or mutate a team, even if they own it or have an invitation. MFA can precede SAML in `amr`; all entries are inspected, and ambiguous multiple provider claims fail closed. Domain/email strings and editable `user_metadata` never authorize access. Underlying unguarded RPCs have no client execute grants. Family workspaces retain their normal authenticated access.

## Configuration and credentials

1. Apply `202610110005_team_sso.sql` after the existing feature migrations. Existing family records have null SSO providers. No team records are created until SSO is available.
2. Enable SAML support in the Supabase project. Supabase currently documents SAML on Pro and higher plans; confirm eligibility in your dashboard.
3. Obtain the organization's **IdP SAML metadata XML or metadata URL**, containing its entity ID and signing certificate. Register that provider and its **organization domain** in Supabase Auth. Obtain the resulting provider UUID for administration/debugging; users do not type it into the app.
4. Configure the organization's IdP to use Supabase's service-provider metadata and ACS URL from `supabase sso info --project-ref <project-ref>`. Assign authorized test users to the application in the IdP.
5. Keep the web `/auth-callback` and native `subloom://auth-callback` in the Supabase redirect allowlist, using the exact app origin. Rebuild the signed native binary with the existing browser plugin and URL scheme. No IdP signing private key or Supabase service-role secret belongs in the app.

SSO identities can be separate Supabase user UUIDs from email/social accounts with the same email address. There is no automatic identity linking or personal-data migration. Guest import stays an explicit existing app action. Signing out of Subloom does not promise global sign-out from the organization's IdP. Configure session duration/revocation in Supabase and the IdP; already issued JWTs are valid until they expire or the backend rejects them. This release has no SCIM provisioning or automatic membership removal from external IdP groups.

## Validation

The Postgres integration test covers correct/wrong SAML providers, non-member isolation, MFA claim order, forged user metadata, denied reads and owner mutations, private underlying functions, wrong-provider invitations without consuming them, shared records, delete cascades and family behavior. Unit tests cover domain validation and claim hints. Auth adapter tests cover domain routing through the PKCE callback and unavailable providers. TypeScript, ESLint and production web export are checked.

**Live SAML sign-in, organization routing, real IdP session expiry, and signed iOS/Android callback tests remain pending. Hosted schema and denied non-SSO access are verified in the setup report.** This is a draft PR until those checks can run with the organization's configuration. No IdP was registered and no production migration was applied during implementation.

## References

- [Supabase SAML configuration, claims and identity behavior](https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml)
- [Supabase signInWithSSO API](https://supabase.com/docs/reference/javascript/auth-signinwithsso)
- [PKCE sign-in](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
