# Subloom landing page

An independent **Next.js 16 / React 19 / TypeScript** project for Subloom. It inherits the app's Manrope and DM Sans fonts, forest/mint palette and existing tactile 3D artwork.

## Run locally

From this directory:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000.

```sh
npm run typecheck
npm run build
```

The build exports a self-contained static website into `out/`. Deploy that directory to a static host, or deploy this project through a Next.js host. The Expo app has its own independent dependencies and configuration.

## Included

- Responsive hero, feature explanation, interactive sample, guest-data explanation, six FAQs and final app action.
- Original Subloom artwork and self-hosted fonts; no third-party requests needed to render the page.
- Keyboard-friendly mobile navigation, animated accessible FAQ panels with a native-details fallback before JavaScript loads, named sample checkboxes, live total announcements, visible focus and a skip link.
- A coordinated hero entrance, gently animated wallet/organizer artwork, pointer depth on illustration scenes, swept CTA fills, directional arrows, navigation underlines, sliding period selection, exact-value total transitions and smooth FAQ panels. Illustration loops stop offscreen, in hidden tabs, with reduced motion, or through the hero’s Pause motion control. Content remains visible if JavaScript fails.
- Selective green heading emphasis, accessible System / Light / Dark theme choices, saved preference, prepaint theme resolution, and matching light/dark social preview images.
- Page metadata, explicit Open Graph/Twitter image descriptions and favicon.

The app buttons open https://subloom.baltii.tn. To change that address, update `app/page.tsx` and `components/experience.tsx`. The metadata base uses `VERCEL_PROJECT_PRODUCTION_URL` (with a deployment-URL fallback), so sharing URLs follow the production domain.

## Sample content and claims

Spotify (€10.99), Netflix (€13.49), iCloud+ (€2.99), the name Alex, and the October renewal dates are illustrative. Totals are calculated from these sample amounts; they are not vendor pricing claims or personal data. No testimonials, user counts, app-store availability, security certifications or pricing plans are invented.

Cancellation is handled with the merchant. Guest edits save on the device in the actual app; sign-in enables the app's existing cloud sync. Converted estimates remain separate from original-currency prices. No backend, waitlist or analytics is added by this landing page.

## Artwork and licenses

`public/illustrations/` retains the existing wallet artwork and adds six transparent forest/mint illustrations for the organizer and feature bento. Exact prompts and original generated PNGs are kept in `artwork/`; optimized WebPs carry provenance sidecars. The older calendar asset remains available but is no longer used in the feature section. `public/social.png` and `public/social-dark.png` are designed 1200 × 630 social previews made from the exact canonical logo, local fonts, and existing wallet illustration. The light image is the default Open Graph/Twitter preview; the dark version is an alternate image. Social platforms select their own preview; these images do not follow the viewer’s theme automatically. The four-petal logo and outlined wordmark are generated from the shared canonical master in `../brand/source/identity.json`; see `../brand/GUIDE.md`. The font licenses are included in `public/fonts/`. Icons use Lucide React.

## Verification

TypeScript and optimized static builds passed. Browser checks covered 1440, 768 and 390 pixel widths, with no horizontal overflow and two-line marketing headings. Checked sample period changes, subscription inclusion, mobile menu, and FAQ behavior. The original Chrome-based taste inspector could not start because Chrome/Edge/Chromium was unavailable; responsive screenshots and DOM measurements used the in-app browser instead. Reduced-motion rules were checked in source; an OS-level reduced-motion run was not performed.

To regenerate the social images, install Python `fonttools`, then run `python3 scripts/generate-social.py` from this directory with Node dependencies installed. Re-embed provenance using the Impeccable `embed-prompt` command after regeneration. The generator is local tooling; Vercel uploads the generated images directly and needs no Python runtime.

See `.impeccable/surfaces/landing.md` for the development-only direction contract. Visual evidence is excluded from version control.

Independent finish review: **ship**, with no material fixes. Motion timing and OS reduced-motion runtime were not verified by that review.

## Motion update — 21 October 2026

