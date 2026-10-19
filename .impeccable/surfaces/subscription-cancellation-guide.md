# Subscription cancellation guide

Mode: Read. Narrow extension of Subloom's established subscription interface.

## Direction contract

The user opens “How to cancel” from a subscription and immediately sees instructions for its selected catalog service. Keep the existing design tokens, type, light/dark surfaces, native controls, and responsive layout. This is a precisely specified extension: no new visual world, concept roll, comp, or separate quality-bar artifact is required.

Provide visible entry points in the subscription list, detail view, and action menu. Present the selected service, the billing-source choice, three readable numbered steps, the provider website action, and a link to the provider reference. Apple and Google Play instructions are separate from direct billing. Explain bundles and billing partners without guessing the user's billing source.

Keep general guidance visibly labeled when exact provider paths are uncertain. Custom services and unnamed gyms have no invented website. Match guides by catalog identifier, never arbitrary display names. Opening or reading guidance is read-only and never changes tracking, persistence, financial/date semantics, or merchant billing.

## Verification scope

Review the exported Expo web app at desktop and compact widths, in light and dark appearance, with store choices, keyboard activation, and missing-record recovery. Native exports establish bundling only; native runtime and system reduced-motion behavior remain unverified. Reuse the existing reduced-motion-aware controls and navigation.

Local review captures are in `.impeccable/review/` and are not published. The final finish-review verdict was **ship** for the exported Expo web evidence: the reviewer scored all three requested corrections resolved (Trello's cancellation reference, Apple's precise subscription-management destination, and this persisted contract). This verdict scores those corrections; it does not certify native runtime or every provider URL.

## Documentation handoff

The completed extension was compared with `DESIGN.md`, `.impeccable/design.json`, `src/theme/tokens.ts`, the shared UI primitives, and the subscription list, detail, and action-menu entry points. The guide inherits `Page`, `Card`, `Heading`, `Label`, `Button`, `Chips`, `Empty`, and `ServiceIcon`. Its semantic colors resolve through `useTheme`; Manrope headings, DM Sans reading text, the bordered 16 px card with 24 px padding, 50 px primary actions, and 44 px compact actions and billing choices retain the incumbent system. The 720 px reading column is a local composition choice rather than a new global token. Existing button focus and reduced-motion paths remain in use.

The refreshed desktop and compact captures show the numbered reading hierarchy, selected billing-source controls, and visible list action joining the established interface. No system drift was identified in this extension's checked code and evidence. `DESIGN.md` and `.impeccable/design.json` are preserved; no new design-system primitives or identity changes were needed.

Final validation supplied by the implementation run: `npm run check` passed (51 test files, 301 tests), and `node scripts/expo.mjs export --platform all --output-dir /tmp/subloom-cancellation-export` passed for web, iOS, and Android. Native runtime, OS reduced-motion emulation, forced external-link failure, and a complete live provider-link audit remain unverified.
