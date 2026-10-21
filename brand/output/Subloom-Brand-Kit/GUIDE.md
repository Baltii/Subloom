# Subloom brand guide

Version 1.0 - 21 October 2026

## Brand idea

**A calmer place for your subscriptions.** Subloom helps people see recurring costs and upcoming renewals, then make their own choices. The brand should feel composed, friendly, clear and respectful of personal information.

The identity is **Fourfold Bloom**: the four-petal mark already used in the Subloom app, now fixed as the single logo across every surface. Four identical rounded petals repeat around one shared center. The soft pinwheel carries the bloom in the name and hints at recurring cycles.

The brand is a subscription tracker, not a bank, payment service or investment product. Use clarity, personal control and breathing room as the story. Avoid wealth, guaranteed savings or automatic-cancellation promises.

## One fixed logo

- The primary logo is `logos/subloom-logo-primary.svg`: green symbol with a forest wordmark.
- The wordmark reads **Subloom**, with an uppercase S, with no trailing period. Use **Subloom** in prose, app names and headings.
- Use the supplied outlined artwork. Do not retype the wordmark or substitute a font rendering.
- The standalone symbol is for app icons, favicons and established-brand contexts.
- The wordmark-only asset is a secondary choice when the symbol already appears nearby. Do not place both a full lockup and a standalone wordmark side by side.
- Use `inverse` on dark forest surfaces, `forest` for a single dark ink, and `black`/`white` for strict monochrome work. The white exports are transparent; place them on a dark background to inspect them.
- Retire the eight-petal icon, sprout and paired-leaf exploration. The four-petal header mark is now the canonical symbol. Never invent another local logo.

## Geometry, spacing and size

The symbol's design box is 64 by 64 units; the visible artwork occupies approximately 44 by 44 units. Four identical petals repeat at quarter turns around the center. Keep their relationship fixed.

Reserve at least **16 units of clear space**, one quarter of the symbol design-box height, around a complete logo. This space is measured outside the SVG view box; the built-in interior margin does not replace it. For a lockup rendered 32 pixels high, leave at least 8 pixels outside it.

Minimum symbol design-box size: **16 pixels**. Preferred small interface size: **24-32 pixels**. Minimum full lockup width: **140 pixels**, and prefer 160-180 pixels in app and web headers. In print, start with a 6 mm symbol or a 30 mm lockup, then proof at actual size. Where a mark is interactive, its surrounding hit area must be at least 44 by 44 pixels even when the artwork is smaller.

Do not stretch, rotate the complete mark, separate the petals, change their arrangement, add outlines, use a gradient, apply a drop shadow, crop it, add or remove a petal, or place it on a busy photograph. Do not animate the petals independently. Do not turn the logo into a progress indicator.

## Color system

| Role | Name | Hex | Usage |
| --- | --- | --- | --- |
| Brand action | Subloom Green | #087C65 | Logo symbol on light surfaces, primary actions and selected controls |
| Main ink | Forest | #182D25 | Wordmark, headings, reading text and dark marketing fields |
| Brand field | Bloom Mint | #E1F0DE | Illustration stages, inverse symbol and quiet emphasis |
| App canvas | Cloud | #F8FAF8 | Main light interface background |
| Surface | White | #FFFFFF | Cards, fields and content surfaces |
| Supporting text | Leaf | #586F61 | Secondary text where contrast permits |
| Dark canvas | Night | #101A16 | Main dark interface background |
| Dark surface | Night Surface | #18251E | Dark content surfaces |
| Dark body | Pale Leaf | #E7F2E9 | Dark-mode reading text |
| Dark action | Soft Green | #70D2AD | Dark-mode interactive elements |

The website may use warm paper **#F4F5ED** and artwork stage lilac **#EAE5F0** as supporting fields. These do not replace the main brand colors. Gold, sky blue and lilac can appear inside the existing 3D illustrations; they are not extra logo colors.

Use Cloud/White for most reading surfaces, Forest for text, Green for meaningful actions, and Mint for generous visual stages. Avoid a page made of competing accent colors. Dark sections use Mint or Pale Leaf text.

Personal app accents may change the interface's controls, charts and decorative surfaces. **They never recolor the brand logo.** The logo stays Green on light surfaces and Mint on dark surfaces. Existing success, warning and error colors retain their semantic meaning and are not repurposed as brand colors.

Use at least 4.5:1 contrast for normal text and 3:1 for large text and essential graphics. Logo exemptions do not extend to surrounding labels. Reference pair ratios are recorded in `tokens/contrast.json`.

## Typography

**Manrope** is the display face. Use 600 for quieter headings and 700 for strong headings. **DM Sans** is the reading and control face, using 400 regular, 500 medium and 600 semibold. The included fonts carry their original licenses.

