---
name: "Subloom landing"
description: "The existing forest and mint Subloom world expressed as a spacious marketing surface."
colors:
  ground: "#f4f5ed"
  paper: "#fff"
  ink: "#182d25"
  secondary: "#586f61"
  green: "#087c65"
  pressed: "#066551"
  mint: "#e1f0de"
  mint-deep: "#cadfc2"
  mint-light: "#eaf6ee"
  lilac: "#eae5f0"
  blue: "#e7eff4"
  line: "#e8eee9"
  spotlight: "#182d25"
  on-spotlight: "#fff"
  spotlight-detail: "#cadfc2"
  action: "#182d25"
  on-action: "#fff"
  action-hover: "#066551"
  frame: "#182d25"
  logo-mark: "#087c65"
  logo-wordmark: "#182d25"
  logo-inverse: "#e1f0de"
  light-action: "#e1f0de"
  on-light-action: "#182d25"
  privacy-highlight: "#a1e1be"
  dark-ground: "#101a16"
  dark-paper: "#18251e"
  dark-ink: "#e7f2e9"
  dark-secondary: "#adc1b2"
  dark-green: "#70d2ad"
  dark-pressed: "#9be2c4"
  dark-mint: "#243e2e"
  dark-mint-deep: "#33543d"
  dark-mint-light: "#1b2e23"
  dark-lilac: "#302b3b"
  dark-line: "#33503e"
  dark-spotlight: "#203c2d"
  dark-on-spotlight: "#e7f2e9"
  dark-spotlight-detail: "#cadfcf"
  dark-action: "#e1f0de"
  dark-on-action: "#182d25"
  dark-action-hover: "#9be2c4"
  dark-frame: "#33543d"
  dark-logo-mark: "#e1f0de"
  dark-logo-wordmark: "#e1f0de"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(40px, 4.65vw, 67px)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(34px, 3.7vw, 52px)"
    fontWeight: 700
    lineHeight: 1.13
    letterSpacing: "-0.04em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  button:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 600
rounded:
  panel: "32px"
  card: "24px"
  row: "14px"
  disclosure: "16px"
  pill: "999px"
spacing:
  section: "136px"
  section-mobile: "78px"
components:
  brand-primary:
    textColor: "{colors.logo-wordmark}"
    height: "32px"
    width: "173.184px"
  brand-inverse:
    textColor: "{colors.logo-inverse}"
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.on-action}"
    rounded: "{rounded.pill}"
    typography: "{typography.button}"
    padding: "16px 26px"
  button-light:
    backgroundColor: "{colors.light-action}"
    textColor: "{colors.on-light-action}"
    rounded: "{rounded.pill}"
  theme-control:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "44px"
    width: "44px"
    padding: "10px"
  store-download-disabled-local:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.secondary}"
    rounded: "14px"
    height: "62px"
    padding: "11px 18px"
  demo-card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.card}"
    padding: "30px"
  subscription-row:
    backgroundColor: "{colors.ground}"
    rounded: "{rounded.row}"
    padding: "13px 11px"
  disclosure:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.disclosure}"
---

# Design System: Subloom landing

## Overview

**Creative North Star: "Forest and mint Subloom, made personal"**

This local specification describes the finished marketing surface. It inherits the established world in `../DESIGN.md`: forest and mint, Manrope headings, DM Sans reading text, rounded tonal panels, Lucide actions and tactile financial artwork. It does not revise the product-wide system. Spacious page composition, larger display type and pill actions are local marketing adaptations.

The warm paper ground and Mint illustration stage support the existing forest identity. A tilted sample overview, existing wallet and matching tactile organizer/bento artwork make subscription tracking tangible. Product truth remains governed by `../PRODUCT.md`; surface strategy remains in `.impeccable/surfaces/landing.md`.

