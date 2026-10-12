import { emailTemplate, emailText } from "../_shared/email.ts";
import { eventSchema, sendEmail } from "../_shared/delivery.ts";
import {
  receiptDetectedNotification,
  type SubscriptionEmailKind,
  subscriptionNotification,
  weeklyDigestNotification,
  welcomeNotification,
} from "../_shared/notification-emails.ts";
import { subscription } from "../../../tests/fixtures.ts";
import { dateLabel } from "../../../src/domain/renewal.ts";

function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
const kinds: SubscriptionEmailKind[] = [
  "subscription_added",
  "renewal_upcoming",
  "renewal_today",
  "payment_overdue",
  "trial_ending",
  "price_change",
  "cancellation",
];

Deno.test("all lifecycle templates satisfy the queue contract and include a subscription link", () => {
  const s = subscription({ name: "A".repeat(80) });
  for (const kind of kinds) {
    const message = eventSchema.parse(subscriptionNotification(kind, s));
    assert(message.email?.template === kind);
    assert(message.path === "/subscription/" + s.id);
    assert(message.email.action.length > 0);
  }
  eventSchema.parse(welcomeNotification());
  eventSchema.parse(receiptDetectedNotification("A".repeat(120), s.id));
  eventSchema.parse(weeklyDigestNotification(0, [], []));
});

Deno.test("renewal email uses the computed occurrence rather than the original recurrence anchor", () => {
  const message = subscriptionNotification("renewal_upcoming", subscription(), {
    eventDate: "2026-10-31",
    daysBefore: 3,
    highRenewal: true,
  });
  assert(
    message.email.details.find((d) => d.label === "Renewal date")?.value ===
      dateLabel("2026-10-31", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
  );
  assert(message.body.includes(dateLabel("2026-10-31")));
  assert(message.email.tone === "amber");
  const quarterly = subscriptionNotification(
    "subscription_added",
    subscription({ interval: "quarterly", intervalCount: 2 }),
  );
  assert(quarterly.email.details.some((d) => d.value === "Every 6 months"));
});

Deno.test("overdue and cancellation emails do not claim billing actions were verified", () => {
  const overdue = subscriptionNotification("payment_overdue", subscription());
  assert(overdue.email.note?.includes("cannot verify"));
  assert(overdue.body.includes("whether a payment is still outstanding"));
  const canceled = subscriptionNotification(
    "cancellation",
    subscription({ paidThrough: "2026-10-31" }),
  );
  assert(canceled.email.note?.includes("does not cancel billing"));
  assert(
    canceled.email.details.some((d) => d.label === "Tracked access until"),
  );
});

Deno.test("HTML escapes all structured fields while plain text keeps the same facts", () => {
  const message = subscriptionNotification(
    "price_change",
    subscription({ name: '<img src=x onerror="bad()">' }),
    { oldAmountMinor: 999 },
  );
  message.email.items = ["<script>bad()</script>"];
  message.email.note = "<b>Untrusted note</b>";
  const content = {
    title: message.title,
    body: message.body,
    preview: message.email.preview,
    action: message.email.action,
    url: "subloom://" + message.path,
    presentation: message.email,
  };
  const html = emailTemplate(content), text = emailText(content);
  assert(!html.includes("<img src=x"));
  assert(!html.includes("<script>"));
  assert(!html.includes("<b>Untrusted note</b>"));
  assert(html.includes("&lt;img"));
  assert(text.includes("Previous tracked amount:"));
  assert(text.includes(message.email.action));
});

Deno.test("weekly digest limits long lists and explains an empty week", () => {
  const full = weeklyDigestNotification(
    30,
    ["USD 25/month estimated"],
    Array.from({ length: 30 }, (_, i) => "Renewal " + i),
  );
  assert(full.email.items.length === 15);
  const empty = weeklyDigestNotification(0, [], []);
  assert(empty.email.note?.includes("No renewals"));
});

Deno.test("provider receives structured HTML and equivalent plain text, retaining digest unsubscribe", async () => {
  Deno.env.set("RESEND_API_KEY", "test-provider-key");
  Deno.env.set("EMAIL_FROM", "Subloom <onboarding@resend.dev>");
  Deno.env.set("SUPABASE_URL", "https://project.example.test");
  Deno.env.set(
    "EMAIL_PREFERENCES_SECRET",
    "test-only-signing-secret-32-bytes-long",
  );
  const originalFetch = globalThis.fetch;
  let payload:
    | { html: string; text: string; headers: Record<string, string> }
    | undefined;
  globalThis.fetch = async (_input, init) => {
    payload = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ id: "template-test-id" }));
  };
  try {
    await sendEmail(
      "delivered@resend.dev",
      "template-test",
      weeklyDigestNotification(1, ["USD 10.99/month estimated"], [
        "Spotify · Oct 12 · USD 10.99",
      ]),
      true,
      {
        userId: "11111111-1111-4111-8111-111111111111",
        issuedAt: "2026-10-11T00:00:00Z",
      },
    );
    assert(payload?.html.includes("Review my week"));
    assert(payload?.html.includes("Spotify"));
    assert(payload?.text.includes("Spotify"));
    assert(payload?.text.includes("Stop weekly digests:"));
    assert(
      payload?.headers["List-Unsubscribe-Post"] ===
        "List-Unsubscribe=One-Click",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