- Website hero: fluid 40-67 px, weight 700, 1.08-1.15 line height; shrink or edit copy to preserve a readable mobile composition.
- Website section heading: 34-52 px, weight 700, about 1.13 line height.
- App page heading: preserve the existing 26/27/30 px responsive roles.
- Body: 16-18 px on marketing pages; preserve the app's 14 px base with its accessibility settings.
- Supporting copy: use smaller sizes only for secondary metadata; never use small low-contrast text for an important explanation.
- Headings use modest negative tracking, generally -0.02 to -0.04 em. Reading text uses normal tracking and 1.45-1.65 line height.
- Use sentence case, short headings and clear numerical units. Keep currency symbols and precision readable. Do not style one random headline word in a different font or color.

The logo's type is outlined and independently fixed. Changing interface font size or a browser's font rendering must not change the logo.

## Interface and layout

Use the existing 4, 8, 16, 24, 32 and 48 px space scale. Related controls sit close; a new topic receives a larger gap. Align copy and actions to shared edges and preserve equal outer gutters.

App radii remain 10, 16 and 24 px. Marketing stages may use 32 px. Pill shapes are reserved for compact actions and segmented controls. Separate surfaces with a tone change; use the existing semantic border only where the interface needs one. Do not add glass, glows or decorative shadows to app controls.

Use the existing Lucide icon system with consistent weight. A feature icon, service logo or avatar never substitutes for the Subloom logo. Preserve visible focus, keyboard access, descriptive action labels, accessible hit areas and dynamic text behavior outside the fixed logo artwork.

## Illustration and motion

The existing wallet and renewal-calendar artwork defines the illustration family: tactile rounded 3D financial objects, deep teal, ivory, muted sky blue, lilac accents and warm gold. Soft studio lighting and quiet backgrounds support readability. The logo itself is always flat vector artwork.

Use one main illustration per moment. Do not add an unrelated mascot, faceless stock team, generic rocket, decorative coins suggesting returns, or a second botanical logo. Use the master symbol sparingly as a brand accent; do not scatter it like confetti.

Interface feedback uses the existing 150 and 240 ms tokens. Charts can use bounded transitions up to 450 ms. Marketing entrances may take longer when they clarify the composition, and must leave content visible if JavaScript is unavailable. Honor system reduced motion; show final values immediately. Do not use endless logo rotation, pulsing, or petal-by-petal motion.

## Voice and product truth

Write like a calm, capable companion. Be warm without baby talk; specific without financial jargon. Prefer "See your upcoming renewals" to "Unlock financial freedom." Use the person's choices as the subject.

| Use | Avoid |
| --- | --- |
| A calmer place for your subscriptions. | Your money, magically managed. |
| Start on this device. | Connect everything to get started. |
| Spotify renews on 24 October. | We will stop your next payment. |
| Your changes are still here. Try saving again. | Something went wrong. |
| Estimate in EUR; original price in USD. | Your bank will charge exactly this. |
| Record cancellation after managing it with the provider. | Subscription canceled automatically. |

Label sample data. Preserve original currencies, date-only renewal meaning, guest persistence, optional owner-isolated cloud sync, and explicit permission for external processing. Do not claim bank access, encryption guarantees, compliance certifications, customer counts or delivery channels that have not been verified.

## App icons and launch surfaces

`icons/subloom-app-icon.png` is the opaque 1024 px square source used by the current Expo app. Its green background extends to all edges. Do not bake a rounded mask into this source. Confirm current platform/store export requirements before submission; these files do not represent store approval.

Android foreground and monochrome layers are separate transparent 1080 px exports. Their visible mark is about 49.5 dp when scaled to a 108 dp layer, inside the 66 dp central safe zone. Let Android apply its launcher mask and theming. Do not reuse the opaque square as the adaptive foreground. See [Android's adaptive icon guidance](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive).

Use the dedicated transparent light/dark splash marks. Favicons are supplied as SVG plus 16, 32 and 48 px PNGs. The web touch icon is 180 px. These share the same mark geometry; only the usage container differs.

## Source of truth and future changes

`source/identity.json` is the canonical master for the mark, outlined wordmark and fixed brand colors. `source/subloom-master.svg` is its portable vector proof. The generator writes the complete logo family, icons, CSS/JSON tokens, native constants and website constants.

From the repository root:

```sh
node scripts/build-brand.mjs
node scripts/build-brand.mjs --check
```

The generator uses Sharp from the landing project's installed dependencies. Run `npm ci` inside `landing/` first if dependencies are missing. PNG and SVG exports are generated assets: do not edit them independently. The SHA-256 manifest catches an accidental local redraw or stale export.

Use `src/components/ui/Brand.tsx` in the app and `landing/components/brand.tsx` on the website. Both consume the same generated master data. Update the identity only as a deliberate, versioned brand change, then regenerate every application together. Preserve all other product design and financial behavior.

This identity was authored for Subloom. No trademark registration or legal exclusivity is claimed; a formal clearance was not part of this work.