Inheritance checked against parent DESIGN.md and PRODUCT.md, `app/globals.css`, `app/layout.tsx`, `components/experience.tsx`, the surface contract and the reviewed desktop/tablet/mobile captures. Parent PRODUCT.md uses a legacy structure and its design sidecar was already flagged stale during context inspection. Those pre-existing issues remain untouched; this local record does not reconcile them.

The landing page uses the same fixed Fourfold Bloom identity as the native app. `../brand/source/identity.json` owns the four-petal symbol and outlined wordmark with an uppercase S; `../brand/GUIDE.md` governs their use. Light headers pair the Green mark with the Forest wordmark; dark fields use the Mint inverse. Personal app accents never change this logo.

The landing now supports System, Light and Dark appearance while preserving the same composition and brand geometry. Selected heading phrases use Green emphasis and occasional underlines under the owner’s explicit landing-only direction; the app-wide brand rules remain unchanged. Generated light/dark social previews reuse the exact canonical logo, local fonts and existing wallet artwork.

**Key Characteristics:**

- One generated Fourfold Bloom mark and outlined wordmark across app and website.
- Semantic light/dark surfaces and paired action colors, with fixed brand-logo colors.
- Green heading keywords and selective underlines scoped to this landing page.
- Manrope display hierarchy with DM Sans controls and reading text.
- Flat rounded panels alongside a coherent forest-green, ivory and restrained-gold financial illustration family.
- Product-specific bento previews connect forgotten recurring costs with reviewed records and renewal planning.
- One-time hero choreography, gated illustration loops and bounded interaction feedback.
- Visible focus, exact-value financial transitions, a Pause/Play control and reduced-motion support.

## Colors

The frontmatter records local CSS custom properties from `app/globals.css` and `app/theme.css`, retaining source names and formats. Unprefixed values describe the light default; `dark-` prefixes describe the actual dark overrides. Roles omitted from the dark map, such as the pale-blue service sample, retain their explicit shared treatment. Reading ink, surface fields, action foregrounds and spotlight foregrounds must resolve as separate paired roles.

### Primary

- **Resolved Green** (`green`, `dark-green`): heading emphasis, focus, selected checkboxes and illustrative status details; the dark interface uses its own readable action green, independently of the fixed Mint logo.
- **Paired actions** (`action`, `on-action`, `action-hover` and their dark variants): Forest/white in light appearance and Mint/Forest in dark appearance, with paired sweep feedback. `pressed` remains an existing interface feedback role. The privacy-panel light action uses fixed `light-action`/`on-light-action` values.
- **Soft mint family** (`mint`, `mint-light`, `mint-deep`): hero and closing fields, demo field, supporting contrast and small icon grounds.

### Secondary

- **Soft lilac** (`lilac`, `dark-lilac`): retained local source tokens; the active organizer stage and receipt panel now use Mint. Do not inherit the retired calendar/lilac application as current guidance.
- **Pale blue** (`blue`): a quiet service sample ground; this is not a second action color.

### Neutral

- **Warm paper ground** (`ground`) and **white paper** (`paper`): canvas, cards and disclosure surfaces.
- **Resolved reading ink** (`ink`, `dark-ink`): Forest in light appearance and Pale Leaf in dark appearance.
- **Spotlight panels** (`spotlight`, `on-spotlight`, `spotlight-detail` and dark variants): overview balance, privacy and recurring-cost panels with independently paired text. Do not use general `paper` as their foreground.
- **Fixed logo roles** (`logo-mark`, `logo-wordmark`, dark variants and `logo-inverse`): canonical Green/Forest primary and Mint inverse; these are independent of the interface’s resolved `green`, `ink` and `mint`.
- **Privacy heading highlight** (`privacy-highlight`): the approved pale-green emphasis on the composed spotlight panel; it is a local contrast role, not another logo color.
- **Leaf secondary** (`secondary`): supporting copy and metadata.
- **Quiet stroke** (`line`): the local border primitive.

**The Inheritance Rule.** Treat these as landing values; changes here do not alter the app's eight selectable accent palettes or light/dark themes.

