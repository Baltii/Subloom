export function publicExpoEnvironment(
  inherited: Record<string, string | undefined>,
  files: Record<string, string>[],
  allowExpoToken = false,
) {
  const env: Record<string, string | undefined> = {
    ...inherited,
    EXPO_NO_DOTENV: "1",
  };
  for (const values of files) {
    for (const [name, value] of Object.entries(values)) {
      if (name.startsWith("EXPO_PUBLIC_") && env[name] === undefined)
        env[name] = value;
    }
  }
  for (const name of Object.keys(env)) {
    if (
      name.startsWith("EXPO_PUBLIC_") ||
      (allowExpoToken && name === "EXPO_TOKEN")
    )
      continue;
    if (
      /SECRET|TOKEN|PASSWORD|PRIVATE_KEY|PRIVATE_JWK|API_KEY|ENCRYPTION_KEY|SERVICE_ROLE|DATABASE_URL|SUPABASE_DB_URL|^(STRIPE_|RESEND_|EMAIL_|GMAIL_|OUTLOOK_|MAILBOX_|TINK_|PLAID_|BANK_|INBOUND_DOMAIN$|APP_LINK_BASE$)/.test(
        name,
      )
    )
      delete env[name];
  }
  return env;
}
