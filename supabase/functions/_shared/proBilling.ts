import Stripe from "stripe";
import type { User } from "@supabase/supabase-js";
import { admin, env, HttpError, sha256 } from "./http.ts";

export const BILLING_API_VERSION = "2026-09-30.endive";
export type PlanInterval = "month" | "year";
export type BillingRow = {
  user_id: string;
  customer_id: string | null;
  subscription_id: string | null;
  status: string;
  interval: PlanInterval | null;
  access_until: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  trial_used: boolean;
  payment_blocked: boolean;
  verified_at: string | null;
  checkout_id: string | null;
  checkout_interval: PlanInterval | null;
  checkout_key: string | null;
};
export function billingConfigured() {
  return [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_MONTHLY",
    "STRIPE_PRICE_YEARLY",
    "PRO_RETURN_URL",
    "PRO_LICENSE_PRIVATE_JWK",
  ].every((name) => Boolean(Deno.env.get(name)));
}
export function licenseVerificationKey() {
  const jwk = JSON.parse(env("PRO_LICENSE_PRIVATE_JWK")) as JsonWebKey;
  if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.x || !jwk.y || !jwk.d)
    throw new HttpError(503, "Pro verification is not configured correctly.");
  const hex = (value: string) =>
    Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (byte) =>
      byte.charCodeAt(0).toString(16).padStart(2, "0"),
    ).join("");
  const key = "04" + hex(jwk.x) + hex(jwk.y);
  if (!/^04[a-f0-9]{128}$/.test(key))
    throw new HttpError(503, "Pro verification is not configured correctly.");
  return key;
}
export function stripeClient() {
  return new Stripe(env("STRIPE_SECRET_KEY"), {
    apiVersion: BILLING_API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 1,
    timeout: 15000,
  });
}
function priceId(interval: PlanInterval) {
  return env(
    interval === "month" ? "STRIPE_PRICE_MONTHLY" : "STRIPE_PRICE_YEARLY",
  );
}
export function validPrice(
  price: Stripe.Price,
  interval: PlanInterval,
  requireActive = true,
) {
  return (
    (!requireActive || price.active) &&
    price.currency === "eur" &&
    price.unit_amount === (interval === "month" ? 299 : 2400) &&
    price.recurring?.interval === interval &&
    price.recurring.interval_count === 1 &&
    price.type === "recurring" &&
    !price.transform_quantity &&
    price.billing_scheme === "per_unit"
  );
}
export function returnUrl() {
  const url = new URL(env("PRO_RETURN_URL"));
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.endsWith("/pro")
  )
    throw new HttpError(
      503,
      "Billing return address is not configured correctly.",
    );
  return url.href;
}
const date = (seconds: number | null | undefined) =>
  seconds ? new Date(seconds * 1000).toISOString() : null;
const idOf = (value: string | { id: string } | null) =>
  typeof value === "string" ? value : value?.id;
export function hasAccess(row: BillingRow, now = Date.now()) {
  return (
    !row.payment_blocked &&
    ["active", "trialing"].includes(row.status) &&
    Date.parse(row.access_until || "") > now
  );
}

// Injectable processor/database clients keep lifecycle and retry tests independent of live keys.
export class ProBilling {
  constructor(
    readonly db: ReturnType<typeof admin>,
    private processor?: Stripe,
  ) {}
  get stripe() {
    return (this.processor ??= stripeClient());
  }

  async locked<T>(
    owner: string,
    work: (
      row: BillingRow,
      save: (patch: Partial<BillingRow>) => Promise<void>,
    ) => Promise<T>,
  ) {
    const token = crypto.randomUUID();
    const { data, error } = await this.db.rpc("claim_pro_billing", {
      owner,
      token,
    });
    if (error || !data)
      throw new HttpError(
        409,
        "Billing is updating. Please try again shortly.",
      );
    const row = data as BillingRow;
    const save = async (patch: Partial<BillingRow>) => {
      const result = await this.db
        .from("pro_billing")
        .update(patch)
        .eq("user_id", owner)
        .eq("lease_token", token)
        .gt("lease_until", new Date().toISOString())
        .select("user_id")
        .maybeSingle();
      if (result.error || !result.data)
        throw new HttpError(
          503,
          "Billing could not be saved. Please try again.",
        );
      Object.assign(row, patch);
    };
    try {
      return await work(row, save);
    } finally {
      await this.db
        .from("pro_billing")
        .update({ lease_token: null, lease_until: null })
        .eq("user_id", owner)
        .eq("lease_token", token);
    }
  }

