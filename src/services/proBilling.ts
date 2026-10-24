import { createClient, type Session } from "@supabase/supabase-js";
import { z } from "zod";
import { AppState, Platform } from "react-native";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import { authStorage, supabase } from "./supabase";
import { macosBridge } from "./macosBridge";
import { windowsBridge } from "./windowsBridge";
import { emptyPro, usePro } from "../store/pro";
import { licenseSchema, verifyProLicense } from "../domain/pro";
import { proTrackingSchema } from "../domain/proTracking";
import { reconcileProSubscription, useApp } from "../store/app";
import { syncNow } from "./sync";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
// This session never reaches the app's auth listener or its account sync path.
export const billingAuth =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: authStorage,
          storageKey: "subloom.pro.billing.auth",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: "pkce",
        },
      })
    : null;
export const stripeCheckoutAllowed =
  Platform.OS === "web" ||
  process.env.EXPO_PUBLIC_ALLOW_NATIVE_STRIPE_CHECKOUT === "true";
const publicKey = process.env.EXPO_PUBLIC_PRO_LICENSE_PUBLIC_KEY || "";
const statusSchema = z.object({
  configured: z.boolean(),
  verificationKey: z.string().nullable(),
  pro: z.boolean(),
  status: z.string(),
  interval: z.enum(["month", "year"]).nullable(),
  accessUntil: z.string().nullable(),
  trialEnd: z.string().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  trialEligible: z.boolean(),
  canManage: z.boolean(),
  license: licenseSchema.nullable(),
  tracking: proTrackingSchema.nullable().optional(),
});
const cacheSchema = z.object({
  license: licenseSchema,
  lastSeen: z.number().nonnegative(),
});
let generation = 0;
let activeWorkspace: string | null = null;
let lastRefresh = 0;
const pendingKey = (workspace: string, owner: string) =>
  `subloom.pro.pending.${workspace}.${owner}`;
class BillingRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
let devicePromise: Promise<string> | null = null;
function deviceId() {
  return (devicePromise ??= (async () => {
    const stored = await authStorage.getItem("subloom.pro.device");
    if (stored && z.string().uuid().safeParse(stored).success) return stored;
    const device = Crypto.randomUUID();
    await authStorage.setItem("subloom.pro.device", device);
    return device;
  })());
}
function cacheKey(workspace: string, owner: string) {
  return "subloom.pro.license." + workspace + "." + owner;
}
async function billingSession(workspace: string): Promise<Session | null> {
  const client = workspace === "guest" ? billingAuth : supabase;
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error("Verify your billing email again to restore Pro.");
  if (workspace !== "guest" && data.session?.user.id !== workspace)
    throw new Error("Your workspace changed. Reopen Subloom Pro.");
  return data.session;
}
async function request(session: Session, body: object) {
  if (!url || !key) throw new Error("Pro purchases are not available yet.");
  const response = await fetch(url + "/functions/v1/pro-billing", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + session.access_token,
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ error: z.string().max(300) }).safeParse(result);
    throw new BillingRequestError(
      error.success
        ? error.data.error
        : "Billing could not be checked. Please try again.",
      response.status,
    );
  }
  return result;
}
let refreshTask: {
  workspace: string;
  revision: number;
  promise: Promise<void>;
} | null = null;
let mutationInProgress = false;
export function refreshPro(workspace = activeWorkspace): Promise<void> {
  if (!workspace || workspace !== activeWorkspace || mutationInProgress)
    return Promise.resolve();
  if (
    refreshTask?.workspace === workspace &&
    refreshTask.revision === generation
  )
    return refreshTask.promise;
  const revision = ++generation;
  const task = { workspace, revision, promise: Promise.resolve() };
  refreshTask = task;
  task.promise = performRefresh(workspace, revision).finally(() => {
    if (refreshTask === task) refreshTask = null;
  });
  return task.promise;
}
async function performRefresh(workspace: string, revision: number) {
  const current = () =>
    generation === revision && activeWorkspace === workspace;
  // Auth changes revoke old access immediately; same-owner refreshes retain it.
  if (usePro.getState().workspace !== workspace)
    usePro.setState({ ...emptyPro, workspace, loading: true });
  else usePro.setState({ loading: true, error: null });
  lastRefresh = Date.now();
  let session: Session | null = null;
  let device = "";
  let cachedUntil = 0;
  try {
    session = await billingSession(workspace);
    if (!current()) return;
    if (!session) {
      usePro.setState({ ...emptyPro, workspace, ready: true });
      return;
    }
    if (usePro.getState().owner !== session.user.id)
      usePro.setState({ ...emptyPro, workspace, loading: true });
    usePro.setState({
      owner: session.user.id,
      email: session.user.email ?? null,
    });
    device = await deviceId();
    const raw = await authStorage.getItem(cacheKey(workspace, session.user.id));
    let cached: unknown = null;
    try {
      cached = raw ? JSON.parse(raw) : null;
    } catch {
      /* Corrupt cache must not prevent online recovery. */
    }
    const parsed = cacheSchema.safeParse(cached);
    if (parsed.success) {
      const claims = verifyProLicense(
        parsed.data.license,
        publicKey,
        session.user.id,
        device,
        Date.now(),
        parsed.data.lastSeen,
      );
      if (claims) {
        cachedUntil = claims.exp;
        await authStorage.setItem(
          cacheKey(workspace, session.user.id),
          JSON.stringify({ ...parsed.data, lastSeen: Date.now() }),
        );
      }
    }
    if (!current()) return;
    usePro.setState({ ready: true, offlineUntil: cachedUntil });
    const result = statusSchema.parse(
      await request(session, { action: "status", device }),
    );
    if (!current()) return;
    const claims = result.pro
      ? verifyProLicense(result.license, publicKey, session.user.id, device)
      : null;
    // An online denial replaces any cached grant immediately.
    if (claims && result.license)
      await authStorage.setItem(
        cacheKey(workspace, session.user.id),
        JSON.stringify({ license: result.license, lastSeen: Date.now() }),
      );
    else await authStorage.removeItem(cacheKey(workspace, session.user.id));
    if (!current()) return;
    usePro.setState({
      ready: true,
      loading: false,
      snapshot: {
        ...result,
        configured:
          result.configured &&
          Boolean(publicKey) &&
          result.verificationKey === publicKey.toLowerCase(),
      },
      offlineUntil: claims?.exp ?? 0,
      error:
        result.configured &&
        (!publicKey || result.verificationKey !== publicKey.toLowerCase())
          ? "This app’s Pro verification key needs updating before it can activate a purchase."
          : null,
    });
    if (result.tracking && current()) {
      const marker = `subloom.pro.tracked.${workspace}.${session.user.id}.${result.tracking.id}`;
      try {
        const seen = Boolean(await authStorage.getItem(marker));
        if (!current()) return;
        if (workspace !== "guest") await syncNow();
        if (!current()) return;
        await reconcileProSubscription(
          result.tracking,
          session.user.id,
          workspace,
          current,
          seen,
        );
        if (
          current() &&
          useApp
            .getState()
            .data.subscriptions.some((s) => s.id === result.tracking!.id)
        )
          await authStorage.setItem(marker, "1");
      } catch {
        // Billing access remains valid if device storage fails. Retry on the next refresh.
        if (current())
          usePro.setState({
            error:
              "Your billing status is current, but its tracking entry could not be saved. Check your connection and device storage, then reopen Subloom.",
          });
      }
    }
    if (result.pro && current())
      await authStorage
        .removeItem(pendingKey(workspace, session.user.id))
        .catch(() => {});
  } catch (error) {
    if (
      error instanceof BillingRequestError &&
      [401, 403].includes(error.status) &&
      session
    ) {
      cachedUntil = 0;
      await authStorage.removeItem(cacheKey(workspace, session.user.id));
    }
    if (current())
      usePro.setState({
        ready: true,
        loading: false,
        offlineUntil: cachedUntil,
        error:
          error instanceof Error
            ? error.message
            : "Billing could not be checked. Connect and try again.",
      });
  }
}
export function maintainPro(workspace: string) {
  activeWorkspace = workspace;
  generation++;
  usePro.setState({ ...emptyPro, workspace });
  void refreshPro(workspace);
  const client = workspace === "guest" ? billingAuth : supabase;
  const listener = client?.auth.onAuthStateChange((_event, session) => {
    // No session/storage work inside the auth lock. Revoke stale access immediately.
    generation++;
    if (!session || session.user.id !== usePro.getState().owner)
      usePro.setState({ ...emptyPro, workspace });
    setTimeout(() => {
      if (activeWorkspace === workspace) void refreshPro(workspace);
    }, 0);
  });
  const app = AppState.addEventListener("change", (state) => {
    if (state === "active") {
      billingAuth?.auth.startAutoRefresh();
      void refreshPro(workspace);
    } else if (Platform.OS !== "web") billingAuth?.auth.stopAutoRefresh();
  });
  const focus = () => {
    if (!usePro.getState().loading) void refreshPro(workspace);
  };
  let expires: ReturnType<typeof setTimeout> | undefined;
  let scheduledUntil = 0;
  const expiration = usePro.subscribe((state) => {
    if (scheduledUntil === state.offlineUntil) return;
    scheduledUntil = state.offlineUntil;
    clearTimeout(expires);
    if (!scheduledUntil) return;
    const until = scheduledUntil,
      owner = state.owner;
    expires = setTimeout(
      () => {
        const current = usePro.getState();
        if (
          activeWorkspace === workspace &&
          current.owner === owner &&
          current.offlineUntil === until
        )
          usePro.setState({ offlineUntil: 0 });
      },
      Math.max(0, until - Date.now()) + 1,
    );
  });
  if (Platform.OS === "web") globalThis.addEventListener("focus", focus);
  // Expired licenses fail closed in action guards even while this timer is suspended.
  const timer = setInterval(() => {
    if (usePro.getState().offlineUntil <= Date.now())
      usePro.setState({ offlineUntil: 0 });
    const state = usePro.getState();
    if (!state.owner || state.loading || mutationInProgress) return;
    void authStorage
      .getItem(pendingKey(workspace, state.owner))
      .then((raw) => {
        if (
          activeWorkspace !== workspace ||
          usePro.getState().owner !== state.owner ||
          usePro.getState().loading
        )
          return;
        const pending = Number(raw) > Date.now();
        if (Date.now() - lastRefresh >= (pending ? 10_000 : 5 * 60_000))
          void refreshPro(workspace);
      })
      .catch(() => {});
  }, 10000);
  return () => {
    activeWorkspace = null;
    generation++;
    usePro.setState({ ...emptyPro });
    listener?.data.subscription.unsubscribe();
    app.remove();
    clearInterval(timer);
    expiration();
    clearTimeout(expires);
    if (Platform.OS === "web") globalThis.removeEventListener("focus", focus);
  };
}
export async function sendBillingCode(email: string) {
  if (!billingAuth)
    throw new Error("Billing email verification is not available yet.");
  const parsed = z.string().trim().email().max(254).safeParse(email);
  if (!parsed.success) throw new Error("Enter a valid billing email address.");
  const { error } = await billingAuth.auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: true },
  });
  if (error)
    throw new Error(
      "Could not send your verification code. Wait a moment and try again.",
    );
}
export async function verifyBillingCode(email: string, token: string) {
  if (!billingAuth) throw new Error("Billing is not configured.");
  if (activeWorkspace !== "guest")
    throw new Error("Use your signed-in account's billing identity.");
  const { error } = await billingAuth.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: "email",
  });
  if (error)
    throw new Error("The code is invalid or expired. Request another code.");
  await refreshPro("guest");
}
export async function disconnectBilling() {
  if (activeWorkspace !== "guest")
    throw new Error("Sign out of your account to change its billing identity.");
  const owner = usePro.getState().owner;
  // Invalidate access before sign-out, including failed network sign-outs.
  generation++;
  usePro.setState({ ...emptyPro, workspace: "guest", ready: true });
  if (owner) await authStorage.removeItem(cacheKey("guest", owner));
  const { error } = await billingAuth!.auth.signOut({ scope: "local" });
  if (error) throw new Error("Could not disconnect billing. Try again.");
}
export async function openProBilling(
  action: "checkout" | "portal",
  interval: "month" | "year" = "month",
) {
  const workspace = activeWorkspace;
  if (!workspace || !stripeCheckoutAllowed)
    throw new Error(
      "Purchases and billing management are not available in this build.",
    );
  if (action === "checkout" && !usePro.getState().snapshot?.configured)
    throw new Error("Pro purchases are not configured for this build yet.");
  const session = await billingSession(workspace);
  if (!session) throw new Error("Verify your billing email first.");
  const result = z
    .object({ url: z.string().url() })
    .parse(
      await exclusiveRequest(
        session,
        action === "checkout" ? { action, interval } : { action },
      ),
    );
  if (
    activeWorkspace !== workspace ||
    usePro.getState().owner !== session.user.id
  )
    throw new Error("Your billing identity changed. Please try again.");
  const target = new URL(result.url);
  if (
    target.protocol !== "https:" ||
    target.username ||
    target.password ||
    !["checkout.stripe.com", "billing.stripe.com"].includes(target.hostname)
  )
    throw new Error("The payment address could not be verified.");
  if (action === "checkout")
    await authStorage.setItem(
      pendingKey(workspace, session.user.id),
      String(Date.now() + 2 * 60_000),
    );
  // Standard browsers block new tabs opened after the asynchronous Checkout
  // request. Navigate the current tab; desktop shells route external links to
  // the system browser and native builds use their OS URL handler.
  if (Platform.OS === "web" && !macosBridge() && !windowsBridge())
    globalThis.location.assign(target.href);
  else await Linking.openURL(target.href);
}

export async function cancelProSubscription() {
  const workspace = activeWorkspace;
  if (!workspace || !stripeCheckoutAllowed)
    throw new Error("Billing cancellation is not available in this build.");
  const session = await billingSession(workspace);
  if (!session) throw new Error("Verify your billing email first.");
  const result = z
    .object({
      canceled: z.literal(true),
      endsAt: z.string().datetime().nullable(),
    })
    .parse(await exclusiveRequest(session, { action: "cancel" }));
  if (
    activeWorkspace !== workspace ||
    usePro.getState().owner !== session.user.id
  )
    throw new Error("Your billing identity changed. Reopen Subloom Pro.");
  await refreshPro(workspace);
  return result;
}

async function exclusiveRequest(session: Session, body: object) {
  if (mutationInProgress)
    throw new Error("Billing is updating. Please wait a moment.");
  mutationInProgress = true;
  const workspace = activeWorkspace;
  try {
    await refreshTask?.promise;
    if (
      activeWorkspace !== workspace ||
      usePro.getState().owner !== session.user.id
    )
      throw new Error("Your billing identity changed. Reopen Subloom Pro.");
    return await request(session, body);
  } finally {
    mutationInProgress = false;
  }
}
