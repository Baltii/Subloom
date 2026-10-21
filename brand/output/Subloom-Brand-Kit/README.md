# Subloom brand kit 1.0

**Fourfold Bloom** is the fixed identity for the app and website: the familiar four-petal Subloom mark, an outlined wordmark with an uppercase S, and the existing forest/green/mint palette.

Start with **index.html** for the visual kit, **output/Subloom-Brand-Guide.pdf** for the printable guide, or **GUIDE.md** for the complete editable rules. The logo source, exports, fonts, licenses, tokens, and existing illustrations are included. The logo is supplied as paths and needs no installed font.

## Which file to use

- `logos/subloom-logo-primary.svg`: normal website/app header and most communication.
- `logos/subloom-logo-inverse.svg`: mint artwork on a dark forest background.
- `logos/subloom-logo-forest.svg`: one-color forest reproduction.
- `logos/subloom-logo-black.svg`, `...-white.svg`: strict monochrome reproduction.
- `logos/subloom-mark-*.svg`: standalone symbol, plus 1024 px transparent PNGs.
- `logos/subloom-wordmark-*.svg`: secondary wordmark-only use, plus 2400 px PNGs.
- `icons/subloom-app-icon.png`: opaque 1024 px app icon source.
- `icons/subloom-adaptive-foreground.png`, `...-monochrome.png`: transparent Android layers.
- `icons/subloom-splash.png`, `...-dark.png`: transparent launch marks.
- `icons/subloom-favicon.svg`: small web icon, with 16/32/48/180/192/512 px PNG exports.
- `tokens/brand.json`, `tokens/brand.css`: portable foundations.
- `tokens/contrast.json`: computed accessible color pairs.

SVG is preferred for scaling, interfaces and print. PNG lockups are 2400 px wide. Every export is generated from `source/identity.json`; the app and website receive matching generated constants.

From the repository root, regenerate using `node scripts/build-brand.mjs`, and check with `node scripts/build-brand.mjs --check`. Install the landing dependencies first with `npm ci` in `landing/` if necessary. Standalone PDF regeneration uses `source/build-guide.py` with ReportLab, Pillow and fontTools.

The visual kit opens directly as a local file; for browser font restrictions, serve the repository locally and visit `/brand/`. The background controls preview the same approved logo on light, mint and forest surfaces. Nothing is sent to an external service.

The old eight-petal icon, sprout and paired-leaf exploration are retired; the original four-petal mark is the permanent foundation. Personal app accents remain available but no longer recolor the logo. The wordmark has no trailing period. Keep at least one quarter of the symbol box as outside clear space. See GUIDE.md before adding a new application.

These assets are authored for Subloom; no trademark clearance or platform/store approval is claimed. Current Apple icon workflows may require additional platform-specific exports for submission. Android geometry follows the linked official adaptive-icon guidance in the guide.