The movement follows the existing calm identity. One hero sequence introduces the overview, recurring records, reminder and wallet. Continuous illustration movement uses CSS transforms; pointer updates coalesce through one animation frame per active scene without React state updates. The Subloom logo remains still.

Production build passed after the motion update. Runtime checks covered changing illustration transforms, Pause/Play, offscreen suspension, yearly/monthly/excluded/zero sample totals and FAQ click/Enter behavior. Final responsive captures at 1440, 768 and 390 px show no horizontal overflow. Keyboard focus was checked. Hover/pointer-depth rules and reduced-motion paths were inspected in source; the browser harness could not simulate hover or an OS reduced-motion preference. Hidden-tab suspension is implemented but was not exercised as an OS/browser background test. No measured frame-rate claim is made.

The design detector ran once on the updated stylesheet and reported type/radius advisories against existing design documentation. These were passed to the finish reviewer; unrelated historical documentation was not refreshed.

Motion finish review: **ship**, with no material fixes. Review covered the final desktop/tablet/mobile captures, twelve captured motion frames, and the implementation. Pointer hover and OS reduced-motion runtime remain outside the verified scope.

## Feature and savings expansion — 21 October 2026

A five-panel bento explains recurring costs, renewals/reminders, statement review, receipt candidates and original-currency prices. These capabilities were checked against PRODUCT.md and their app implementations. The hero, benefit section, interactive-sample copy, closing paragraph and page description now emphasize spotting forgotten subscriptions and deciding what to keep.

The EUR 9.99 × 12 = EUR 119.88 example is explicitly illustrative, not measured savings or vendor pricing. Users handle cancellation with the provider. No automatic cancellation, bank connection or guaranteed savings is claimed.

The final production build passed. Responsive browser captures at 1440, 768 and 390 px showed no horizontal overflow; new mobile headings fit within two lines. Console inspection returned no errors. The new stylesheet detector reported 33 advisories (31 type-scale and 2 radius), with no non-advisory findings; historical system drift was preserved. Review identified receipt metadata contrast on lilac; those labels now use Forest ink at 11.77:1. Existing motion and reduced-motion rules remain, with a local reduced-motion override for the bento’s hover transforms. Hover/OS reduced-motion runtime was not exercised.

Bento finish verdict: **ship** after the reviewer scored the single receipt-contrast fix resolved. The verdict pass covered that fix; the preceding full review accepted the layout, feature coverage, product truth and responsive composition.

## Vercel hosting

Production: https://subloom-landing.vercel.app
Project: `subloom-landing` under `baltiis-projects`. The existing Expo app remains in the separate `subloom` project.

Deploy updates from this `landing/` directory:

```sh
vercel deploy --prod --yes --project subloom-landing --scope baltiis-projects
```

`vercel.json` selects the Next.js framework, `npm ci` and `npm run build`. Leave Vercel’s output directory at its Next.js default; its adapter handles the static export. `.vercelignore` allowlists the landing source, config and public assets. Environment files, review artifacts, installed dependencies and the parent app are excluded. Local project linkage and generated environment files remain ignored.

Deployment verified on 21 October 2026: Vercel reports Ready for production; an unauthenticated HTTP request returned the latest bento content. Canonical and social-image URLs use the production host. Live calculator and FAQ interactions passed, and browser error inspection returned none. No Git integration or custom domain was added.

## Themes and social previews — 21 October 2026

Headings use selective green phrases and a few thin underlines. `app/theme.css` separates reading colors, actions and spotlight panels so dark mode uses deliberately composed forest surfaces. The canonical four-petal logo switches to the supplied Mint inverse without changing its geometry.

The header’s native color-theme selector offers System, Light and Dark. It defaults to the operating-system preference and saves explicit choices in `subloom-landing-theme`. A small head script resolves the theme before paint. System changes and same-origin storage changes update the page; blocked storage falls back safely, and CSS still follows the system with JavaScript disabled. Browser chrome and native controls follow the resolved theme.

Both 1200 × 630 social images are generated from canonical artwork and local fonts. The light card is the primary Open Graph/Twitter image; the dark card is an alternate. Each includes descriptive metadata. No new logo or illustrative product claim was invented.