**The Fixed Logo Color Rule.** Personal accents and interface theme tokens never recolor the logo. Use the dedicated logo roles for canonical Green mark/Forest outlined wordmark on light surfaces and canonical Bloom Mint for both on dark surfaces. Preserve the generated geometry and use `logo-inverse` for an explicit inverse application.

**The Surface Pair Rule.** Resolve `action` with `on-action`, and `spotlight` with `on-spotlight`/`spotlight-detail`, in the same active appearance. General surface, reading ink and interface Green are separate roles; the fixed logo palette remains independent.

## Typography

Manrope bold and DM Sans regular/semibold are loaded locally with `next/font/local`; the font variables are `--font-display` and `--font-body`. The frontmatter records default roles. No new type family is introduced.

The hero display becomes (36 px) at the tablet breakpoint and `clamp(30px, 7.6vw, 43px)` below (600 px), with line height (1.13). Headlines become (36 px) on compact layouts, with a (32 px) narrow-screen adjustment. Supporting paragraphs retain comfortable line spacing. Demo totals use tabular numbers; display totals use Manrope and tight tracking.

**The Outlined Wordmark Rule.** Render the supplied outlined Manrope 700 wordmark, `Subloom` with an uppercase S, without a trailing period; interface font loading must not change its geometry.

**The Landing Heading Emphasis Rule.** The owner explicitly authorizes Green keywords and selective underlines on this landing page. Keep the existing Manrope face and weight, use nonitalic emphasis, and underline selected phrases with a (0.045 em) stroke offset (0.13 em). Use resolved Green on ordinary fields and the dedicated privacy highlight on the spotlight panel. This narrow exception does not revise the global brand guidance or permit changing the wordmark.

The theme selector is icon-only; its native options retain a local (12 px) font. Store placeholders use a (10 px) availability line and (17 px) store name, becoming (15 px) compact. These local control sizes do not establish a new global typography scale. The earlier privacy-highlight advisory remains resolved as the explicit local contrast role above.

**The Numeric Reading Rule.** Keep the sample currency symbol, decimal precision and period label readable together when selection changes the amount.

## Layout

The page centers a container capped at (1240 px), initially with (56 px) gutters. Gutters reduce to (36 px), (24 px), (20 px), then (16 px) at the observed (1100 px), (800 px), (600 px) and (360 px) thresholds. The section rhythm uses the frontmatter spacing values, with (90 px) at the tablet threshold.

Desktop pairs copy and demonstrations in two columns. Below (600 px), these sections stack; the feature description precedes its illustration. Navigation becomes an expandable panel with full-width links. The hero's tilted overview remains legible within a mint arch; art scales across tablet widths before becoming a dedicated mobile stage. The mobile composition omits the small decorative renewal note while retaining the overview, artwork and visible sample caption.

The local feature bento uses a (12 column) grid with (20 px) gaps: the recurring-cost lead spans seven columns and the renewal calendar five; statement review, receipt review and original-currency cards each span four on the second row. At widths up to (1000 px), the grid becomes two equal columns, with the lead full width and the other four cards in pairs. At widths up to (600 px), every card occupies one column with (16 px) gaps; the cost comparison also stacks vertically. The intro changes from paired heading/copy columns to a single flow. Keep this composition local to the landing feature section.

The navigation utility group keeps Open Subloom, the icon-only native theme selector and the GitHub link in that order. Theme and GitHub controls each retain a (44 × 44 px) target at all sizes. On mobile this same group lives inside the existing navigation menu, rather than outside it. Utility gaps reduce from (10 px) to (8 px) up to (1000 px), then (5 px) up to (360 px); the app action flexes into the remaining mobile width.

## Elevation & Depth

CSS surfaces use no box shadows. Depth comes from tonal overlap, a forest frame, the tilted sample panel and the existing softly rendered 3D artwork. The local illustration extension preserves the existing material world and does not introduce global app shadows.

