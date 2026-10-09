import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

// EAS config evaluation does not automatically load the app's local Expo variables.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (
    /^(RESEND_|EMAIL_|INBOUND_DOMAIN$|APP_LINK_BASE$|CRON_SECRET$|GOOGLE_VISION_API_KEY$|SUPABASE_SERVICE_ROLE_KEY$|SUPABASE_SECRET_KEY$)/.test(
      name,
    )
  )
    delete env[name];
}
execFileSync("npx", ["--yes", "eas-cli@24.12.1", ...process.argv.slice(2)], {
  env,
  stdio: "inherit",
});