Validation: production build and TypeScript passed; the canonical brand check passed (30 exports, 63 manifest entries); all five public rasters carry provenance. Browser checks found no horizontal overflow at 1440, 768, 390 and 320 px. Both themes were captured at desktop/tablet/mobile sizes, and the 320 px hero was captured separately. Dark choice persisted through reload; System matched the actual OS preference. Mobile navigation, exact sample totals and FAQ Enter behavior passed with no browser errors. Isolated prepaint-script checks covered explicit preferences, system defaults, an invalid preference and blocked storage. OS preference-change events, full browser storage denial and runtime reduced-motion switching were not simulated.

The settled panel entrance now ends at `transform: none`, releasing its 3D compositor layer after animation and allowing offscreen mobile sample cards to appear correctly in full-page captures. Avatar text and the small iCloud glyph retain sufficient contrast. One detector run produced only two documentation advisories (the existing 12 px control size and the privacy accent). Independent full finish verdict: **ship**, with no material fixes.

Theme update published to the existing Vercel production alias on 21 October 2026. Production build reports Ready; public HTML and both PNGs return HTTP 200, and the deployed image bytes match the local 1200 × 630 assets. Live theme selection and reload persistence passed; canonical/OG/Twitter URLs resolve to the production host and browser error inspection returned none.

## Header and mobile download actions — 21 October 2026

The icon-only native theme selector sits immediately after Open Subloom in the header utility group, followed by a GitHub icon linking to the repository from the project’s git remote. On compact screens these controls remain together inside the mobile menu. Theme options retain accessible System/Light/Dark labels and saved preferences. GitHub opens a new tab with `noopener noreferrer`.

The hero and closing call to action share `components/store-downloads.tsx`: App Store and Google Play buttons labeled Coming soon. These are native disabled buttons with no URL or click handler. Store marks come from [Simple Icons](https://github.com/simple-icons/simple-icons), distributed under CC0; no store launch or release date is claimed.

The production build and TypeScript checks passed. Browser checks covered both appearances at 1440/768/390 px, plus the 320 px mobile menu: no horizontal overflow, 44 px icon controls, correct GitHub destination, four disabled store buttons, and a working theme selector and mobile navigation. Browser error inspection returned none.

Independent finish review: **ship** for the header utilities and download controls, with no material fixes. Review used exact-width hero/CTA and mobile-menu captures; OS theme-change and reduced-motion runtime were not re-exercised for this refinement.

Published to the existing Vercel production alias. Public HTTP returned 200; live HTML contains the four disabled store controls and correct repository link. Browser verification confirmed the 44 px icon-only theme selector and working theme changes, with no console errors.


## Illustration refresh — 21 October 2026

The clarity section now shows a forest-green organizer with subscription papers, a check tile and restrained gold coins on Mint. Five bento illustrations connect recurring costs, renewal reminders, statement review, receipt review and original currencies to the existing feature previews. The receipt panel also uses Mint. Exact generation prompts and sources are retained in `artwork/illustration-prompts.json`; the six shipping WebPs total approximately 143 KB.

Each illustration has restrained, distinct motion using the existing visibility, Pause/Play and reduced-motion gates. The canonical logo stays still. Production build and TypeScript passed; both themes were checked at desktop, tablet and mobile sizes, with no horizontal overflow and all six new assets loaded. Pause and offscreen suspension were observed. Bell and scan-line captures sampled resting phases, so a complete animation cycle was not established; OS reduced-motion and hidden-tab behavior were source-checked, with no measured FPS claim.

The full-page browser compositor omitted parts of the offscreen interactive sample in mobile captures. Separate live sample clips confirm its complete panel, period controls, total and subscription rows; scoped feature/bento captures remain valid. This capture limitation does not imply a product rendering defect.

Independent illustration finish review: **ship**, with no material fixes. Supplemental live sample clips resolved the mobile full-page capture omission.

Published to the existing Vercel production alias: deployment `dpl_7YV8WR7MDPVVRXjoAoaxjuBzEx5p` reports Ready. Public HTML and all six new WebPs return HTTP 200; illustration bytes match the reviewed local assets. Live browser checks confirm all six images loaded, no overflow and no console warnings/errors.
