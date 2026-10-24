import Stripe from "stripe";
import type { User } from "@supabase/supabase-js";
import { admin } from "../_shared/http.ts";
import {
  BILLING_API_VERSION,
  type BillingRow,
  hasAccess,
  ProBilling,
  signLicense,
  validPrice,
} from "../_shared/proBilling.ts";
import { verifiedEvent } from "../stripe-webhook/index.ts";

function assert(value: unknown, message = "Assertion failed") {
  if (!value) throw new Error(message);
}
async function rejects(work: () => Promise<unknown>, message: RegExp) {
  try {
    await work();
  } catch (e) {
    assert(e instanceof Error && message.test(e.message), String(e));
    return;
  }
  throw new Error("Expected rejection");
}
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const device = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const user = {
  id: owner,
  email: "billing@example.test",
  email_confirmed_at: new Date().toISOString(),
} as User;
Deno.env.set("STRIPE_PRICE_MONTHLY", "price_month");
Deno.env.set("STRIPE_PRICE_YEARLY", "price_year");
Deno.env.set("PRO_RETURN_URL", "https://app.example.test/pro");
function fixture() {
  const row: BillingRow & {
    lease_token: string | null;
    lease_until: string | null;
  } = {
    user_id: owner,
    customer_id: null,
    subscription_id: null,
    status: "none",
    interval: null,
    access_until: null,
    trial_end: null,
    cancel_at_period_end: false,
    trial_used: false,
    payment_blocked: false,
    verified_at: null,
    checkout_id: null,
    checkout_interval: null,
    checkout_key: null,
    lease_token: null,
    lease_until: null,
  };
  const histories = new Map<string, Record<string, unknown>>();
  const events = new Map<string, Record<string, unknown>>();
  const state = {
    subscriptions: [] as Stripe.Subscription[],
    sessions: [] as Stripe.Checkout.Session[],
    creations: [] as {
      params: Stripe.Checkout.SessionCreateParams;
      key: string;
    }[],
    canceled: false,
    removed: false,
    unavailable: false,
    failEvent: false,
    failSessionSave: false,
    cancellationUpdates: 0,
  };
  const db = {
    async rpc() {
      if (row.lease_token) return { data: null, error: null };
      row.lease_token = crypto.randomUUID(); // Replaced with the exact caller token below.
      return { data: { ...row }, error: null };
    },
    auth: {
      admin: { getUserById: async () => ({ data: { user }, error: null }) },
    },
    from(table: string) {
      const filters: [string, unknown][] = [];
      let mode = "select",
        patch: Record<string, unknown> = {};
      const execute = () => {
        const records: Record<string, unknown>[] = table === "pro_billing"
          ? [row]
          : [
            ...(table === "pro_trial_history" ? histories : events).values(),
          ];
        const record = records.find((r) =>
          filters.every(([key, value]) => r[key] === value)
        );
        if (mode === "update") {
          if (patch.checkout_id && state.failSessionSave) {
            state.failSessionSave = false;
            return { data: null, error: new Error("lost response") };
          }
          if (record) Object.assign(record, patch);
          return { data: record ? { ...record } : null, error: null };
        }
        if (mode === "insert" || mode === "upsert") {
          if (table === "pro_webhook_events" && state.failEvent) {
            return { data: null, error: new Error("database unavailable") };
          }
          (table === "pro_trial_history" ? histories : events).set(
            String(patch.email_hash ?? patch.id),
            patch,
          );
          return { data: patch, error: null };
        }
        return { data: record ? { ...record } : null, error: null };
      };
      const query = {
        select(_columns?: string) {
          return query;
        },
        eq(key: string, value: unknown) {
          filters.push([key, value]);
          return query;
        },
        gt(_key: string, _value: unknown) {
          return query;
        },
        update(value: Record<string, unknown>) {
          mode = "update";
          patch = value;
          return query;
        },
        insert(value: Record<string, unknown>) {
          mode = "insert";
          patch = value;
          return query;
        },
        upsert(value: Record<string, unknown>, _options?: unknown) {
          mode = "upsert";
          patch = value;
          return query;
        },
        async maybeSingle() {
          return execute();
        },
        then(
          resolve: (result: ReturnType<typeof execute>) => unknown,
          reject?: (error: unknown) => unknown,
        ) {
          return Promise.resolve(execute()).then(resolve, reject);
        },
      };
      return query;
    },
  };
  db.rpc = async function (_name?: string, args?: { token: string }) {
    if (row.lease_token) return { data: null, error: null };
    row.lease_token = args!.token;
    return { data: { ...row }, error: null };
  };
  const price = (interval: "month" | "year") =>
    ({
      id: "price_" + interval,
      active: true,
      currency: "eur",
      unit_amount: interval === "month" ? 299 : 2400,
      recurring: { interval, interval_count: 1 },
      type: "recurring",
      billing_scheme: "per_unit",
    }) as Stripe.Price;
  const stripe = {
    invoices: { retrieve: async () => ({ id: "in_latest", status: "paid" }) },
    customers: { create: async () => ({ id: "cus_local" }) },
    prices: {
      retrieve: async (id: string) =>
        price(id === "price_month" ? "month" : "year"),
    },
    subscriptions: {
      async list() {
        if (state.unavailable) throw new Error("processor unavailable");
        return { data: state.subscriptions, has_more: false };
      },
      async retrieve(id: string) {
        return state.subscriptions.find((s) => s.id === id)!;
      },
      async update(id: string, patch: Stripe.SubscriptionUpdateParams) {
        state.cancellationUpdates++;
        return Object.assign(
          state.subscriptions.find((s) => s.id === id)!,
          patch,
          { canceled_at: Math.floor(Date.now() / 1000) },
        );
      },
      async cancel(id: string) {
        state.canceled = true;
        state.subscriptions.find((s) => s.id === id)!.status = "canceled";
      },
    },
    checkout: {
      sessions: {
        async list() {
          return {
            data: state.sessions.filter((s) => s.status === "open"),
            has_more: false,
          };
        },
        async retrieve(id: string) {
          return state.sessions.find((s) => s.id === id)!;
        },
        async expire(id: string) {
          state.sessions.find((s) => s.id === id)!.status = "expired";
        },
        async create(
          params: Stripe.Checkout.SessionCreateParams,
          options: { idempotencyKey: string },
        ) {
          const prior = state.creations.find(
            (r) => r.key === options.idempotencyKey,
          );
          if (prior) {
            assert(
              JSON.stringify(prior.params) === JSON.stringify(params),
              "Idempotent retry changed parameters",
            );
            return state.sessions.find(
              (s) => s.id === "cs_" + state.creations.indexOf(prior),
            )!;
          }
          state.creations.push({ params, key: options.idempotencyKey });
          const session = {
            id: "cs_" + (state.creations.length - 1),
            status: "open",
            url: "https://checkout.stripe.com/c/test",
            metadata: params.metadata,
          } as Stripe.Checkout.Session;
          state.sessions.push(session);
          return session;
        },
      },
    },
    billingPortal: {
      sessions: {
        create: async () => ({ url: "https://billing.stripe.com/test" }),
      },
    },
    charges: {
      retrieve: async () => ({
        customer: "cus_local",
        refunded: true,
        payment_intent: "pi_latest",
      }),
    },
    invoicePayments: {
      list: async () => ({
        data: [{ payment: { payment_intent: "pi_latest" } }],
        has_more: false,
      }),
    },
  };
  const billing = new ProBilling(
    db as unknown as ReturnType<typeof admin>,
    stripe as unknown as Stripe,
  );
  function subscription(
    status: Stripe.Subscription.Status = "active",
    trial = false,
  ) {
    return {
      id: "sub_pro",
      customer: "cus_local",
      status,
      created: Math.floor(Date.now() / 1000),
      metadata: { subloom_user_id: owner },
      trial_start: trial ? Math.floor(Date.now() / 1000) : null,
      trial_end: trial ? Math.floor(Date.now() / 1000) + 3600 : null,
      cancel_at_period_end: false,
      latest_invoice: "in_latest",
      items: {
        data: [
          {
            price: price("month"),
            quantity: 1,
            current_period_end: Math.floor(Date.now() / 1000) + 3600,
          },
        ],
      },
    } as unknown as Stripe.Subscription;
  }
  return {
    row,
    state,
    histories,
    events,
    billing,
    stripe,
    subscription,
    price,
  };
}
Deno.test(
  "Checkout has fixed server prices, card-required 7-day trial and pending-session reuse",
  async () => {
    const f = fixture();
    await f.billing.checkout(user, "month");
    await f.billing.checkout(user, "month");
    assert(f.state.creations.length === 1);
    const request = f.state.creations[0]!.params;
    assert(
      request.mode === "subscription" &&
        request.payment_method_collection === "always",
    );
    assert(request.subscription_data?.trial_period_days === 7);
    assert(request.line_items?.[0]?.price === "price_month");
    assert(!("payment_method_types" in request) && !request.automatic_tax);
    await f.billing.checkout(user, "year");
    assert(
      f.state.creations.length === 2 &&
        f.state.sessions[0]?.status === "expired",
    );
    assert(
      f.state.creations[1]?.params.line_items?.[0]?.price === "price_year",
    );
    assert(!validPrice({ ...f.price("month"), unit_amount: 1 }, "month"));
  },
);
Deno.test(
  "lost Checkout save recovers the open session instead of making a second purchase",
  async () => {
    const f = fixture();
    f.state.failSessionSave = true;
    await rejects(() => f.billing.checkout(user, "month"), /saved/);
    await f.billing.checkout(user, "month");
    assert(f.state.creations.length === 1);
  },
);
Deno.test("sync returns the recognized subscription or explicit null for unavailable plans", async () => {
  const f = fixture();
  const sync = () => f.billing.locked(owner, (row, save) =>
    f.billing.sync(row, save, user.email)
  );
  assert(await sync() === null, "No customer must return null");
  f.row.customer_id = "cus_local";
  assert(await sync() === null, "An empty customer must return null");
  const subscription = f.subscription("trialing", true);
  f.state.subscriptions = [subscription];
  assert(await sync() === subscription, "Return the verified processor record");
  subscription.items.data[0]!.price.unit_amount = 1;
  assert(await sync() === null, "Unrecognized prices must not reach tracking or cancellation");
  assert(!hasAccess(f.row), "Unrecognized prices cannot retain Pro access");
});
Deno.test("period-end cancellation preserves trial/paid access, confirms dates and is idempotent", async () => {
  for (const trial of [false, true]) {
    const f = fixture();
    f.row.customer_id = "cus_local";
    f.state.subscriptions = [
      f.subscription(trial ? "trialing" : "active", trial),
    ];
    const first = await f.billing.cancel(user);
    const second = await f.billing.cancel(user);
    assert(
      first.canceled && first.endsAt === second.endsAt && Boolean(first.endsAt),
    );
    assert(f.state.cancellationUpdates === 1 && f.row.cancel_at_period_end);
    assert(
      hasAccess(f.row),
      "Keep access through the confirmed current period",
    );
    assert(
      !f.state.canceled,
      "Do not immediately delete a trial or paid period",
    );
  }
});
Deno.test("cancellation fails closed for missing/unrecognized plans and processor outages", async () => {
  const f = fixture();
  await rejects(() => f.billing.cancel(user), /no renewing/);
  f.row.customer_id = "cus_local";
  f.state.subscriptions = [f.subscription()];
  f.state.subscriptions[0]!.items.data[0]!.price.unit_amount = 1;
  await rejects(() => f.billing.cancel(user), /no renewing/);
  f.state.unavailable = true;
  await rejects(() => f.billing.cancel(user), /unavailable/);
  assert(f.state.cancellationUpdates === 0);
});
Deno.test("portal cancel_at dates are reflected in status without another cancellation mutation", async () => {
  const f = fixture();
  f.row.customer_id = "cus_local";
  const subscription = f.subscription("active");
  subscription.cancel_at_period_end = false;
  subscription.cancel_at = subscription.items.data[0]!.current_period_end;
  f.state.subscriptions = [subscription];
  const result = await f.billing.cancel(user);
  assert(result.canceled && f.row.cancel_at_period_end);
  assert(
    result.endsAt === new Date(subscription.cancel_at * 1000).toISOString(),
  );
  assert(f.state.cancellationUpdates === 0 && hasAccess(f.row));
});
Deno.test("tracking metadata uses confirmed processor dates, stable opaque IDs and configured original currency", async () => {
  const f = fixture();
  f.row.customer_id = "cus_local";
  f.state.subscriptions = [f.subscription("trialing", true)];
  const tracking = await f.billing.locked(owner, async (row, save) => {
    const subscription = await f.billing.sync(row, save, user.email);
    return await f.billing.tracking(row, subscription!);
  });
  if (!tracking) throw new Error("Expected confirmed tracking metadata");
  assert(
    tracking?.currency === "EUR" && tracking.amountMinor === 299 &&
      tracking.confirmed,
  );
  assert(
    tracking.trialEnd ===
      new Date(f.state.subscriptions[0]!.trial_end! * 1000).toISOString(),
  );
  assert(
    /^[0-9a-f-]{36}$/.test(tracking.id) && !tracking.id.includes("sub_pro"),
  );
  assert(
    (await f.billing.tracking(f.row, f.state.subscriptions[0]!))?.id ===
      tracking.id,
  );
  const changed = { ...f.state.subscriptions[0]!, id: "sub_new_purchase" };
  assert((await f.billing.tracking(f.row, changed))?.id !== tracking.id);
});
Deno.test(
  "existing subscriptions prevent double purchase, used trials never reset, archived prices retain access",
  async () => {
    const f = fixture();
    f.row.customer_id = "cus_local";
    f.state.subscriptions = [f.subscription("trialing", true)];
    await rejects(() => f.billing.checkout(user, "month"), /already/);
    assert(f.row.trial_used && f.histories.size === 1 && hasAccess(f.row));
    f.state.subscriptions[0]!.status = "canceled";
    await f.billing.checkout(user, "month");
    assert(
      f.state.creations[0]!.params.subscription_data?.trial_period_days ===
        undefined,
    );
    f.state.subscriptions = [f.subscription()];
    f.state.subscriptions[0]!.items.data[0]!.price.active = false;
    await f.billing.locked(owner, async (row, save) => {
      await f.billing.sync(row, save);
    });
    assert(hasAccess(f.row));
    for (
      const status of [
        "past_due",
        "unpaid",
        "paused",
        "incomplete",
        "canceled",
      ] as const
    ) {
      f.state.subscriptions[0]!.status = status;
      await f.billing.locked(owner, async (row, save) => {
        await f.billing.sync(row, save);
      });
      assert(!hasAccess(f.row), status + " must not grant Pro");
    }
  },
);
Deno.test(
  "out-of-order webhooks use canonical status, deduplicate only after success and block disputed access",
  async () => {
    const f = fixture();
    f.row.customer_id = "cus_local";
    f.state.subscriptions = [f.subscription("past_due")];
    const event = {
      id: "evt_paid_old",
      type: "invoice.paid",
      data: { object: { customer: "cus_local" } },
    } as Stripe.Event;
    f.state.failEvent = true;
    await rejects(() => f.billing.webhook(event), /completion/);
    assert(f.events.size === 0);
    f.state.failEvent = false;
    await f.billing.webhook(event);
    assert(!hasAccess(f.row) && f.events.size === 1);
    await f.billing.webhook(event);
    assert(f.events.size === 1);
    f.state.subscriptions = [f.subscription()];
    await f.billing.webhook({
      ...event,
      id: "evt_disputed",
      type: "charge.dispute.created",
      data: { object: { charge: "ch_latest" } },
    } as unknown as Stripe.Event);
    assert(f.row.payment_blocked && !hasAccess(f.row));
  },
);
Deno.test(
  "active subscriptions wait for a paid invoice when payment is asynchronous",
  async () => {
    const f = fixture();
    f.row.customer_id = "cus_local";
    f.state.subscriptions = [f.subscription()];
    f.stripe.invoices.retrieve = async () => ({
      id: "in_latest",
      status: "open",
    });
    await f.billing.locked(owner, async (row, save) => {
      await f.billing.sync(row, save);
    });
    assert(!hasAccess(f.row));
    f.stripe.invoices.retrieve = async () => ({
      id: "in_latest",
      status: "paid",
    });
    await f.billing.locked(owner, async (row, save) => {
      await f.billing.sync(row, save);
    });
    assert(hasAccess(f.row));
  },
);
Deno.test(
  "current full refund blocks access; partial refunds do not",
  async () => {
    const f = fixture();
    f.row.customer_id = "cus_local";
    f.state.subscriptions = [f.subscription()];
    await f.billing.webhook({
      id: "evt_refund",
      type: "charge.refunded",
      data: { object: { id: "ch_latest" } },
    } as unknown as Stripe.Event);
    assert(f.row.payment_blocked && !hasAccess(f.row));
    const partial = fixture();
    partial.row.customer_id = "cus_local";
    partial.state.subscriptions = [partial.subscription()];
    partial.stripe.charges.retrieve = async () => ({
      customer: "cus_local",
      refunded: false,
      payment_intent: "pi_latest",
    });
    await partial.billing.webhook({
      id: "evt_partial",
      type: "charge.refunded",
      data: { object: { id: "ch_latest" } },
    } as unknown as Stripe.Event);
    assert(!partial.row.payment_blocked && hasAccess(partial.row));
  },
);
Deno.test(
  "account deletion cancels renewable billing and aborts deletion on processor failure",
  async () => {
    const f = fixture();
    f.row.customer_id = "cus_local";
    f.state.subscriptions = [f.subscription()];
    await f.billing.checkout(user, "month").catch(() => {});
    await f.billing.deleteBilling(owner, async () => {
      assert(f.row.lease_token && f.state.canceled);
      f.state.removed = true;
    });
    assert(f.state.removed && !hasAccess(f.row));
    const failed = fixture();
    failed.row.customer_id = "cus_local";
    failed.state.unavailable = true;
    await rejects(
      () =>
        failed.billing.deleteBilling(owner, async () => {
          failed.state.removed = true;
        }),
      /processor/,
    );
    assert(!failed.state.removed && !failed.row.lease_token);
    const free = fixture();
    await free.billing.deleteBilling(owner, async () => {
      free.state.removed = true;
    });
    assert(free.state.removed);
  },
);
Deno.test(
  "billing lease contention fails before starting another processor request",
  async () => {
    const f = fixture();
    f.row.lease_token = crypto.randomUUID();
    await rejects(() => f.billing.checkout(user, "month"), /updating/);
    assert(f.state.creations.length === 0);
  },
);
Deno.test(
  "offline licenses are real P-256 signatures, bounded by trial/period and 72 hours",
  async () => {
    const pair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    );
    Deno.env.set(
      "PRO_LICENSE_PRIVATE_JWK",
      JSON.stringify(await crypto.subtle.exportKey("jwk", pair.privateKey)),
    );
    const now = Date.now(),
      until = now + 3600_000;
    const license = await signLicense(owner, device, until, now);
    assert(JSON.parse(license.payload).exp === until);
    const signature = Uint8Array.from(
      license.signature.match(/../g)!,
      (v) => parseInt(v, 16),
    );
    assert(
      await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        pair.publicKey,
        signature,
        new TextEncoder().encode(license.payload),
      ),
    );
    const longer = await signLicense(owner, device, now + 7 * 86400_000, now);
    assert(JSON.parse(longer.payload).exp === now + 72 * 3600_000);
  },
);
Deno.test(
  "Stripe raw-body signatures reject tampered, missing and stale webhooks",
  async () => {
    const stripe = new Stripe("sk_test_unused", {
      apiVersion: BILLING_API_VERSION,
    });
    const secret = "whsec_test_only";
    Deno.env.set("STRIPE_WEBHOOK_SECRET", secret);
    const body = JSON.stringify({
      id: "evt_signed",
      type: "invoice.paid",
      data: { object: {} },
    });
    const header = await stripe.webhooks.generateTestHeaderStringAsync({
      payload: body,
      secret,
      cryptoProvider: Stripe.createSubtleCryptoProvider(),
    });
    const request = (payload: string, signature = header) =>
      new Request("https://test.invalid", {
        method: "POST",
        body: payload,
        headers: { "stripe-signature": signature },
      });
    assert((await verifiedEvent(request(body), stripe)).id === "evt_signed");
    await rejects(
      () => verifiedEvent(request(body + " "), stripe),
      /signature/,
    );
    await rejects(() => verifiedEvent(request(body, ""), stripe), /signature/);
    const stale = await stripe.webhooks.generateTestHeaderStringAsync({
      payload: body,
      secret,
      timestamp: Math.floor(Date.now() / 1000) - 600,
      cryptoProvider: Stripe.createSubtleCryptoProvider(),
    });
    await rejects(
      () => verifiedEvent(request(body, stale), stripe),
      /signature/,
    );
  },
);
