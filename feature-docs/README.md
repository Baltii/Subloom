> Current focused scope (2026-10-17): [Focused subscription tracker](focused-subscription-tracker.md). The feature stacks below are historical delivery records, including tools retired from the focused app. Production follows `main` after a successful Vercel deployment.

# Feature delivery and setup

The new eight-feature recurring-payments stack is documented in [Control center](control-center/README.md), with its current merge order, provider boundaries and validation.

Each feature has its own branch, tested pull request and Markdown document. These are stacked PRs: merge in the following order, then retarget each next PR to `main` after its predecessor merges. Each PR contains only its feature delta relative to the preceding branch.

| Order | Feature                    | Branch                         | PR                                               | Documentation                      |
| ----- | -------------------------- | ------------------------------ | ------------------------------------------------ | ---------------------------------- |
| 1     | Monthly category budgets   | `codex/subscription-budgets`   | [#4](https://github.com/Baltii/Subloom/pull/4)   | [Setup](monthly-budgets.md)        |
| 2     | Savings simulator          | `codex/savings-simulator`      | [#5](https://github.com/Baltii/Subloom/pull/5)   | [Setup](savings-simulator.md)      |
| 3     | CSV import/export          | `codex/csv-import-export`      | [#6](https://github.com/Baltii/Subloom/pull/6)   | [Setup](csv-import-export.md)      |
| 4     | Calendar export            | `codex/calendar-export`        | [#7](https://github.com/Baltii/Subloom/pull/7)   | [Setup](calendar-export.md)        |
| 5     | Cancellation assistant     | `codex/cancellation-assistant` | [#8](https://github.com/Baltii/Subloom/pull/8)   | [Setup](cancellation-assistant.md) |
| 6     | Price history              | `codex/price-history`          | [#9](https://github.com/Baltii/Subloom/pull/9)   | [Setup](price-history.md)          |
| 7     | Family workspaces          | `codex/family-workspaces`      | [#10](https://github.com/Baltii/Subloom/pull/10) | [Setup](family-workspaces.md)      |
| 8     | Google/Apple login         | `codex/social-login`           | [#11](https://github.com/Baltii/Subloom/pull/11) | [Setup](google-apple-login.md)     |
| 9     | Gmail/Outlook discovery    | `codex/mailbox-discovery`      | [#12](https://github.com/Baltii/Subloom/pull/12) | [Setup](mailbox-discovery.md)      |
| 10    | Team workspaces + SAML SSO | `codex/team-sso`               | [#13](https://github.com/Baltii/Subloom/pull/13) | [Setup](team-workspaces-sso.md)    |

The last three PRs remain drafts until live provider credentials, hosted configuration and device callbacks are tested. The existing Supabase/Resend credentials do not provide Google, Apple, Microsoft or organization IdP credentials. Detailed exact requirements and callback URLs are in each document; no secret values are stored here.

On 2026-10-11, the owner requested setup on the existing test project. All five feature migrations were applied in order and twelve Edge Functions deployed from the integrated Mac branch. The first seven features need no additional credentials for testing. The last three still need live provider configuration. See [setup progress](setup-progress.md) for the per-feature results, repeatable commands and exact missing credentials.

The original email-template work is preserved on the rebased `codex/macos-local-reminders` branch, following this stack in PR #3. See [email templates](email-templates.md). Each original feature PR retains its feature delta.