Motion uses the existing `--ease`, `cubic-bezier(.16, 1, .3, 1)`, for settling, spatial feedback and small clip reveals. The hero plays once: stage (1000 ms), second headline line (850 ms with 90 ms delay), supporting copy/actions/reassurance (700 ms, with action/reassurance delays of 100/160 ms), overview (1100 ms), reminder (1200 ms), wallet (1350 ms), and subscription records (650 ms with staggered 120/220/320 ms delays). These existing illustrative records settle into the overview; the logo remains still.

Intersecting picture reveals take (1000 ms); demo-panel and privacy-surface reveals take (850 ms). A settled panel ends at `transform: none`; its initial perspective/translation and timing remain unchanged, while the resting panel avoids an unnecessary transformed compositor layer. Reveals add a class once at an intersection threshold of (0.12), without making initial content invisible. Small clip regions and transforms explain arrival; FAQ expansion is the deliberate layout transition. Reveal content and native FAQ disclosure remain readable before JavaScript.

**The Gated Illustration Motion Rule.** Continuous illustration loops run only when the scene intersects, the document is visible, motion is enabled and the system has not requested reduced motion. The inline Pause motion / Play motion control below hero reassurance stops/resumes loops and disables pointer-depth updates while paused. Keep the logo static and retain useful content at every animation state.

The overview breathes over (8 s), wallet floats over (6 s), reminder bell rings within (7 s), organizer breathes over (8 s), and closing wallet/confirmation use (7 s) cycles. Illustration loops use `ease-in-out`; the confirmation uses the existing settling curve. Fine-pointer hover pauses the feature/closing illustration loop. Mouse depth is limited to (±8 px horizontal, ±6 px vertical), coalesced through one pending animation frame per scene without React renders, and reset on pointer leave. Individual layers use different depth factors with (450–500 ms) settling transitions. Coarse pointers receive no pointer-depth handler.

`prefers-reduced-motion: reduce` removes animation, transitions and smooth scrolling, zeros pointer depth and suppresses interactive transforms. The Pause/Play control is omitted under reduced motion. Hidden-document state switches motion off; scene visibility suspends continuous loops. These gates do not hide explanatory content.

Verification supplied with this local refinement covers a production build, (1440/768/390 px) layouts without horizontal overflow, changing illustration transforms, Pause/Play, offscreen suspension, exact sample totals, and FAQ click/Enter behavior. Hover/pointer-depth and reduced-motion paths were inspected in source; OS reduced-motion, hidden-tab background behavior and frame-rate performance were not exercised or measured.

## Shapes

Large local panels use the recorded panel radius. Demo cards are gently rounded, subscription rows tighter, and actions fully pill shaped. The hero stage uses an arch with (45%) top corners. The sample overview has its own (35 px) rounded frame and (6 px) forest border; it is an illustrative component rather than a new shared device frame.

The bento inherits the existing panel radius (32 px) and separates cards through flat spotlight, Mint, mint-light and paper fields that resolve in the active theme. Its records and calendar details are content previews, not new global card shapes or a replacement illustration style.

## Components

**The One Master Rule.** Read `../brand/GUIDE.md` before changing a brand application. `components/brand.tsx` consumes generated `components/brand-identity.ts`, derived from `../brand/source/identity.json`; never redraw or retype a local logo.

**Brand lockup:** The accessible home link contains the fixed path artwork, hidden from accessibility to avoid repeating its link name. Standard artwork is (173.184 × 32 px); the observed compact variant is (162.36 × 30 px). Preserve the (64 unit) master height, fixed wordmark offset and proportions. Keep one quarter of the symbol height clear outside the view box; minimum symbol size is (16 px), complete lockup width (140 px), interactive hit area (44 × 44 px). Use the supplied primary/inverse variants without shadows, rotation or independent petal animation. From the repository root, run `node scripts/build-brand.mjs`, then `node scripts/build-brand.mjs --check`; generated web/native paths, exports and icons must remain consistent.

