# Subloom agent guidance

Subloom has one fixed brand identity. Read `brand/GUIDE.md` before changing logos or brand applications. Reuse the generated `src/brand/identity.ts` and `landing/components/brand-identity.ts`; never redraw the four-petal mark, introduce a sprout/alternate symbol, or retype the wordmark locally. The canonical master is `brand/source/identity.json`. Regenerate with `node scripts/build-brand.mjs` and verify with `node scripts/build-brand.mjs --check`. Keep the logo green/mint regardless of personal UI accent choices; keep the supplied wordmark geometry and omit the old trailing period.

For React Native / Expo UI work in this repository, read `.agents/skills/subloom-ui-engineering/SKILL.md`. Preserve the existing design tokens, guest persistence, owner-isolated sync, and date-only / original-currency financial semantics.

Requested feature stacks start from `release-candidate`: the first feature PR targets `release-candidate`, and each following feature has its own branch and PR against its predecessor. Open PRs ready for review, not as drafts. Keep unrelated local work out of those commits and state the merge order in each PR. Run the checks appropriate to the changed code and record their real results.
