# Free access and Pro enforcement

The existing Free/Pro restrictions, signed licenses, billing code and paid records remain in place. One public configuration flag controls whether the paid restrictions are enforced:

```dotenv
EXPO_PUBLIC_PRO_PLAN_ENABLED=false
```

- `false`: guests and signed-in users can use every currently available feature without a paid license, including offline. The ten-subscription and one-card/one-wallet restrictions are bypassed. Upgrade prompts and Pro badges are hidden; new checkout sessions are blocked by the app and backend.
- `true`: the existing Free/Pro rules apply again. Records saved during free mode remain available for viewing, editing and deletion; new additions above the Free limits need Pro.
- Missing values preserve the existing paid restrictions. Deployment commands reject values other than `true` or `false`.

This flag is public configuration, not a secret. Users cannot change the server's mode. Database ownership checks, authentication, input validation, rate limits and technical capacities (including the 50 saved billing methods maximum) still apply. Features marked coming soon remain unavailable.

## Apply a change

1. Set `EXPO_PUBLIC_PRO_PLAN_ENABLED` in `.env.local` (or the build/deployment environment). Use the same value for web, desktop, mobile, CI and EAS build/update environments.
   GitHub build/deployment workflows read the repository/environment variable of this name and default to `false` while payments are not ready. EAS cloud builds and updates must also have this public variable set in the selected EAS environment. Local `.env.local` values alone do not configure remote EAS environments.
2. On first installation of the switch, apply the `toggle_pro_plan` migration and deploy the updated `pro-billing` function. `npm run deploy:supabase` does this and applies the configured mode after deployment.
3. For later mode changes, run `npm run configure:plans`. Preview the target and mode with `npm run configure:plans -- --plan`.
4. Restart/reload development builds, or rebuild and distribute deployed app bundles. Expo embeds public environment values in the bundle; changing a server setting does not rewrite already installed apps.

The configuration command updates the private database setting used by both database write guards and checkout. It does not modify user entitlements or invent paid memberships. The private row starts with enforcement enabled until the configuration command applies the environment value.

Free access does not cancel or pause existing paid subscriptions. Settings → Free access → Manage an existing subscription keeps billing verification, portal access and cancellation available.

To restore paid plans, repeat these steps with `EXPO_PUBLIC_PRO_PLAN_ENABLED=true`. Update/distribute app bundles as part of the switch so client and backend modes agree. Existing Free/Pro checks and records are reused.

Environment handling follows the [Expo environment variable documentation](https://docs.expo.dev/guides/environment-variables/). Function permissions follow the [Supabase database function guidance](https://supabase.com/docs/guides/database/functions).