**Actions:** Pill links lead to the existing app using the resolved `action`/`on-action` pair. The fixed light-action variant sits inside the spotlight privacy panel. Hover lifts the pill by (3 px); active feedback returns it with scale (0.98). Transform feedback takes (260 ms), background (220 ms), and a left-origin `action-hover` fill sweeps over (420 ms). The light variant sweeps to fixed white. Arrow icons move (3 px right, 3 px up) over (320 ms) on hover or keyboard focus; the round preview arrow moves down (4 px) over (350 ms). Focus remains a (3 px) Green outline with (5 px) offset. Small navigation actions use (45 px) minimum height.

**Theme preference:** The native select offers System, Light and Dark, defaulting to System. `components/theme-init.ts` resolves `subloom-landing-theme` before paint into HTML `data-theme`, catching unavailable storage; CSS also follows the system when JavaScript is absent. `components/theme.tsx` persists explicit choices, applies them for the visit if storage is blocked, updates browser theme-color, listens for OS changes while System is active and accepts cross-tab storage updates. Its Monitor/Moon/Sun icon is the only closed-state content: no visible theme text or chevron. The select retains the accessible name Color theme and full System/Light/Dark native options; the wrapper title exposes the current choice. Persistence and system behavior remain unchanged.

**Navigation:** DM Sans links sit beside the static wordmark on wider screens. Header/footer section links draw a left-origin (1 px) underline over (300 ms) on hover or keyboard focus, alongside (180 ms) color feedback. The mobile toggle uses explicit expanded state and a controlled navigation region. The menu closes after a section anchor is selected. The (44 px) GitHub icon links to `https://github.com/Baltii/Subloom`, matching the actual repository remote, and opens a new tab with `noopener noreferrer` and an accessible label announcing that behavior. Its (21 px) icon uses resolved reading ink, then Green on Mint hover, with the existing visible focus ring.

**Interactive sample:** A white rounded card holds the monthly/yearly segmented buttons, live total and three selectable subscription rows. A Forest period pill slides between equal columns over (350 ms), with label color changing over (250 ms). The total changes immediately to the exact final formatted amount, then enters over (420 ms) with a (7 px) settle and small clip; never count through intermediate monetary values. Its polite atomic live region announces the final value and period together.

Rows change fill over (240 ms), compress to scale (0.985) on active feedback over (300 ms), and tilt/scale their service icon over (350 ms) on hover. The custom check traces/retracts its stroke over (240 ms), paired with selected/excluded colors and native checked state. Excluded names and amounts retain full opacity with the existing secondary reading color. Checkbox focus outlines the visible custom check. The sample stays labeled and has no account or sync side effects.

**Disclosures:** Before enhancement, native details/summary panels keep FAQ answers available without JavaScript. After hydration, one controlled accordion item can be open; named buttons expose expanded state and control labeled answer regions. Closed regions are inert and hidden from accessibility. Answers expand/collapse through grid rows (0fr to 1fr) over (420 ms), with opacity over (250 ms) and white-to-Mint panel fill over (300 ms). The indicator rotates over (350 ms), with its vertical stroke resolving to a minus over (180 ms). Keyboard focus retains the shared visible ring; reduced motion applies the final open/closed state immediately.

**Illustration stages:** The feature stage now uses transparent `clarity-organizer.webp` on Mint, replacing its former calendar artwork. The hero/closing wallet remains. Five matching transparent bento assets add cost coins, a renewal bell, statement papers, receipt review and separate currency coins. Their shared material language is forest-green satin ceramic, warm ivory paper and restrained brushed gold with soft upper-left studio lighting; this extends the existing world rather than adding a new logo or decorative palette. Exact generation prompts, retained source PNGs and shipping WebP mappings live in `artwork/illustration-prompts.json`; reuse the committed assets and provenance rather than recreating them locally.

The hero separates the overview, wallet, reminder and stage into independent layers; feature/closing scenes retain visibility, pause and pointer-depth gates. The organizer uses its own (8 s) breathing transform, with (5 px) lift and (−1° to 1°) rotation. Existing feature-caption checks trace over (650 ms) on hover; feature symbols move up (3 px) and rotate (−8°) over (350 ms). Page composition positions the assets without changing their source transparency or the fixed brand mark.

