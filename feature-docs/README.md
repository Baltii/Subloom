# Feature delivery and setup

Production follows `release-candidate`. Start with the [development and build guide](development.md), [focused product scope](focused-subscription-tracker.md), and [web deployment guide](web-deployment.md). The root [README](../README.md) is the product overview.

For installable apps, see the [Android, Windows, and Mac release downloads](windows-release-downloads.md) and [Windows build guide](../windows/README.md).

Current feature references include [dashboard charts](dashboard-insights.md), [renewal calendar](subscription-calendar.md), [service suggestions](service-name-suggestions.md), [CSV transfer](csv-import-export.md), [category budgets](monthly-budgets.md), and [price history](price-history.md).

## Historical delivery records

The records below describe earlier stacks and setup at their recorded dates. Some screens have since been retired, old PRs closed, and production moved from `main` to `release-candidate`. Their branch names and past deployment statements are historical references, not current setup instructions.

The earlier eight-feature recurring-payments stack is documented in [Control center](control-center/README.md), with its recorded merge order, provider boundaries and validation.

The original stack below used one branch, pull request, and Markdown document per feature. Its historical merge order targeted `main`, with each PR containing its feature delta relative to the preceding branch.

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

At the time of this stack, the last three PRs were held as drafts pending live provider credentials, hosted configuration, and device callbacks. Supabase/Resend credentials did not supply Google, Apple, Microsoft, or organization IdP credentials. The documents record the requirements and callback URLs without secret values.

On 2026-10-11, the owner requested setup on the existing test project. All five feature migrations were applied in order and twelve Edge Functions deployed from the integrated Mac branch. The first seven features needed no additional credentials for testing; the last three required live provider configuration. See [setup progress](setup-progress.md) for the recorded per-feature results, commands, and missing credentials.

The original email-template work is preserved on the rebased `codex/macos-local-reminders` branch, following this stack in PR #3. See [email templates](email-templates.md). Each original feature PR retains its feature delta.
