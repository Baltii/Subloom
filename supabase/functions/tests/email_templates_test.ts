import {
  emailIllustrations,
  emailTemplate,
  emailText,
  verificationTemplate,
} from "../_shared/email.ts";
import { eventSchema, sendEmail } from "../_shared/delivery.ts";
import {
  receiptDetectedNotification,
  type SubscriptionEmailKind,
  subscriptionNotification,
  weeklyDigestNotification,
  welcomeNotification,
} from "../_shared/notification-emails.ts";
import { subscription } from "../../../tests/fixtures.ts";
import { weeklyDigest } from "../_shared/weekly-digest.ts";
import {
  appWebBase,
  notificationAppUrl,
  notificationPath,
  notificationWebUrl,
} from "../../../src/domain/appLinks.ts";
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
  "plan_ending",
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
  eventSchema.parse(weeklyDigestNotification(0, "$0.00 USD", []));
});

Deno.test("each notification renders its own illustration and verification uses sign-in artwork", () => {
  const messages = [
    ...kinds.map((kind) => subscriptionNotification(kind, subscription())),
    welcomeNotification(),
    receiptDetectedNotification("Spotify", subscription().id),
    weeklyDigestNotification(0, "$0.00 USD", []),
  ];
  const illustrations = new Set<string>();
  for (const message of messages) {
    const html = emailTemplate({
      title: message.title,
      body: message.body,
      preview: message.email.preview,
      action: message.email.action,
      url: notificationWebUrl(message.path),
      presentation: message.email,
    });
    const illustration = html.match(/\/email\/(illustrations\/[^"\s]+\.png)/)
      ?.[1];
    assert(illustration, `Missing artwork for ${message.email.template}`);
    assert(
      !illustrations.has(illustration),
      `Reused artwork for ${message.email.template}`,
    );
    assert(
      illustration === emailIllustrations[message.email.template] + ".png",
    );
    assert(!html.includes("renewal-calendar.png"));
    illustrations.add(illustration);
  }
  assert(illustrations.size === 11);
  assert(verificationTemplate().includes("/email/illustrations/auth-otp.png"));
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

Deno.test("weekly digest keeps the complete week and explains an empty week", () => {
  const full = weeklyDigestNotification(
    30,
    "$25.00 USD",
    Array.from(
      { length: 30 },
      (_, i) => ({
        name: "Renewal " + i,
        date: "Oct 26",
        amount: "$1.00 USD",
        cycle: "month",
        kind: "renewal" as const,
        path: "/subscription/" + subscription().id,
      }),
    ),
  );
  assert(full.email.subscriptions?.length === 30);
  assert(full.email.details.length === 0);
  assert(full.email.weeklyTotal === "$25.00 USD");
  const empty = weeklyDigestNotification(0, "$0.00 USD", []);
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
      weeklyDigestNotification(1, "$10.99 USD", [{
        name: "Spotify",
        serviceId: "spotify",
        date: "Oct 12",
        amount: "$10.99 USD",
        cycle: "month",
        kind: "renewal",
        path: "/subscription/" + subscription().id,
      }]),
      true,
      {
        userId: "11111111-1111-4111-8111-111111111111",
        issuedAt: "2026-10-11T00:00:00Z",
      },
    );
    assert(payload?.html.includes("Review my week"));
    assert(payload?.html.includes("https://subloom.baltii.tn/open?path=%2F"));
    assert(!payload?.html.includes("subloom://"));
    assert(!payload?.html.includes("Monthly estimate"));
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

Deno.test("email links have a working HTTPS fallback even with legacy custom-scheme configuration", () => {
  const path = "/subscription/" + subscription().id;
  for (
    const base of [
      undefined,
      "subloom://",
      "javascript:bad()",
      "https://user:password@example.com",
    ]
  ) {
    assert(
      notificationWebUrl(path, base) ===
        "https://subloom.baltii.tn/open?path=" + encodeURIComponent(path),
    );
  }
  assert(
    appWebBase("https://preview.example.test/") ===
      "https://preview.example.test",
  );
  assert(
    notificationAppUrl(path) ===
      "subloom://open?path=" + encodeURIComponent(path),
  );
  for (
    const invalid of [
      "//evil.test",
      "/auth-callback",
      "/subscription/delete",
      "/settings?delete=true",
      ["/settings"],
    ]
  ) assert(notificationPath(invalid) === null);
});

Deno.test("weekly total covers only this week, converting and rounding each displayed amount", () => {
  const now = new Date("2026-10-25T23:30:00Z"); // Already Monday in Tunis.
  const s = subscription({ nextRenewal: "2026-10-26", anchorDay: 26 });
  const rows = [
    s,
    subscription({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      name: "Netflix",
      serviceId: "netflix",
      currency: "EUR",
      amountMinor: 1000,
      nextRenewal: "2026-10-28",
      anchorDay: 28,
    }),
    subscription({
      nextRenewal: "2026-11-02",
      anchorDay: 2,
      name: "Next week",
    }),
    subscription({ status: "paused", name: "Paused" }),
    subscription({
      status: "canceled",
      paidThrough: "2026-10-28",
      name: "Access ends",
    }),
  ];
  const rates = [
    {
      base_currency: "USD" as const,
      quote_currency: "EUR" as const,
      rate: "0.8",
      as_of: "2026-10-26",
      fetched_at: now.toISOString(),
      provider: "frankfurter" as const,
    },
    {
      base_currency: "USD" as const,
      quote_currency: "TND" as const,
      rate: "3.1",
      as_of: "2026-10-26",
      fetched_at: now.toISOString(),
      provider: "frankfurter" as const,
    },
  ];
  const message = weeklyDigest(
    rows,
    { timezone: "Africa/Tunis", currency: "TND" },
    rates,
    now,
  );
  assert(message.email.subscriptions?.length === 2);
  assert(message.email.subscriptions[0]?.amount === "TND\u00a034.069");
  assert(message.email.subscriptions[1]?.amount === "TND\u00a038.750");
  assert(message.email.weeklyTotal === "TND\u00a072.819");
  assert(message.email.period === "Oct 26 – Nov 1");
  const html = emailTemplate({
    title: message.title,
    body: message.body,
    preview: message.email.preview,
    action: message.email.action,
    url: notificationWebUrl("/"),
    presentation: message.email,
  });
  assert(html.includes("services/spotify.png"));
  assert(html.includes("services/netflix.png"));
  assert(!html.includes("Next week"));
  assert(!html.includes("Monthly estimate"));
  let missingRateFailed = false;
  try {
    weeklyDigest(rows, { timezone: "Africa/Tunis", currency: "TND" }, [], now);
  } catch {
    missingRateFailed = true;
  }
  assert(
    missingRateFailed,
    "Missing rates must defer delivery instead of sending a partial estimate",
  );
});

Deno.test("weekly digest includes repeated custom charges and trial endings, with zero for empty weeks", () => {
  const now = new Date("2026-10-26T10:00:00Z");
  const daily = subscription({
    interval: "custom",
    intervalCount: 2,
    customUnit: "day",
    nextRenewal: "2026-10-26",
    amountMinor: 100,
  });
  const trial = subscription({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    status: "trial",
    trialEnd: "2026-10-29",
    nextRenewal: "2026-10-29",
    anchorDay: 29,
    amountMinor: 500,
  });
  const message = weeklyDigest(
    [daily, trial],
    { timezone: "UTC", currency: "USD" },
    [],
    now,
  );
  assert(message.email.subscriptions?.length === 5);
  assert(
    message.email.subscriptions.filter((item) => item.kind === "trial")
      .length === 1,
  );
  assert(message.email.weeklyTotal === "$9.00 USD");
  const empty = weeklyDigest([], { timezone: "UTC", currency: "EUR" }, [], now);
  assert(empty.email.weeklyTotal === "€0.00 EUR");
  assert(empty.email.note?.includes("No renewals"));
});
