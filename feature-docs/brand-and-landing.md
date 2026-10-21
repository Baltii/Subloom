# Subloom brand and landing update

The shared Fourfold Bloom identity fixes the four-petal mark, outlined uppercase-S Subloom wordmark, forest/mint colors, app icons and splash artwork. `brand/source/identity.json` owns the identity; the kit includes editable/vector exports, fonts, tokens and an illustrated guide. Native and landing components consume generated identity constants.

`landing/` is an independent Next.js project. It includes feature explanations, a five-card bento, interactive cost sample, accessible navigation/FAQ, light/dark/System appearance, social images, a GitHub link and disabled coming-soon store controls. The refreshed organizer and five bento illustrations share forest, ivory and gold materials with restrained, pausable motion. Exact generated-image prompts and original assets are retained locally in the project. Product examples preserve review, original-currency and provider-managed cancellation responsibilities.

Production: https://subloom-landing.vercel.app — deployment dpl_7YV8WR7MDPVVRXjoAoaxjuBzEx5p.

Firebase Android client configuration is present for com.subloom.app. The private service-account key remains outside Git; FCM credentials are held by EAS. Google validation-only messaging passed without sending a device notification. Physical-device delivery remains pending.

## Validation

- Application TypeScript, lint and 321 tests across 54 files passed.
- Brand check: 30 generated exports and 63 manifest entries match the master.
- Landing production build and TypeScript passed locally and on Vercel.
- Light/dark responsive feature/bento captures and runtime checks found no horizontal overflow; all six new images load. Pause/offscreen gates were observed.
- Independent scoped illustration finish review: ship, no material fixes.
- Public production HTML and six WebPs return 200; deployed image bytes match local assets. Live browser reports no warnings/errors.

Mobile full-page capture had an offscreen compositor omission in the interactive sample; separate live sample clips confirm its complete panel, controls, total and rows. Full bell/scan cycles, OS reduced-motion/background behavior and measured FPS were not established by runtime checks. Third-party font-license whitespace and generated PDF bytes remain intact.

## Main integration

The owner requested updating main with the latest work. Integrate the existing saved-cards/wallets commits first, the first-run onboarding commits next, then the shared brand, landing and Firebase client configuration. Preserve main's existing merge history; no force push or unrelated feature stack is included.