  async sync(
    row: BillingRow,
    save: (patch: Partial<BillingRow>) => Promise<void>,
    email?: string,
  ) {
    if (!row.customer_id) return;
    const list = await this.stripe.subscriptions.list({
      customer: row.customer_id,
      status: "all",
      limit: 100,
    });
    if (list.has_more)
      throw new HttpError(503, "Billing needs a support review.");
    const subscriptions = list.data.filter(
      (s) => s.metadata.subloom_user_id === row.user_id,
    );
    const current = subscriptions.filter(
      (s) => !["canceled", "incomplete_expired"].includes(s.status),
    );
    if (current.length > 1)
      throw new HttpError(503, "Multiple subscriptions need a support review.");
    const subscription =
      current[0] ?? subscriptions.sort((a, b) => b.created - a.created)[0];
    const item = subscription?.items.data[0];
    const interval =
      item?.price.id === priceId("month")
        ? "month"
        : item?.price.id === priceId("year")
          ? "year"
          : null;
    const recognized = Boolean(
      subscription &&
      subscription.items.data.length === 1 &&
      item?.quantity === 1 &&
      interval &&
      validPrice(item.price, interval, false),
    );
    // An active subscription can still have an asynchronous/unpaid invoice.
    // Trial access is explicit; paid-period access requires its invoice paid.
    const invoice =
      subscription?.status === "active" && subscription.latest_invoice
        ? typeof subscription.latest_invoice === "string"
          ? await this.stripe.invoices.retrieve(subscription.latest_invoice)
          : subscription.latest_invoice
        : null;
    const fulfilled =
      subscription?.status === "trialing" ||
      (subscription?.status === "active" && invoice?.status === "paid");
    const used =
      row.trial_used || subscriptions.some((s) => Boolean(s.trial_start));
    await save({
      subscription_id: subscription?.id ?? null,
      status: subscription?.status ?? "none",
      interval,
      access_until:
        recognized && fulfilled
          ? date(
              subscription?.status === "trialing"
                ? subscription.trial_end
                : item?.current_period_end,
            )
          : null,
      trial_end: date(subscription?.trial_end),
      cancel_at_period_end: subscription?.cancel_at_period_end ?? false,
      trial_used: used,
      verified_at: new Date().toISOString(),
    });
    if (used && email) {
      const result = await this.db
        .from("pro_trial_history")
        .upsert(
          { email_hash: await sha256(email.toLowerCase()) },
          { onConflict: "email_hash", ignoreDuplicates: true },
        );
      if (result.error)
        throw new HttpError(503, "Trial history could not be verified.");
    }
  }

  async snapshot(row: BillingRow, email: string, device: string) {
    const history = await this.db
      .from("pro_trial_history")
      .select("email_hash")
      .eq("email_hash", await sha256(email.toLowerCase()))
      .maybeSingle();
    if (history.error)
      throw new HttpError(503, "Trial availability could not be verified.");
    const pro = hasAccess(row);
    return {
      configured: billingConfigured(),
      verificationKey: licenseVerificationKey(),
      pro,
      status: row.payment_blocked ? "review" : row.status,
      interval: row.interval,
      accessUntil: row.access_until,
      trialEnd: row.trial_end,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      trialEligible: !row.trial_used && !history.data,
      canManage: Boolean(row.customer_id),
      license: pro
        ? await signLicense(row.user_id, device, Date.parse(row.access_until!))
        : null,
    };
  }

