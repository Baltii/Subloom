import { HttpError } from "./http.ts";

export const MAILBOX_DISCOVERY_ENABLED = false;
export const MAILBOX_DISCOVERY_NOTICE =
  "Mailbox discovery is coming soon to Subloom Pro. Connecting and scanning are not available yet.";

/** Status and disconnection remain available so existing users can remove access. */
export function requireMailboxActionAvailable(action: string) {
  if (!MAILBOX_DISCOVERY_ENABLED && (action === "connect" || action === "scan"))
    throw new HttpError(503, MAILBOX_DISCOVERY_NOTICE);
}

export function mailboxCallbackUnavailable() {
  return !MAILBOX_DISCOVERY_ENABLED
    ? new Response(MAILBOX_DISCOVERY_NOTICE, {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      })
    : null;
}
