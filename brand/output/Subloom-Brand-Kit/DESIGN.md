---
name: "Subloom brand kit"
description: "Fourfold Bloom: the fixed Subloom identity and its standalone brand guide."
colors:
  green: "#087C65"
  forest: "#182D25"
  mint: "#E1F0DE"
  cloud: "#F8FAF8"
  white: "#FFFFFF"
  secondary: "#586F61"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(37px, 5vw, 68px)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(29px, 3.7vw, 45px)"
    fontWeight: 700
    lineHeight: 1.14
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    letterSpacing: "-0.035em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  button:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 600
rounded:
  panel: "24px"
  swatch: "20px"
  download: "16px"
  pill: "999px"
spacing:
  section: "100px"
  section-compact: "76px"
  gap: "20px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.white}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "16px 24px"
    height: "54px"
  button-primary-hover:
    backgroundColor: "{colors.green}"
    textColor: "{colors.white}"
  tone-option:
    backgroundColor: "{colors.cloud}"
    textColor: "{colors.forest}"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
  tone-option-selected:
    backgroundColor: "{colors.green}"
    textColor: "{colors.white}"
  preview:
    backgroundColor: "{colors.white}"
    textColor: "{colors.forest}"
    rounded: "{rounded.panel}"
    padding: "45px"
  preview-inverse:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.mint}"
    rounded: "{rounded.panel}"
  download:
    backgroundColor: "{colors.white}"
    textColor: "{colors.forest}"
    rounded: "{rounded.download}"
    padding: "18px 20px"
    height: "68px"
---

# Design System: Subloom brand kit

## Overview

**Creative North Star: "Fourfold Bloom"**

Subloom has one calm, friendly identity across its app and website. Four matching rounded petals repeat around one center, preserving the familiar native mark. The supplied outlined wordmark with an uppercase S completes the lockup without a trailing period. This fixed identity coexists with personal interface accents.

This standalone guide at `index.html` presents the existing identity with generous forest/mint fields, clear typography and inspectable light, mint and dark logo proofs. It documents the durable identity rather than defining a new product interface. Product claims remain governed by `../PRODUCT.md`; `GUIDE.md` supplies detailed usage and voice guidance.

**Key Characteristics:**

- One four-petal master and outlined wordmark with an uppercase S across every application.
- Fixed Green/Forest primary logo and Bloom Mint inverse, independent of personal accents.
- Manrope headings, DM Sans reading text and generous tonal stages.
- Flat vector logos, tactile supporting financial artwork and bounded interface feedback.

## Colors

The frontmatter records the guide's actual reused CSS colors. Their master values live in `source/identity.json`; generated `tokens/brand.json` and `tokens/brand.css` carry the shared brand exports.

### Primary

- **Subloom Green** (`green`): symbol on light surfaces, selected preview controls, action hover and focus.
- **Bloom Mint** (`mint`): quiet proof fields and both parts of the inverse logo on forest surfaces.

### Neutral

- **Forest** (`forest`): outlined primary wordmark, main reading text, primary actions and inverse-logo stages.
- **Cloud** (`cloud`): the main guide canvas and unselected preview controls.
- **White** (`white`): preview and download surfaces and the foreground of dark/green controls.
- **Leaf** (`secondary`): secondary explanatory copy and file metadata.

**The Fixed Logo Color Rule.** Personal accents never recolor the logo. Use brand Green for the mark and Forest for the outlined wordmark on light surfaces; use Bloom Mint for both on dark surfaces. Approved monochrome exports serve strict single-ink applications; they do not introduce alternate brand hues.

## Typography

Manrope 700 is loaded locally for guide headings. DM Sans 400 and 600 supply reading text and controls. The shared identity also includes Manrope 600 and DM Sans 500 for the existing app roles; the guide does not replace those roles. Font licenses remain alongside the supplied fonts.

The frontmatter records the guide's display, headline, title, body and action roles. Its narrow layout uses a (40 px) main heading, (38 px) Manrope specimen and (20 px) DM Sans specimen. Reading paragraphs are capped at (65 ch). Headings use sentence case; clear currency labels and original precision remain readable.

**The Outlined Wordmark Rule.** Render the supplied outlined Manrope 700 wordmark, `Subloom` with an uppercase S, without a trailing period. Interface text resizing and font rendering must not alter its geometry. Use Subloom in prose and application names.

## Layout

The guide centers a container capped at (1240 px), with (40 px) side gutters. Below (760 px), gutters become (20 px). Main sections use the recorded spacing, with a (48 px) initial section offset and (43 px) gap before the first proof. The large proof uses (1.6:1) columns; type specimens, application proof and downloads use paired columns. These stack at the compact breakpoint; palette tiles remain two columns.

