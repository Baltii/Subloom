import { type admin } from "../_shared/http.ts";
import {
  deliverFeedbackEmails,
  feedbackEmailContent,
  feedbackRecipient,
  sendFeedbackEmail,
} from "../_shared/feedback-email.ts";

function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
const row = () => ({
  id: crypto.randomUUID(),
  kind: "idea" as const,
  title: "Calendar search",
  message: "Please add search to the calendar view.",
  reply_email: "sender@example.test",
  platform: "web",
  app_version: "1.8.0",
  created_at: "2026-10-25T14:00:00Z",
  email_lease_token: crypto.randomUUID(),
  email_attempts: 1,
});
Deno.env.set("RESEND_API_KEY", "test-feedback-key");
Deno.env.set("EMAIL_FROM", "Subloom <feedback@example.test>");

Deno.test("feedback email has a fixed recipient, optional reply-to, escaped content and a stable send key", async () => {
  const saved = globalThis.fetch, requests: RequestInit[] = [];
  globalThis.fetch = (_input, init) => {
    assert(String(_input) === "https://api.resend.com/emails");
    requests.push(init!);
    return Promise.resolve(
      new Response(JSON.stringify({ id: "email-1" }), { status: 200 }),
    );
  };
  try {
    const value = {
      ...row(),
      title: "Search\r\nInjected",
      message: '<script>alert("x")</script>\n' + "a".repeat(3900),
    };
    await sendFeedbackEmail(value);
    await sendFeedbackEmail(value);
    const body = JSON.parse(String(requests[0]!.body));
    assert(
      body.to.length === 1 && body.to[0] === "baltii.ahmed@gmail.com" &&
        feedbackRecipient === body.to[0],
    );
    assert(
      body.reply_to === "sender@example.test" &&
        body.from === "Subloom <feedback@example.test>",
    );
    assert(!body.subject.includes("\n") && !body.html.includes("<script>"));
    assert(body.text.includes(value.message));
    assert(body.text.includes("\n\n"));
    assert(
      new Headers(requests[0]!.headers).get("Idempotency-Key") ===
        new Headers(requests[1]!.headers).get("Idempotency-Key"),
    );
    await sendFeedbackEmail({ ...value, reply_email: null });
    assert(!("reply_to" in JSON.parse(String(requests[2]!.body))));
  } finally {
    globalThis.fetch = saved;
  }
});

function workerFixture() {
  const value = row();
  const state = {
    accepted: false,
    markFailure: false,
    attempts: 0,
    retryAt: "",
    error: "",
  };
  const updates: Record<string, unknown>[] = [];
  const client = {
    rpc: (name: string, args: { target_id: string; batch_size: number }) => {
      assert(
        name === "claim_feedback_emails" && args.target_id === value.id &&
          args.batch_size === 1,
      );
      state.attempts++;
      value.email_attempts = state.attempts;
      value.email_lease_token = crypto.randomUUID();
      return Promise.resolve({
        data: state.accepted ? [] : [{ ...value }],
        error: null,
      });
    },
    from: (name: string) => {
      assert(name === "app_feedback");
      return {
        update: (patch: Record<string, unknown>) => {
          const filters = new Map<string, unknown>();
          const run = () => {
            assert(
              filters.get("id") === value.id &&
                filters.get("email_lease_token") === value.email_lease_token,
            );
            assert(
              filters.has("email_sent_at") &&
                filters.get("email_sent_at") === null,
            );
            updates.push(patch);
            if (patch.email_sent_at && state.markFailure) {
              return {
                data: null,
                error: { message: "temporary database failure" },
              };
            }
            if (patch.email_sent_at) state.accepted = true;
            if (patch.email_next_attempt_at) {
              state.retryAt = String(
                patch.email_next_attempt_at,
              );
            }
            state.error = String(patch.email_error || "");
            return { data: { id: value.id }, error: null };
          };
          const query = {
            eq: (key: string, filter: unknown) => {
              filters.set(key, filter);
              return query;
            },
            is: (key: string, filter: unknown) => {
              filters.set(key, filter);
              return query;
            },
            select: () => query,
            maybeSingle: () => Promise.resolve(run()),
            then: (resolve: (value: ReturnType<typeof run>) => unknown) =>
              Promise.resolve(run()).then(resolve),
          };
          return query;
        },
      };
    },
  } as unknown as ReturnType<typeof admin>;
  return { client, value, state, updates };
}
Deno.test("email worker records acceptance once and skips already sent messages", async () => {
  const f = workerFixture(), saved = globalThis.fetch;
  let sent = 0;
  globalThis.fetch = () => {
    sent++;
    return Promise.resolve(
      new Response(JSON.stringify({ id: "mail-accepted" })),
    );
  };
  try {
    assert((await deliverFeedbackEmails(f.client, f.value.id)).accepted === 1);
    assert(
      f.state.accepted && f.updates[0]?.email_provider_id === "mail-accepted",
    );
    assert((await deliverFeedbackEmails(f.client, f.value.id)).accepted === 0);
    assert(sent === 1);
  } finally {
    globalThis.fetch = saved;
  }
});
Deno.test("failed provider sends remain queued with backoff and no false sent marker", async () => {
  const f = workerFixture(), saved = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(new Response("unavailable", { status: 503 }));
  try {
    assert((await deliverFeedbackEmails(f.client, f.value.id)).pending === 1);
    assert(!f.state.accepted && f.state.error === "email_delivery_pending");
    assert(Date.parse(f.state.retryAt) > Date.now());
    assert(!f.updates.some((patch) => Boolean(patch.email_sent_at)));
  } finally {
    globalThis.fetch = saved;
  }
});
Deno.test("an uncertain acceptance reuses identical content and idempotency key on retry", async () => {
  const f = workerFixture(),
    saved = globalThis.fetch,
    requests: RequestInit[] = [];
  f.state.markFailure = true;
  globalThis.fetch = (_input, init) => {
    requests.push(init!);
    return Promise.resolve(new Response(JSON.stringify({ id: "stable-mail" })));
  };
  try {
    assert((await deliverFeedbackEmails(f.client, f.value.id)).pending === 1);
    f.state.markFailure = false;
    assert((await deliverFeedbackEmails(f.client, f.value.id)).accepted === 1);
    assert(requests[0]?.body === requests[1]?.body);
    assert(
      new Headers(requests[0]!.headers).get("Idempotency-Key") ===
        new Headers(requests[1]!.headers).get("Idempotency-Key"),
    );
    assert(feedbackEmailContent(f.value).subject.startsWith("[Subloom Idea]"));
  } finally {
    globalThis.fetch = saved;
  }
});
