# Cancellation assistant

Settings → Cancellation assistant → subscription. Review billing and cancellation terms, open the existing first-party catalog account link when available, track a target date/checklist, and save a plan. Deadlines are user-set targets; no merchant-specific notice period is assumed. In-app deadline text is recalculated in the selected timezone. No deadline email/push job is introduced.

After the provider confirms cancellation, enter a confirmation reference and optional paid-through date, then explicitly record it. This updates subscription status/notes through the normal atomic store transaction and account outbox. It does not cancel a merchant subscription or claim to verify billing. The confirmation reference is appended to notes; existing note length validation prevents silent truncation. Trial-ending dates and provider/partner billing terms may differ.

Plans save locally for guests and in versioned Supabase feature settings for accounts. Load a saved plan explicitly before editing its checklist. A reload action recovers from conflicting writes. Demo mutations are disabled. No additional credentials. Requires the feature-settings migration from the budgets parent. Stacked after calendar export.

`npm run check` covers confirmation requirements, valid dates, deadline boundaries, preserved notes and safe provider-link fallback. The provider account links come from the existing catalog; official process references: [Spotify](https://support.spotify.com/us/article/cancel-premium/), [Netflix](https://help.netflix.com/en/node/407), [Apple billing](https://support.apple.com/en-us/118428). Consult those pages for current provider steps.
