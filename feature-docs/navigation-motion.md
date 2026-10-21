# Navigation continuity

Primary tabs use a short 240 ms directional shift with cubic settling. Detail routes retain the native horizontal push/back relationship; new/edit/import forms slide upward as modals. Reduced motion selects no spatial navigation animation. No page is remounted for a decorative entrance; tab state remains with the navigator, and desktop sidebar destinations use navigate rather than adding duplicate pushes.

Merge order: CI migration → Android safe area → this navigation change → service suggestions. This PR targets the safe-area branch.

Validation: TypeScript checks navigation options against the installed Expo Router types. Final stack verification covers web navigation and exports. Native swipe/back smoothness, frame rate and live OS reduced-motion switching require device testing.
