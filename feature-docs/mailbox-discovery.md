# Gmail and Outlook receipt discovery

**Hosted setup, 2026-10-11:** Migration 004 and both functions deployed; encryption key and localhost return URL configured. Token table/service RPC isolation passed. Live provider credentials and scanning remain pending. See [setup progress](setup-progress.md).

Settings → Mailbox discovery requires a verified Subloom account. Read the scope explanation and explicitly enable consent, then connect Gmail/Outlook in its provider browser. This is separate from social login. Refresh connections on return. Press **Scan recent receipts** to scan at most 25 receipt/search matches from the previous 30 days. Gmail searches receipt terms plus age; Outlook search returns up to 25 matches then age-filters them. There is no background polling, attachment fetch or automatic subscription creation. Extracted candidates use the existing review/deduplication pipeline and optional existing receipt notifications.

Mailbox access tokens and rotating refresh tokens are AES-256-GCM encrypted with user/provider context, stored in service-only tables, excluded from account export and inaccessible through client RPCs/RLS. OAuth uses S256 PKCE, hashed 10-minute single-use state and fixed return URLs. Connection generations prevent an old callback or token refresh from reconnecting a disconnected mailbox. Scans are leased and rate-limited. Disconnect atomically deletes stored tokens and pending OAuth states; Gmail grant revocation is attempted, while Microsoft app consent must also be removed in Microsoft account settings to revoke the provider grant. Account deletion cascades stored credentials/states; it does not guarantee provider-side grant removal. In-flight requests can finish before disconnect; a generation check stops subsequent ingestion. Already extracted detections remain reviewable. Raw response bodies are bounded and never stored as receipt evidence; parsed candidate fields are stored, along with message identifiers/sender hashes.

## Server credentials and setup

Apply `202610110004_mailbox_connections.sql`; deploy `mailbox-connect`, `mailbox-callback` and updated ingestion/export functions. Set only server secrets:

- `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`: Google OAuth web application with Gmail API enabled, offline access, and `https://www.googleapis.com/auth/gmail.readonly` consent. In testing mode add authorized test users. Public release requires Google’s restricted-scope verification/security requirements.
- `OUTLOOK_CLIENT_ID`, `OUTLOOK_CLIENT_SECRET`: Microsoft Entra app supporting the desired organizational/personal accounts, delegated `Mail.Read` plus `offline_access`, and applicable tenant consent.
- `MAILBOX_ENCRYPTION_KEY`: 32 random bytes encoded as base64 (for example generate privately with `openssl rand -base64 32`). Back it up securely; changing it requires disconnect/reconnect because old tokens cannot decrypt.
- `MAILBOX_APP_URL`: exact web return URL, e.g. `https://YOUR_APP_DOMAIN/mailboxes` (HTTPS in production; localhost HTTP allowed for development). Native returns to `subloom://mailboxes` and needs a rebuilt app.
- Both providers’ registered callback: `https://fdjsmpmgrwzmqovzundx.supabase.co/functions/v1/mailbox-callback`. Existing Supabase service-role credentials stay server-side. Resend is used only by the existing notification pipeline and does not replace mailbox OAuth credentials.

## Validation and release status

`npm run check`, backend type checks and Deno provider tests cover scope checks, encryption/context/tamper rejection, token refresh, MIME/attachment handling, receipt API requests and limits. Real PostgreSQL tests cover private token access, state expiration/replay, scan leases and disconnect/callback races. Live consent/token refresh/receipt scan/disconnect remain untested because provider credentials are not supplied; keep this PR draft until the complete live flow passes for both providers. No personal mailbox was connected or scanned during implementation.

References: [Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Gmail read-only scope](https://developers.google.com/workspace/gmail/api/auth/scopes), [Microsoft authorization flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [Graph messages](https://learn.microsoft.com/en-us/graph/api/user-list-messages?view=graph-rest-1.0). Stacked after Google/Apple login.
