# Contributing to Subloom

Start new work from `release-candidate`, unless a task specifies another base. Keep each change focused and record the checks you actually ran.

## Branch names

Never create a branch starting with `codex/`. Choose one of these prefixes and add a short kebab-case description:

| Prefix | Purpose | Example |
| --- | --- | --- |
| `feature/` or `feat/` | New feature or enhancement | `feat/assistant-follow-ups` |
| `bugfix/` or `fix/` | Non-critical bug fix | `fix/weekly-payment-range` |
| `hotfix/` | Urgent production fix | `hotfix/payment-crash` |
| `release/` | Production release preparation | `release/v1.2.0` |
| `docs/` | Documentation only | `docs/update-api-readme` |
| `refactor/` | Restructuring without behavior changes | `refactor/assistant-tools` |
| `test/` | Automated test additions or updates | `test/currency-conversion` |
| `chore/` | Maintenance, dependencies, or build/CI configuration | `chore/release-workflow` |
| `experiment/` or `wip/` | Experiments or prototypes | `experiment/chat-routing` |

Release branches may use a version instead of a kebab-case description. Use `docs/` rather than `doc/`; use `chore/` for CI and build branches. The existing production branch and branches managed by release automation retain their established names.

For a feature stack, target `release-candidate` with the first PR and target each predecessor with the next PR. State the merge order in every PR.

## Commit messages

Use `type: description` or `type(scope): description` with a concise description. These are the allowed Conventional Commit types:

| Type | Purpose |
| --- | --- |
| `feat` | New features or significant improvements |
| `fix` | Bug fixes, including urgent production fixes |
| `docs` | Documentation updates or additions |
| `style` | Formatting or cosmetic changes without functional changes |
| `refactor` | Restructuring that neither fixes a bug nor adds a feature |
| `test` | Adding or fixing tests |
| `chore` | Routine maintenance |
| `perf` | Performance improvements |
| `ci` | CI/CD changes |
| `build` | Build system or external dependency changes |
| `revert` | Reverting previous changes |

Examples:

```text
feat(assistant): understand follow-up questions
fix(analytics): exclude payments already settled this month
ci: build installers only for releases
docs: document branch naming conventions
```

For breaking changes, add `!` after the type or scope and explain the change in a `BREAKING CHANGE:` footer. Use the same Conventional Commit format for PR titles when squash-merging.

## Verification

Preserve original-currency/date-only semantics and guest/account separation. Run the checks appropriate to the change; `npm run check` runs the repository policy check, type checking, linting, and application tests. See [RELEASING.md](RELEASING.md) for release verification and publication.
