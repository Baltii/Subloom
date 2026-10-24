# Subloom landing page

The independent Next.js 16, React 19, and TypeScript website for Subloom.

## Run locally

Use the Node version in `../.nvmrc`, then run from this directory:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000.

```sh
npm run typecheck
npm run build
```

The production build exports a static website into `out/`. Deploy that directory to a static host, or deploy this project through a Next.js host. The Expo app has independent dependencies and configuration.

## Content and configuration

App buttons open https://subloom.baltii.tn. Update `app/page.tsx` and `components/experience.tsx` to change the destination. Metadata uses `VERCEL_PROJECT_PRODUCTION_URL` with a deployment URL fallback.

Sample subscription names, amounts, dates, and profiles are illustrative. Cancellation happens with the merchant. The landing page adds no backend, waitlist, or analytics.

The page supports light, dark, and system themes, keyboard navigation, and reduced motion. Fonts and illustrations are served locally.

## Assets and licenses

Shipping assets live in `public/`; font licenses are included in `public/fonts/`. Icons use Lucide React. Reuse the canonical logo component in `components/brand-identity.ts` and the supplied SVGs in `public/brand/`.

Agent skills, design records, artwork sources, generation prompts, and the full brand kit are private local files. Keep them outside `public/`: Next.js copies that directory into the published website regardless of Git ignore rules.

To regenerate the 1200 × 630 social images, install Python `fonttools` and the Node dependencies, then run:

```sh
python3 scripts/generate-social.py
```

The generator reads the committed canonical logo component and bundled fonts; it does not need the private brand kit. From the repository root, `node scripts/build-brand.mjs --check` verifies the committed product assets.
