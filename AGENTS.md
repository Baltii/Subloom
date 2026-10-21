# Subloom agent guidance

Subloom has one fixed brand identity. Read `brand/GUIDE.md` before changing logos or brand applications. Reuse the generated `src/brand/identity.ts` and `landing/components/brand-identity.ts`; never redraw the four-petal mark, introduce a sprout/alternate symbol, or retype the wordmark locally. The canonical master is `brand/source/identity.json`. Regenerate with `node scripts/build-brand.mjs` and verify with `node scripts/build-brand.mjs --check`. Keep the logo green/mint regardless of personal UI accent choices; keep the supplied wordmark geometry and omit the old trailing period.

For React Native / Expo UI work in this repository, read `.agents/skills/subloom-ui-engineering/SKILL.md`. Preserve the existing design tokens, guest persistence, owner-isolated sync, and date-only / original-currency financial semantics.

`release-candidate` is the only production/default branch. CI, deployment and version automation must target it; `main` is retired from production.

Requested feature stacks start from `release-candidate`: the first feature PR targets `release-candidate`, and each following feature has its own branch and PR against its predecessor. Open PRs ready for review, not as drafts. Keep unrelated local work out of those commits and state the merge order in each PR. Run the checks appropriate to the changed code and record their real results.

## Branch and commit naming

Name new working branches `<type>/<short-kebab-case-description>`. Use lowercase words separated by hyphens, and choose the prefix by purpose:

- `feat/`: new functionality.
- `fix/`: bug fixes.
- `refactor/`: internal changes that preserve behavior.
- `chore/`: maintenance, dependencies, tooling, or CI.
- `hotfix/`: urgent production fixes.
- `doc/`: documentation changes.

Never prefix branches or commit messages with agent, assistant, or tool names, including `codex/`. Examples: `feat/service-suggestions`, `fix/android-safe-area`, `doc/branch-and-commit-conventions`.

Use Conventional Commit messages: `<type>(<optional-scope>): <imperative summary>`. Omit the parentheses when there is no scope. Commit types are `feat`, `fix`, `refactor`, `chore`, and `docs`; use `docs` for `doc/` branches and `fix` for `hotfix/` branches so release automation recognizes them. Examples: `feat(subscriptions): suggest matching services`, `fix(android): respect the bottom safe area`, `docs: define branch and commit conventions`. Keep each commit focused on one coherent change. Mark actual breaking changes with `!` and a `BREAKING CHANGE:` explanation.

These rules apply to new contributor and agent work. Preserve existing history and branch names unless explicitly asked to rename them. GitHub-generated merge commits and service-managed branches/commits, such as Dependabot and release automation, retain their generated naming.
