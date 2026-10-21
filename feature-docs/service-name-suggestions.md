# Service-name suggestions

Typing a subscription name shows up to six matching catalog names or aliases after a 250 ms debounce. Matches use normalized, case-insensitive prefixes; prices and dates remain the person's own values. The list uses bundled service icons and never sends names to a remote search endpoint. Empty/custom names remain valid; Escape dismisses the list, and Tab/Enter can choose an option. Editing a selected provider name clears the stale provider identifier. Selection shares the existing picker logic and focuses the price field.

Merge order: #50 CI migration → #51 Android safe area → #52 navigation motion → this service-suggestion change. This PR targets the preceding navigation branch.

## Verification

- TypeScript, lint and all 330 tests across 55 files pass.
- Android, iOS and web production JavaScript exports pass.
- Actionlint passes for the new workflow stack.
- Browser interaction at 1440/390 px covers prefix suggestions, immediate hiding of stale matches, six-result cap, no-match custom names, Tab/Enter selection, Escape dismissal, price/date preservation, draft protection and durable guest save/reload.
- Light and dark captures show readable inline options without horizontal overflow. Rapid Calendar/Subscriptions/Settings navigation works; no console warnings/errors were observed.

No Android SDK/emulator or connected device is available locally. Browser checks and inset geometry tests do not establish native system-bar layout, keyboard, back-gesture smoothness or frame rate. The CI APK is provided for device confirmation; OS reduced-motion behavior is configured in source and was not toggled at runtime.