Reserve at least (16 units) of clear space outside the logo's (64 unit) symbol design box: one quarter of its height. Internal SVG margins do not replace outside clear space. Minimum symbol size is (16 px), preferred small use (24–32 px), and minimum complete lockup width (140 px). The guide header uses (170 px), compact header (150 px) and footer (145 px) lockups. Interactive logo wrappers maintain a (44 px) minimum hit height.

## Elevation & Depth

The logo is flat vector artwork with no shadows, gradients or effects. Tonal fields and generous spacing separate the guide's panels. Tactile wallet artwork supports the financial subject; its rendered lighting does not become a logo effect or a global interface shadow.

Guide buttons lift by (2 px) over (200 ms); logo-preview backgrounds transition over the same interval. Focus uses a (3 px) Green outline offset (5 px). The system reduced-motion setting disables transitions, animation and smooth scrolling. Keep the complete mark static; never animate petals independently or turn it into a progress indicator.

## Shapes

Four matching rounded petals repeat at quarter turns around a shared center in a (64 × 64 unit) box. Preserve the complete master path and its relationship to the wordmark. Never redraw, stretch, crop, rotate the complete logo, add outlines, rearrange petals or introduce an alternate sprout, paired leaf or eight-petal mark.

The guide uses the recorded panel, swatch, download-row and pill radii. The rounded preview of the app icon is a usage demonstration; the shipping opaque (1024 px) app-icon source remains square and unmasked. Platform masks and dedicated adaptive layers are separate applications of the same geometry.

## Components

**The One Master Rule.** Read `GUIDE.md` before changing a logo or brand application. `source/identity.json` is the canonical master; `source/subloom-master.svg` is its portable vector proof. Generated assets and constants are outputs, never independent logo sources.

**Logo family:** Use `logos/subloom-logo-primary.svg` on light surfaces and the inverse on dark forest. Standalone marks serve launcher, favicon and established-brand contexts; wordmark-only exports are secondary when the mark is already present. Do not place a wordmark beside a full lockup. Use supplied SVGs for scalable applications and generated PNGs where needed.

**App and website integration:** `../src/components/ui/Brand.tsx` and `../landing/components/brand.tsx` consume the generated `../src/brand/identity.ts` and `../landing/components/brand-identity.ts`. Decorative vector `OnboardingArt` reuses the same master mark in its folder and desktop scenes; surrounding artwork follows the personal palette while the logo keeps its fixed light/dark brand color. Do not paste a local redraw into another component.

**Regeneration and drift:** From the repository root run `node scripts/build-brand.mjs`, then `node scripts/build-brand.mjs --check`. Keep paths, icons, tokens and web/native constants consistent. The generator needs the landing project's installed Sharp dependency; generated exports carry the manifest's source and hash provenance. Consult `GUIDE.md` for platform export constraints and detailed usage.

**Actions and navigation:** Primary download actions are Forest pills with white reading text, Green hover and visible keyboard focus. Header section links retain (44 px) minimum height and turn Green on hover. Icons are inline SVG; do not replace them with glyph arrows or an icon font.

**Logo proof controls:** A named group of Light, Mint and Forest buttons exposes selected state through `aria-pressed`. Selecting a tone changes the proof field and uses the correct supplied primary/inverse artwork. The control proves existing approved variants, rather than authorizing a new logo color.

**Download rows and palette tiles:** White rounded download links pair a file name with quiet format metadata and an inline SVG affordance. Hover uses Mint; focus remains explicit. Palette tiles pair each actual color with its name, value and purpose, so color alone does not carry the instruction.

## Do's and Don'ts

### Do:

- Do reuse the canonical Fourfold Bloom paths and outlined wordmark through generated assets or shared components.
- Do keep logo colors fixed while preserving personal interface accents and semantic status colors.
- Do preserve outside clear space, proportions, minimum size and accessible hit areas.
- Do regenerate all brand outputs together and run the drift check after a deliberate master change.
- Do preserve original currencies, date-only renewals, guest persistence and owner-isolated sync; follow PRODUCT.md for product truth.

### Don't:

- Don't redraw the mark, retype the wordmark, add a trailing period or introduce an alternate botanical symbol.
- Don't stretch, crop, rotate, shadow, apply arbitrary colors or independently animate the petals.
- Don't turn the logo into a progress indicator or scatter it as decorative confetti.
- Don't promote this guide's page composition or control sizes into app-wide requirements.
- Don't claim bank access, automatic cancellation, guaranteed savings or financial capabilities beyond PRODUCT.md.