Bento images are decorative: their wrappers are hidden from accessibility and each image has empty alternative text. Named previews, examples and explanatory copy retain the product meaning. The currency artwork keeps EUR/USD distinct, and receipt imagery suggests human review without claiming automatic approval.

**Feature bento:** `components/feature-bento.tsx` and `app/features.css` extend the existing landing world with five semantic articles: recurring-cost arithmetic, an illustrative renewal calendar, statement-match review, receipt-candidate review and original-currency prices. Each combines concise explanatory copy with a distinct product-specific preview. These are labeled examples, not connected personal data, operational controls or proof of guaranteed savings.

The spotlight lead uses (40 px) padding and a (430 px) minimum height; other cards use (34 px) padding. At the middle breakpoint padding becomes (36 px) for the lead and (30 px) for the others; compact cards use (28 px) with natural height. Local card headings are (25 px), the lead (37 px), becoming (28 px) compact. Cost figures use Manrope, tabular numerals and clear month/year units; the statement and currency examples retain explicit currency codes.

The lead comparison shows (€9.99 × 12 = €119.88), with twelve labeled month markers and an explicit illustrative-cost caption. The October calendar highlights a renewal date; the statement preview says Needs review, the receipt preview keeps acceptance with the person, and EUR/USD rows remain distinct. The receipt panel now uses Mint, with resolved reading ink (`ink`) for metadata in both appearances. Preserve the distinction between original prices and separately labeled estimates. Imported statements and receipt candidates require review; cancellation happens with the provider, then the tracking record can be updated.

**The Illustrative Cost Rule.** Present repeated-payment arithmetic as an illustrative cost, never as measured or guaranteed savings. Keep review labels, original-currency units and provider-managed cancellation explicit in feature previews.

Bento articles reuse the existing (850 ms) panel reveal. Hover translates statement, receipt and currency previews upward by (4 px) over (400 ms) with the existing settling curve. The lead's month markers grow vertically to scale (1.65) over (450 ms), with an (18 ms) per-marker delay and a (300 ms) color change. These bounded hover responses coexist with the new decorative illustration loops. Cost coins use (7 s), the renewal bell (8 s), statement papers (9 s), receipt review (9 s), its scan line (9 s), and currency coins (10 s), all `ease-in-out`. Every bento article is a motion scene. Images and scan line start paused and run only when root `data-motion` is on and their card is in view; existing user-pause, document-visibility and system-reduced-motion gates remain authoritative. The reduced-motion rule removes image/scan animation, hides the scan line and suppresses hover transforms; the shared override removes transitions. A bell rest phase and an invisible scan line are intentional portions of their cycles, not evidence that the loops failed. The refinement's supplied build and (1440/768/390 px) captures show no horizontal overflow; these checks do not establish measured hover timing or frame-rate performance.

The lead pairs its heading with coin artwork; statement, receipt and currency cards place art beside the existing preview. Visual rows use a (120 px) art column by default, (90 px) up to (1000 px), (100 px) up to (600 px), and (74 px) up to (360 px). On compact lead cards the heading is (28 px), with (86 px) right clearance for an (84 px) positioned illustration. Up to (360 px), remove that heading clearance and put the (105 px) illustration back into normal flow. Keep content legible before allocating decorative space.

Supplied illustration checks cover all six assets loading, no overflow at (1440/768/390 px), and a (320 px) source/runtime check. Pause and offscreen suspension were observed. The short bell sample showed its rest phase and the scan sample showed zero opacity; neither established a complete cycle. No OS reduced-motion run or frame-rate measurement was performed. The independent illustration finish review returned SHIP with no material fixes. Separate live sample clips resolve a mobile full-page compositor omission; target-section captures remain valid. Earlier SHIP records below belong to their named refinements.

