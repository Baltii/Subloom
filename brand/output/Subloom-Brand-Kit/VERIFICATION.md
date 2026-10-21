# Verification — Fourfold Bloom 1.0

Verified locally on 21 October 2026.

- Canonical generation check: 30 vector/token/component exports and 63 manifest entries match `source/identity.json`.
- App checks: TypeScript, ESLint and 321 tests across 54 files passed (`npm run check`).
- Expo web export: passed with offline mode. The app was inspected through its exported web renderer.
- Next.js landing production build: passed, including the final four-petal social image.
- Browser evidence: visual kit at 1440, 768 and 390 px; landing at 1440 and 390 px; app at 390 px and 1440 px, including light and dark appearance with a personal Blue accent. The logo retained its fixed brand colors. No horizontal overflow observed in the checked guide/landing widths.
- Logo preview: Light, Mint and Forest controls select the corresponding approved treatment.
- Print guide: 11 rendered pages inspected; searchable text and outlined vector logos.
- Icon sources: opaque RGB 1024 px app icon, separate transparent Android foreground/monochrome layers and splash marks. Android visible mark measures approximately 49.6 dp and stays within the central safe circle.
- Raster provenance: 34 shipping raster files scanned, none missing provenance.

Native iOS/Android builds, simulator screenshots, store submission approval and trademark clearance were not performed. Web rendering does not establish native runtime behavior.

The web design detector ran once and reported font/type-scale advisories against pre-existing parent design documentation. The website uses local Manrope and DM Sans; this brand work does not refresh unrelated historical design drift. The original Chrome-based taste inspector was unavailable, so browser evidence used the in-app browser.

Independent finish review: **ship** after scoring both requested fixes resolved (consistent SVG interface arrows and persisted brand documentation). The verdict pass covers those two fixes; native runtime remains outside the review.

Uppercase-S update: canonical outlined wordmark now reads **Subloom**. All logo exports, app/web constants, brand guidance, PDF and social image were refreshed. Root TypeScript and Next.js production build passed; desktop/mobile guide and landing captures and the 11 PDF pages were checked. Native runtime and the full test suite were not rerun for this lettering-only update.

Focused uppercase-S finish review: **ship**, with no material fixes. Documentation verification passed.
