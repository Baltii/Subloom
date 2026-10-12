import {
  seal,
  unseal,
  challenge,
  base64url,
} from "../_shared/mailbox-crypto.ts";
import {
  authorizationUrl,
  tokenRequest,
  gmailText,
  receiptMessages,
  readProviderJson,
  returnUrl,
} from "../_shared/mailbox-providers.ts";
function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
async function rejects(action: () => Promise<unknown>) {
  try {
    await action();
  } catch {
    return;
  }
  throw new Error("Expected rejection");
}
Deno.env.set("MAILBOX_ENCRYPTION_KEY", base64url(new Uint8Array(32).fill(7)));
Deno.env.set("GMAIL_CLIENT_ID", "test-google-client");
Deno.env.set("GMAIL_CLIENT_SECRET", "test-google-secret");
Deno.env.set("OUTLOOK_CLIENT_ID", "test-outlook-client");
Deno.env.set("OUTLOOK_CLIENT_SECRET", "test-outlook-secret");
Deno.env.set("SUPABASE_URL", "https://project.example.test");
Deno.env.set("MAILBOX_APP_URL", "https://app.example.test/mailboxes");
Deno.test(
  "mailbox tokens are context-bound, randomized and authenticated",
  async () => {
    const a = await seal("private-token", "user-a:gmail"),
      b = await seal("private-token", "user-a:gmail");
    assert(a !== b);
    assert(!a.includes("private-token"));
    assert((await unseal(a, "user-a:gmail")) === "private-token");
    await rejects(() => unseal(a, "user-b:gmail"));
    await rejects(() => unseal(a.slice(0, -3) + "bad", "user-a:gmail"));
    assert((await challenge("verifier")) === (await challenge("verifier")));
  },
);
Deno.test(
  "authorization requires read-only scopes, offline consent and PKCE",
  () => {
    const gmail = new URL(authorizationUrl("gmail", "state", "challenge"));
    assert(
      gmail.searchParams.get("scope") ===
        "https://www.googleapis.com/auth/gmail.readonly",
    );
    assert(gmail.searchParams.get("code_challenge_method") === "S256");
    assert(gmail.searchParams.get("access_type") === "offline");
    const outlook = new URL(authorizationUrl("outlook", "state", "challenge"));
    assert(outlook.searchParams.get("scope")?.includes("Mail.Read"));
    assert(!outlook.searchParams.get("scope")?.includes("Mail.Send"));
    assert(returnUrl("native") === "subloom://mailboxes");
  },
);
Deno.test(
  "refresh rotates tokens and rejects missing mailbox consent",
  async () => {
    const requests: RequestInit[] = [];
    const fetcher: typeof fetch = async (_input, init) => {
      requests.push(init!);
      return new Response(
        JSON.stringify({
          access_token: "fresh",
          refresh_token: "rotated",
          expires_in: 3600,
          scope: "https://www.googleapis.com/auth/gmail.readonly",
        }),
      );
    };
    const tokens = await tokenRequest(
      "gmail",
      { grant_type: "refresh_token", refresh_token: "old" },
      {
        access_token: "expired",
        refresh_token: "old",
        expires_at: 1,
        scope: "https://www.googleapis.com/auth/gmail.readonly",
      },
      fetcher,
    );
    assert(tokens.refresh_token === "rotated");
    assert(String(requests[0]!.body).includes("grant_type=refresh_token"));
    await rejects(() =>
      tokenRequest(
        "gmail",
        { grant_type: "authorization_code" },
        undefined,
        async () =>
          new Response(
            JSON.stringify({
              access_token: "token",
              expires_in: 3600,
              scope: "profile",
            }),
          ),
      ),
    );
  },
);
Deno.test(
  "MIME decoding ignores attachments and supports Unicode text and HTML",
  () => {
    const encode = (text: string) => base64url(new TextEncoder().encode(text));
    const text = gmailText({
      mimeType: "multipart/mixed",
      parts: [
        {
          mimeType: "text/plain",
          body: { data: encode("Receipt café USD 10") },
        },
        {
          mimeType: "text/plain",
          filename: "private.txt",
          body: { data: encode("attachment secret") },
        },
        {
          mimeType: "text/html",
          body: {
            data: encode("<script>secret()</script><p>Renewal EUR 9</p>"),
          },
        },
      ],
    });
    assert(text.includes("café"));
    assert(text.includes("EUR 9"));
    assert(!text.includes("attachment secret"));
    assert(!text.includes("secret()"));
  },
);
Deno.test(
  "receipt adapters bound message requests and reject oversized bodies",
  async () => {
    const urls: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      const url = String(input);
      urls.push(url);
      return url.includes("?format=full")
        ? new Response(
            JSON.stringify({
              payload: {
                mimeType: "text/plain",
                headers: [
                  { name: "Subject", value: "Subscription receipt" },
                  { name: "From", value: "billing@example.test" },
                ],
                body: {
                  data: base64url(new TextEncoder().encode("USD 10 monthly")),
                },
              },
            }),
          )
        : new Response(JSON.stringify({ messages: [{ id: "message-1" }] }));
    };
    const messages = await receiptMessages("gmail", "access", fetcher);
    assert(messages.length === 1 && messages[0]!.text.includes("USD 10"));
    assert(new URL(urls[0]!).searchParams.get("maxResults") === "25");
    assert(new URL(urls[0]!).searchParams.get("q")?.includes("newer_than:30d"));
    await rejects(() => readProviderJson(new Response("x".repeat(2_000_001))));
  },
);
Deno.test(
  "Outlook adapter requests receipt search with read-only text bodies and ignores old matches",
  async () => {
    let captured = "";
    const fetcher: typeof fetch = async (input, init) => {
      captured = String(input);
      assert(new Headers(init?.headers).get("Prefer")?.includes("text"));
      return new Response(
        JSON.stringify({
          value: [
            {
              id: "new",
              subject: "receipt",
              receivedDateTime: new Date().toISOString(),
              body: { content: "USD 10 subscription", contentType: "text" },
            },
            {
              id: "old",
              receivedDateTime: "2020-01-01T00:00:00Z",
              body: { content: "old", contentType: "text" },
            },
          ],
        }),
      );
    };
    assert((await receiptMessages("outlook", "access", fetcher)).length === 1);
    assert(
      new URL(captured).searchParams.get("$search") ===
        '"subscription OR renewal OR invoice OR receipt"',
    );
  },
);
