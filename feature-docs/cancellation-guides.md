# How to cancel guides

Each subscription has a visible **How to cancel** action in the subscriptions list, its details, and its action menu. It opens `/subscription/cancel?id=...` with numbered guidance for the saved catalog service, a **Visit website** action, and the provider reference. Direct billing, Apple, and Google Play instructions can be selected without changing the subscription.

All 65 named catalog services have static website links and curated guidance. Entries whose exact menu path could not be established are labeled general guidance. Gym memberships and custom/unknown services receive general instructions without a guessed website. Select a catalog service when editing a custom record to obtain its matching link. Renaming a subscription does not silently change its guide.

## Content and maintenance

`src/domain/cancellationInstructions.ts` contains original summaries and first-party references. The supplied Subscription Stopper Netflix page did not expose readable content; no bulk article text or remote HTML was copied. Guidance is bundled and readable offline; opening websites needs a connection. Source pages and provider terms can change, and the UI points users to current official guidance. A full live audit of every provider URL was not performed.

Provider-specific notes cover billing partners, team administrators, storage limits, potentially destructive backup removal, separate products, and contract terms where applicable. They do not promise refunds, cancellation success, or savings. The guide performs no login, cancellation, background job, or subscription mutation. Existing guest and account persistence paths are unchanged. No migration or credentials are needed.

## Delivery

Branch: `codex/service-cancellation-guides`. Base: current `release-candidate`. Merge order: merge this single feature PR into `release-candidate`; there are no predecessor feature PRs in this request. Production deployment is outside this change.

## Validation

`npm run check` passed with 51 test files and 301 tests. `node scripts/expo.mjs export --platform all --output-dir /tmp/subloom-cancellation-export` passed for web, iOS, and Android. Browser review covers 1440 × 1000 and 390 × 844 layouts, light/dark appearance, billing-source changes, keyboard activation, and missing-record recovery. Native device runtime, system reduced-motion emulation, and forced external-link failure were not exercised. A complete live provider-link audit was not performed.

Tests cover catalog coverage, HTTPS links, safe custom/unknown service fallback, separate store instructions, and important provider-specific consequences. UI changes reuse existing theme tokens and reduced-motion-aware controls.

The final finish reviewer returned **ship** for the exported web evidence, scoring the three requested corrections resolved: Trello's cancellation reference, Apple's exact subscription-management destination, and the persisted surface contract. The documentation handoff compared the finished extension with `DESIGN.md`, `.impeccable/design.json`, theme tokens, shared primitives, and subscription entry points. It found no system drift within that scope. The existing design-system documents remain unchanged; the local reading-column composition and completion evidence are recorded in `.impeccable/surfaces/subscription-cancellation-guide.md`.
