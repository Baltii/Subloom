import { Webhook } from "svix";
import { authenticated, HttpError, limited } from "../_shared/http.ts";
import { sendEmail, sendPush } from "../_shared/delivery.ts";
import { emailTemplate } from "../_shared/email.ts";
import {
  signPreferencesToken,
  verifyPreferencesToken,
} from "../_shared/preferences-token.ts";
function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
async function rejects(action: () => Promise<unknown>, status?: number) {
  try {
    await action();
  } catch (error) {
    if (status !== undefined)
      assert(error instanceof HttpError && error.status === status);
    return;
  }
  throw new Error("Expected rejection");
}
const content = {
  title: "Spotify renews tomorrow.",
  body: "USD 10.99 scheduled.",
  path: "/subscription/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};
const originalFetch = globalThis.fetch;
Deno.env.set("RESEND_API_KEY", "test-provider-key");
Deno.env.set("EMAIL_FROM", "Subloom <reminders@example.test>");
Deno.env.set("SUPABASE_URL", "https://project.example.test");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-server-key");
Deno.env.set(
  "EMAIL_PREFERENCES_SECRET",
  "test-only-signing-secret-32-bytes-long",
);
Deno.test(
  "email provider uses a stable idempotency key and server-side credentials",
  async () => {
    const requests: RequestInit[] = [];
    globalThis.fetch = async (input, init) => {
      assert(String(input) === "https://api.resend.com/emails");
      requests.push(init!);
      return new Response(JSON.stringify({ id: "email-test-id" }), {
        status: 200,
      });
    };
    try {
      assert(
        (await sendEmail(
          "verified@example.test",
          "subloom/delivery-1",
          content,
        )) === "email-test-id",
      );
      await sendEmail("verified@example.test", "subloom/delivery-1", content);
      assert(
        new Headers(requests[0]!.headers).get("Idempotency-Key") ===
          new Headers(requests[1]!.headers).get("Idempotency-Key"),
      );
      assert(requests[0]!.body === requests[1]!.body);
      assert(
        new Headers(requests[0]!.headers).get("Authorization") ===
          "Bearer test-provider-key",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);
Deno.test(
  "email failure remains a failure, never a simulated success",
  async () => {
    globalThis.fetch = async () => new Response("", { status: 503 });
    try {
      await rejects(
        () => sendEmail("verified@example.test", "retry-key", content),
        503,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);
Deno.test(
  "push privacy hides financial details while preserving a safe deep link",
  async () => {
    let message: Record<string, unknown> | undefined;
    globalThis.fetch = async (_input, init) => {
      message = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({ data: { status: "ok", id: "ticket-test" } }),
        { status: 200 },
      );
    };
    try {
      assert(
        (await sendPush("ExpoPushToken[test]", content, true)) ===
          "ticket-test",
      );
      assert(message?.title === "A heads-up from Subloom");
      assert(!String(message?.body).includes("Spotify"));
      assert((message?.data as { path: string }).path === content.path);
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);
Deno.test(
  "invalid Expo device tokens are recognized for revocation",
  async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          data: { status: "error", details: { error: "DeviceNotRegistered" } },
        }),
        { status: 200 },
      );
    try {
      await rejects(() => sendPush("ExpoPushToken[test]", content, false), 410);
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);
Deno.test("provider JSON is schema-validated", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ success: "pretend" }), { status: 200 });
  try {
    await rejects(() => sendEmail("verified@example.test", "key", content));
    await rejects(() => sendPush("ExpoPushToken[test]", content, false));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
Deno.test("HTML templates escape malicious merchant content", () => {
  const html = emailTemplate({
    title: "<script>bad()</script>",
    preview: "<img src=x>",
    body: "Malicious <b>receipt</b> & terms",
    action: "Open",
    url: "subloom://",
  });
  assert(!html.includes("<script>"));
  assert(html.includes("&lt;script&gt;"));
  assert(!html.includes("<img src=x>"));
});
Deno.test("signed webhooks reject tampering and stale timestamps", () => {
  const secret = "whsec_" + btoa("test-signing-secret-with-32-bytes"),
    webhook = new Webhook(secret),
    payload = JSON.stringify({ type: "email.received" }),
    now = new Date(),
    id = "msg_test";
  const signature = webhook.sign(id, now, payload);
  assert(
    webhook.verify(payload, {
      "svix-id": id,
      "svix-timestamp": String(Math.floor(now.getTime() / 1000)),
      "svix-signature": signature,
    }),
  );
  for (const [body, date] of [
    [payload + " ", now],
    [payload, new Date(0)],
  ] as const) {
    let failed = false;
    try {
      webhook.verify(body, {
        "svix-id": id,
        "svix-timestamp": String(Math.floor(date.getTime() / 1000)),
        "svix-signature": signature,
      });
    } catch {
      failed = true;
    }
    assert(failed);
  }
});
Deno.test(
  "streamed uploads cannot bypass size limits by omitting Content-Length",
  async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      body: "x".repeat(1001),
    });
    await rejects(() => limited(request, 1000), 413);
  },
);
Deno.test(
  "authentication fails closed for expired or invalid sessions",
  async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ message: "Invalid JWT", code: "bad_jwt" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    try {
      await rejects(
        () =>
          authenticated(
            new Request("https://example.test", {
              method: "POST",
              headers: { Authorization: "Bearer invalid" },
            }),
          ),
        401,
      );
      await rejects(
        () =>
          authenticated(
            new Request("https://example.test", { method: "POST" }),
          ),
        401,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);
Deno.test(
  "digest opt-out links are deterministic, signed and expiring",
  async () => {
    const id = "11111111-1111-4111-8111-111111111111",
      issuedAt = "2026-10-09T09:00:00Z",
      token = await signPreferencesToken(id, issuedAt);
    assert(token === (await signPreferencesToken(id, issuedAt)));
    assert(
      (await verifyPreferencesToken(token, new Date(issuedAt).getTime())) ===
        id,
    );
    await rejects(
      () =>
        verifyPreferencesToken(
          token.replace("11111111", "22222222"),
          new Date(issuedAt).getTime(),
        ),
      403,
    );
    await rejects(
      () => verifyPreferencesToken(token, new Date("2027-10-09").getTime()),
      403,
    );
  },
);
