import { z } from "zod";
import { env, HttpError } from "./http.ts";
export type MailProvider = "gmail" | "outlook";
export const tokensSchema = z.object({
  access_token: z.string().min(1).max(16384),
  refresh_token: z.string().max(16384).optional(),
  expires_at: z.number().int().positive(),
  scope: z.string().max(4096),
});
export function providerConfig(provider: MailProvider) {
  return provider === "gmail"
    ? {
        clientId: env("GMAIL_CLIENT_ID"),
        clientSecret: env("GMAIL_CLIENT_SECRET"),
        authorize: "https://accounts.google.com/o/oauth2/v2/auth",
        token: "https://oauth2.googleapis.com/token",
        scope: "https://www.googleapis.com/auth/gmail.readonly",
      }
    : {
        clientId: env("OUTLOOK_CLIENT_ID"),
        clientSecret: env("OUTLOOK_CLIENT_SECRET"),
        authorize:
          "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        token: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        scope: "offline_access https://graph.microsoft.com/Mail.Read",
      };
}
export function callbackUrl() {
  return (
    env("SUPABASE_URL").replace(/\/$/, "") + "/functions/v1/mailbox-callback"
  );
}
export function returnUrl(kind: "web" | "native") {
  if (kind === "native") return "subloom://mailboxes";
  const url = new URL(env("MAILBOX_APP_URL"));
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname))
    )
  )
    throw new HttpError(503, "Mailbox app URL is not configured.");
  return url.href;
}
export function authorizationUrl(
  provider: MailProvider,
  state: string,
  pkce: string,
) {
  const config = providerConfig(provider),
    url = new URL(config.authorize);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: callbackUrl(),
    response_type: "code",
    scope: config.scope,
    state,
    code_challenge: pkce,
    code_challenge_method: "S256",
    prompt: "consent",
    ...(provider === "gmail"
      ? { access_type: "offline" }
      : { response_mode: "query" }),
  }).toString();
  return url.href;
}
export async function readProviderJson(response: Response) {
  if (!response.ok)
    throw new HttpError(
      502,
      "Mailbox provider rejected the request. Reconnect and try again.",
    );
  const reader = response.body?.getReader();
  if (!reader)
    throw new HttpError(502, "Mailbox provider returned no response.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2_000_000) {
        await reader.cancel();
        throw new HttpError(502, "A mailbox message is too large to scan.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function tokenRequest(
  provider: MailProvider,
  params: Record<string, string>,
  previous?: z.infer<typeof tokensSchema>,
  request: typeof fetch = fetch,
) {
  const config = providerConfig(provider);
  const body = new URLSearchParams({
    ...params,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  const response = await request(config.token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15000),
  });
  const raw = z
    .object({
      access_token: z.string().min(1),
      refresh_token: z.string().optional(),
      expires_in: z.number().positive().max(86400),
      scope: z.string().optional(),
    })
    .parse(await readProviderJson(response));
  const scope = raw.scope || previous?.scope || "";
  if (
    !(provider === "gmail"
      ? scope.split(/\s+/).includes(config.scope)
      : scope
          .toLowerCase()
          .split(/\s+/)
          .some(
            (s) =>
              s === "mail.read" ||
              s === "https://graph.microsoft.com/mail.read",
          ))
  )
    throw new HttpError(403, "Read-only mailbox permission was not granted.");
  return tokensSchema.parse({
    access_token: raw.access_token,
    refresh_token: raw.refresh_token || previous?.refresh_token,
    expires_at: Date.now() + raw.expires_in * 1000,
    scope,
  });
}
const gmailPart: z.ZodType<{
  mimeType?: string;
  filename?: string;
  body?: { data?: string };
  parts?: unknown[];
}> = z.object({
  mimeType: z.string().optional(),
  filename: z.string().optional(),
  body: z.object({ data: z.string().optional() }).optional(),
  parts: z.array(z.unknown()).optional(),
});
export function gmailText(input: unknown, depth = 0): string {
  if (depth > 8) return "";
  const part = gmailPart.parse(input);
  if (part.filename) return "";
  let text = "";
  if (
    ["text/plain", "text/html"].includes(part.mimeType || "") &&
    part.body?.data
  ) {
    const raw = atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
    text = new TextDecoder().decode(
      Uint8Array.from(raw, (c) => c.charCodeAt(0)),
    );
    if (part.mimeType === "text/html") {
      text = text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
    }
  }
  return [text, ...(part.parts || []).map((p) => gmailText(p, depth + 1))]
    .join("\n")
    .slice(0, 100000);
}
export type MailMessage = { id: string; sender: string; text: string };
export async function receiptMessages(
  provider: MailProvider,
  token: string,
  request: typeof fetch = fetch,
): Promise<MailMessage[]> {
  const headers = { Authorization: "Bearer " + token };
  if (provider === "gmail") {
    const url = new URL(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages",
    );
    url.search = new URLSearchParams({
      maxResults: "25",
      q: "newer_than:30d (subscription OR renewal OR invoice OR receipt)",
    }).toString();
    const list = z
      .object({ messages: z.array(z.object({ id: z.string() })).optional() })
      .parse(
        await readProviderJson(
          await request(url, { headers, signal: AbortSignal.timeout(15000) }),
        ),
      );
    const messages: MailMessage[] = [];
    for (const item of (list.messages || []).slice(0, 25)) {
      const raw = z
        .object({ payload: z.unknown() })
        .parse(
          await readProviderJson(
            await request(
              "https://gmail.googleapis.com/gmail/v1/users/me/messages/" +
                encodeURIComponent(item.id) +
                "?format=full",
              { headers, signal: AbortSignal.timeout(15000) },
            ),
          ),
        );
      const payload = z
        .object({
          headers: z
            .array(z.object({ name: z.string(), value: z.string() }))
            .optional(),
        })
        .passthrough()
        .parse(raw.payload);
      const subject =
        payload.headers?.find((h) => h.name.toLowerCase() === "subject")
          ?.value || "";
      const sender =
        payload.headers?.find((h) => h.name.toLowerCase() === "from")?.value ||
        "";
      messages.push({
        id: item.id,
        sender,
        text: (subject + "\n" + gmailText(raw.payload)).slice(0, 100000),
      });
    }
    return messages;
  }
  const url = new URL("https://graph.microsoft.com/v1.0/me/messages");
  url.search = new URLSearchParams({
    $top: "25",
    $search: '"subscription OR renewal OR invoice OR receipt"',
    $select: "id,subject,from,receivedDateTime,body",
  }).toString();
  const result = z
    .object({
      value: z.array(
        z.object({
          id: z.string(),
          subject: z.string().optional(),
          from: z
            .object({ emailAddress: z.object({ address: z.string() }) })
            .optional(),
          receivedDateTime: z.string(),
          body: z.object({ content: z.string(), contentType: z.string() }),
        }),
      ),
    })
    .parse(
      await readProviderJson(
        await request(url, {
          headers: {
            ...headers,
            Prefer: 'outlook.body-content-type="text", IdType="ImmutableId"',
          },
          signal: AbortSignal.timeout(15000),
        }),
      ),
    );
  return result.value
    .slice(0, 25)
    .filter(
      (m) =>
        new Date(m.receivedDateTime).getTime() >= Date.now() - 30 * 86400000,
    )
    .map((m) => ({
      id: m.id,
      sender: m.from?.emailAddress.address || "",
      text: ((m.subject || "") + "\n" + m.body.content).slice(0, 100000),
    }));
}