  async checkout(user: User, interval: PlanInterval) {
    return this.locked(user.id, async (row, save) => {
      if (row.payment_blocked)
        throw new HttpError(
          403,
          "This billing identity needs a support review before purchasing again.",
        );
      const price = await this.stripe.prices.retrieve(priceId(interval));
      if (!validPrice(price, interval))
        throw new HttpError(
          503,
          "The selected Pro price is not configured correctly.",
        );
      if (!row.customer_id) {
        const customer = await this.stripe.customers.create(
          { email: user.email!, metadata: { subloom_user_id: user.id } },
          { idempotencyKey: "subloom-customer:" + user.id },
        );
        await save({ customer_id: customer.id });
      }
      await this.sync(row, save, user.email);
      if (
        row.subscription_id &&
        !["canceled", "incomplete_expired"].includes(row.status)
      )
        throw new HttpError(
          409,
          "You already have a subscription. Use Manage billing to review it.",
        );
      if (row.subscription_id) await save({ checkout_key: null });
      const sessions = await this.stripe.checkout.sessions.list({
        customer: row.customer_id!,
        status: "open",
        limit: 100,
      });
      if (sessions.has_more)
        throw new HttpError(503, "Checkout needs a support review.");
      for (const session of sessions.data.filter(
        (s) => s.metadata?.subloom_user_id === user.id,
      )) {
        if (session.metadata?.interval === interval && session.url)
          return { url: session.url };
        // If completion races expiration, stop here and let a canonical refresh resolve it.
        await this.stripe.checkout.sessions.expire(session.id);
      }
      if (row.checkout_id) {
        const previous = await this.stripe.checkout.sessions.retrieve(
          row.checkout_id,
        );
        if (previous.status === "complete" && !row.subscription_id) {
          await this.sync(row, save, user.email);
          throw new HttpError(
            409,
            "Checkout completed. Check your Pro status before starting again.",
          );
        }
        await save({
          checkout_id: null,
          checkout_key: null,
          checkout_interval: null,
        });
      }
      if (row.checkout_key && row.checkout_interval !== interval)
        throw new HttpError(
          409,
          "Retry your previous plan first to recover the pending checkout.",
        );
      if (!row.checkout_key)
        await save({
          checkout_key: crypto.randomUUID(),
          checkout_interval: interval,
        });
      const history = await this.db
        .from("pro_trial_history")
        .select("email_hash")
        .eq("email_hash", await sha256(user.email!.toLowerCase()))
        .maybeSingle();
      if (history.error)
        throw new HttpError(503, "Trial availability could not be verified.");
      const eligible = !row.trial_used && !history.data;
      const session = await this.stripe.checkout.sessions.create(
        {
          mode: "subscription",
          customer: row.customer_id!,
          client_reference_id: user.id,
          line_items: [{ price: priceId(interval), quantity: 1 }],
          payment_method_collection: "always",
          success_url: returnUrl() + "?checkout=returned",
          cancel_url: returnUrl() + "?checkout=canceled",
          metadata: { subloom_user_id: user.id, interval },
          subscription_data: {
            metadata: { subloom_user_id: user.id },
            ...(eligible
              ? {
                  trial_period_days: 7,
                  trial_settings: {
                    end_behavior: { missing_payment_method: "cancel" as const },
                  },
                }
              : {}),
          },
          integration_identifier:
            "subloom-pro-" +
            row
              .checkout_key!.replace(/-/g, "")
              .slice(0, 8)
              .split("")
              .map((v) => String.fromCharCode(97 + Number.parseInt(v, 16)))
              .join(""),
        },
        { idempotencyKey: "subloom-checkout:" + row.checkout_key },
      );
      await save({ checkout_id: session.id });
      if (session.status !== "open" || !session.url)
        throw new HttpError(
          409,
          "Checkout is no longer open. Check your Pro status and try again.",
        );
      return { url: session.url };
    });
  }

  async portal(owner: string) {
    return this.locked(owner, async (row) => {
      if (!row.customer_id)
        throw new HttpError(409, "No billing subscription to manage yet.");
      const portal = await this.stripe.billingPortal.sessions.create({
        customer: row.customer_id,
        return_url: returnUrl(),
      });
      return { url: portal.url };
    });
  }

