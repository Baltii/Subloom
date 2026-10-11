# Feature delivery and setup

Each feature has its own branch, tested pull request and Markdown document. These are stacked PRs: merge in the following order, then retarget each next PR to `main` after its predecessor merges. Each PR contains only its feature delta relative to the preceding branch.

| Order | Feature | Branch | PR | Documentation |
| --- | --- | --- | --- | --- |
| 1 | Monthly category budgets | `codex/subscription-budgets` | [#4](https://github.com/Baltii/Subloom/pull/4) | [Setup](monthly-budgets.md) |
| 2 | Savings simulator | `codex/savings-simulator` | [#5](https://github.com/Baltii/Subloom/pull/5) | [Setup](savings-simulator.md) |
| 3 | CSV import/export | `codex/csv-import-export` | [#6](https://github.com/Baltii/Subloom/pull/6) | [Setup](csv-import-export.md) |
| 4 | Calendar export | `codex/calendar-export` | [#7](https://github.com/Baltii/Subloom/pull/7) | [Setup](calendar-export.md) |
| 5 | Cancellation assistant | `codex/cancellation-assistant` | [#8](https://github.com/Baltii/Subloom/pull/8) | [Setup](cancellation-assistant.md) |
| 6 | Price history | `codex/price-history` | [#9](https://github.com/Baltii/Subloom/pull/9) | [Setup](price-history.md) |
| 7 | Family workspaces | `codex/family-workspaces` | [#10](https://github.com/Baltii/Subloom/pull/10) | [Setup](family-workspaces.md) |
| 8 | Google/Apple login | `codex/social-login` | [#11](https://github.com/Baltii/Subloom/pull/11) | [Setup](google-apple-login.md) |
| 9 | Gmail/Outlook discovery | `codex/mailbox-discovery` | [#12](https://github.com/Baltii/Subloom/pull/12) | [Setup](mailbox-discovery.md) |
| 10 | Team workspaces + SAML SSO | `codex/team-sso` | [#13](https://github.com/Baltii/Subloom/pull/13) | [Setup](team-workspaces-sso.md) |

The last three PRs remain drafts until live provider credentials, hosted configuration and device callbacks are tested. The existing Supabase/Resend credentials do not provide Google, Apple, Microsoft or organization IdP credentials. Detailed exact requirements and callback URLs are in each document; no secret values are stored here.

No production migrations, provider registration or Edge Function deployments were performed. Cloud budgets need migration 001; price history needs 002; family workspaces need 003; mailbox discovery needs 004 plus its Edge Functions and server secrets; teams need 005 plus configured SAML. Apply in timestamp order after the existing core migrations. Test deployment in a disposable/staging project before production rollout. The docs record local verification and remaining live checks separately.

The original checkout's uncommitted email-template work is preserved separately; it is not silently folded into these branches.
