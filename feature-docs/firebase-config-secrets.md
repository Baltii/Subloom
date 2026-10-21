# Firebase Android configuration outside Git

GitHub alert 1 identifies the client API key in the formerly tracked root `google-services.json`. The file is now ignored and removed from the current source tree, while the local copy remains available for native builds. Server service-account credentials are separate and remain outside the repository.

GitHub Android CI restores `GOOGLE_SERVICES_JSON` from an encrypted repository secret to a private runner temporary file. It validates only the Android package name without printing key values, removes the temporary file after the build, and does not give credentials to fork PRs. EAS can consume a secret file variable through the app configuration's existing `GOOGLE_SERVICES_JSON` path. After explicit approval, the secret file variable was created for development, preview and production.

Firebase client keys are compiled into apps and are not backend authorization secrets. This cleanup prevents public source exposure and future accidental commits; it does not erase Git history or revoke the previously exposed key. Google authentication for an approved read-only restriction check succeeded, but lookup returned SERVICE_DISABLED because the API Keys API is disabled. Google API/application restrictions still need checking. Do not resolve the GitHub alert as revoked without actual revocation.

This independent security change targets release-candidate. The previously requested service-suggestion PR is compatible and retains its own checks.

Validation: actionlint and git diff whitespace checks pass. Expo public configuration resolves the external file path and Android package correctly. A scan of all tracked files finds no Google API key pattern. The encrypted GitHub secret exists; CI restoration and native prebuild will be checked on this PR. No Google key restriction, revocation, or history rewrite is claimed.
