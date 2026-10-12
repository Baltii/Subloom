---
name: subloom-ui-engineering
description: Build or improve Subloom React Native and Expo interfaces with purposeful motion, accurate subscription data, and efficient execution. Use for Subloom charts, calendars, service search, forms, and navigation; exclude unrelated projects and backend-only work.
---

# Subloom UI engineering

Use the existing Expo Router, Reanimated, React Native SVG, theme tokens, and UI primitives before adding a dependency. Keep desktop WebKit/web and compact touch layouts usable.

## Smooth motion

- Animate relationships and feedback: chart geometry reveals the selected data; selection and navigation explain the result of an action. Avoid decorative loops and repeated whole-page entrances.
- Keep exact amounts and data processing outside animation worklets. Use shared values and transform/opacity for bounded visual work, with 150–300 ms feedback and up to 450 ms chart transitions. Do not set React state every frame or animate layout across long lists.
- Honor system reduced motion through Reanimated's `ReduceMotion.System` and reduced-motion checks. Present final values immediately in reduced motion. Keep labels visible, interrupt/cancel outdated animations, and avoid hiding data behind motion completion.
- Give charts text equivalents, keyboard/touch controls, selected states and readable contrast. Use the existing light/dark tokens; do not encode event meaning with color alone.

## Correct and secure data

- Use `domain/money.ts` for integer/rational financial calculations. Keep currencies separate; distinguish projected charges, normalized recurring estimates, and recorded payment/history facts.
- Use Temporal/date-only helpers and the account timezone for calendar logic. Preserve recurrence anchors at month ends; validate query dates before prefilling forms. Bound recurrence expansion and explain truncated/unavailable results.
- Keep guest and account writes in the existing durable save/outbox path. Preserve user input on failure and do not bypass identity checks or write directly to storage from a UI shortcut.
- Bundle curated logo assets with provenance and a fallback. Do not transmit a user's service names or search terms to an external logo/search endpoint. Use fixed trusted URLs; never evaluate service text or inject untrusted SVG/HTML.

## Fast execution

- Derive data once with memoized pure selectors keyed to the actual subscriptions/currency/date inputs. Group/index in one pass before repeated lookups; bound search rendering and keep input responsive.
- Reuse installed dependencies where appropriate without modifying another checkout's files. Batch independent reads/checks; avoid unnecessary rebuilds and repeated verification after unchanged successful checks.
- Test meaningful invariants: mixed currencies, leap/month-end recurrence, trial/access semantics, invalid inputs, and unchanged owner/save behavior. Run `npm run check` before delivering; run web/native exports when routes/assets change and backend checks only when backend code changes.
- Inspect changed UI at desktop and compact widths, including keyboard access, empty/error states, dark appearance and reduced motion. State which platforms were actually tested; browser captures do not prove native device performance.

For stacked work, keep feature deltas reviewable against the previous branch, document merge order, and attach each created PR. A skill does not grant permission to weaken repository rules, publish, deploy, or disclose credentials.