  async deleteBilling(owner: string, removeUser: () => Promise<void>) {
    await this.locked(owner, async (row, save) => {
      if (row.customer_id) {
        const open = await this.stripe.checkout.sessions.list({
          customer: row.customer_id,
          status: "open",
          limit: 100,
        });
        if (open.has_more)
          throw new HttpError(503, "Billing needs review before deletion.");
        for (const session of open.data)
          await this.stripe.checkout.sessions.expire(session.id);
        await this.sync(row, save);
        if (
          row.subscription_id &&
          !["canceled", "incomplete_expired"].includes(row.status)
        )
          await this.stripe.subscriptions.cancel(row.subscription_id);
        await this.sync(row, save);
        if (
          hasAccess(row) ||
          (row.subscription_id &&
            !["canceled", "incomplete_expired"].includes(row.status))
        )
          throw new HttpError(
            503,
            "Cancel billing before deleting this account.",
          );
      }
      // Keep processor invoices for legal records; delete while holding the
      // billing lease so a concurrent request cannot start a new checkout.
      await removeUser();
    });
  }

  async webhook(event: Stripe.Event) {
    const handled = [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "customer.subscription.paused",
      "customer.subscription.resumed",
      "invoice.paid",
      "invoice.payment_failed",
      "charge.refunded",
      "charge.dispute.created",
      "radar.early_fraud_warning.created",
    ];
    if (!handled.includes(event.type)) return;
    const object = event.data.object as unknown as {
      customer?: string | { id: string };
      charge?: string;
      id: string;
    };
    let customer = idOf(object.customer ?? null);
    let charge: Stripe.Charge | undefined;
    if (
      event.type.startsWith("charge.") ||
      event.type === "radar.early_fraud_warning.created"
    ) {
      charge = await this.stripe.charges.retrieve(
        event.type === "charge.refunded" ? object.id : object.charge!,
      );
      customer = idOf(charge.customer);
    }
    if (!customer) return;
    const owner = await this.db
      .from("pro_billing")
      .select("user_id")
      .eq("customer_id", customer)
      .maybeSingle();
    if (owner.error) throw new HttpError(503, "Webhook owner lookup failed.");
    if (!owner.data) return; // Unrelated Stripe products and deleted billing identities.
    await this.locked(owner.data.user_id, async (row, save) => {
      const seen = await this.db
        .from("pro_webhook_events")
        .select("id")
        .eq("id", event.id)
        .maybeSingle();
      if (seen.error)
        throw new HttpError(503, "Webhook history lookup failed.");
      if (seen.data) return;
      const user = await this.db.auth.admin.getUserById(row.user_id);
      if (user.error || !user.data.user?.email)
        throw new HttpError(503, "Billing email lookup failed.");
      await this.sync(row, save, user.data.user.email);
      let block =
        event.type === "charge.dispute.created" ||
        event.type === "radar.early_fraud_warning.created";
      if (
        charge?.refunded &&
        event.type === "charge.refunded" &&
        row.subscription_id
      ) {
        const subscription = await this.stripe.subscriptions.retrieve(
          row.subscription_id,
        );
        const invoice = idOf(subscription.latest_invoice);
        if (invoice) {
          // Invoice payments are canonical in current Stripe API (Charge.invoice was removed).
          const payments = await this.stripe.invoicePayments.list({
            invoice,
            limit: 100,
          });
          block = payments.data.some(
            (p) =>
              idOf(p.payment.payment_intent ?? null) ===
              idOf(charge!.payment_intent),
          );
        }
      }
      if (block) await save({ payment_blocked: true, access_until: null });
      const saved = await this.db
        .from("pro_webhook_events")
        .insert({ id: event.id });
      if (saved.error)
        throw new HttpError(503, "Webhook completion could not be saved.");
    });
  }
}

export async function signLicense(
  owner: string,
  device: string,
  accessUntil: number,
  now = Date.now(),
) {
  const key = await crypto.subtle.importKey(
    "jwk",
    JSON.parse(env("PRO_LICENSE_PRIVATE_JWK")),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const payload = JSON.stringify({
    v: 1,
    owner,
    device,
    iat: now,
    exp: Math.min(accessUntil, now + 72 * 3600_000),
  });
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      new TextEncoder().encode(payload),
    ),
  );
  return {
    payload,
    signature: Array.from(signature, (b) =>
      b.toString(16).padStart(2, "0"),
    ).join(""),
  };
}