**Store availability controls:** Reusable server component `components/store-downloads.tsx` appears in the hero and closing section. Each instance groups App Store and Google Play, giving four native disabled buttons on the page. Each says Coming soon on, exposes an explicit coming-soon accessible label and has no URL, click handler or launch behavior. Official Apple and Google Play vector paths come from Simple Icons (CC0); these are availability placeholders, not claims of an available store listing.

Use the active `paper` surface and `secondary` reading color at full opacity. Local controls have (14 px) corners, (62 px) minimum height, (11 × 18 px) padding and (25 px) store marks. Up to (600 px), minimum height becomes (60 px), horizontal padding (13 px) and marks (23 px); up to (360 px), horizontal padding becomes (11 px). They wrap as needed, with local gaps of (12/10/8 px) and a not-allowed cursor. Keep these measurements local to this landing component; do not add them to the shared app scale or style disabled content with reduced opacity.

The scoped header/download finish review returned **SHIP** without fixes. Supplied checks record passing TypeScript and production builds; light/dark hero and closing captures at (1440/768/390 px), compact menu captures and no overflow at (320 px); (44 px) utility controls with functioning native theme options, the correct GitHub URL, four disabled store buttons, working menu-anchor dismissal and no browser errors. Five detector advisories concern local (10/12/17 px) sizes and the existing iCloud color, with no hard findings. OS appearance and motion behavior were not retested in this follow-up.

**Social previews:** `scripts/generate-social.py` deterministically generates `public/social.png` and `public/social-dark.png` at (1200 × 630 px), using `../brand/source/identity.json`, the local Manrope/DM Sans fonts and the existing wallet illustration. Run `python3 scripts/generate-social.py` from `landing/` when regenerating; preserve the provenance sidecars. Metadata lists the light image first for Open Graph and uses it for Twitter, with explicit alternative text. The dark image is an additional Open Graph asset; it is not selected automatically from a viewer’s theme preference.

The final theme finish review returned **SHIP** with no material fixes. Supplied verification records a passing build, theme persistence through reload, responsive light/dark captures at (1440/768/390 px) plus a (320 px) hero with no horizontal overflow, the (€167.76/year) total after excluding Netflix, FAQ Enter behavior and mobile navigation. The canonical brand check records (30 exports) and (63 manifest entries) matching, with provenance for (5 rasters). Live OS theme changes and cross-tab updates are supported in source; blocked-storage bootstrap was tested in an isolated VM rather than a full browser session. Reduced-motion support remains unchanged and source-checked; these results do not claim an OS reduced-motion runtime or measured frame rate. The detector’s existing type-step and privacy-highlight advisories were addressed without rerunning it or refreshing unrelated history.

## Do's and Don'ts

### Do:

- Do use the generated Fourfold Bloom logo, fixed light/inverse colors and supplied outlined wordmark.

- Do inherit the existing forest/mint identity and local Manrope/DM Sans fonts.
- Do keep heading emphasis local, respect System/Light/Dark preference and use paired semantic foregrounds.
- Do regenerate social images from canonical artwork and keep light-first metadata and explicit alternative text.
- Do keep illustrative data labeled and preserve original-currency product claims.
- Do connect each bento card to a real product task and keep review/cancellation responsibilities explicit.
- Do preserve visible focus, the inline Pause/Play control, visibility gates and the reduced-motion override.
- Do animate exact final sample totals and keep native FAQ answers usable before JavaScript.
- Do keep local marketing adaptations scoped to this landing project.

### Don't:

- Don't recolor the logo with a personal accent, retype it, add a trailing period or invent a sprout, paired leaf or eight-petal alternate.

- Don't promote this page's composition or pill controls into app-wide requirements.
- Don't hide essential information behind entrance animation or show intermediate animated money values.
- Don't animate the logo, run illustration loops offscreen or remove motion controls.
- Don't replace authentic product artwork with unrelated decorative imagery.
- Don't present the illustrative annual charge as guaranteed savings or imply that import/receipt previews bypass review.
