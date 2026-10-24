import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import type { Session } from "@supabase/supabase-js";
import { emptyPro, usePro } from "../../src/store/pro";

const mock = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  failTrackingRead: false,
  session: null as Session | null,
  mainSession: null as Session | null,
  mainGetSession: vi.fn(),
  mainSetSession: vi.fn(),
  createClient: vi.fn(),
  verifyOtp: vi.fn(),
  signInWithOtp: vi.fn(),
  signOut: vi.fn(),
  authListener: null as (() => void) | null,
}));
vi.mock("react-native", () => ({
  Platform: { OS: "web" },
  AppState: { addEventListener: () => ({ remove() {} }) },
}));
vi.mock("expo-crypto", () => ({ randomUUID }));
vi.mock("expo-linking", () => ({ openURL: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mock.createClient }));
vi.mock("../../src/services/supabase", () => ({
  authStorage: {
    async getItem(key: string) {
      if (mock.failTrackingRead && key.startsWith("subloom.pro.tracked."))
        throw new Error("Storage unavailable");
      return mock.storage.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      mock.storage.set(key, value);
    },
    async removeItem(key: string) {
      mock.storage.delete(key);
    },
  },
  supabase: {
    auth: {
      getSession: mock.mainGetSession,
      setSession: mock.mainSetSession,
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe() {} } },
      }),
    },
  },
}));
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const account = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const publicJwk = keys.publicKey.export({ format: "jwk" });
const publicHex =
  "04" +
  Buffer.from(publicJwk.x!, "base64url").toString("hex") +
  Buffer.from(publicJwk.y!, "base64url").toString("hex");
let billing: typeof import("../../src/services/proBilling");
let billingClientArguments: unknown[];
let cleanup: (() => void) | undefined;
const listeners = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
function session(id: string): Session {
  return {
    user: { id, email: "billing@example.test" },
    access_token: "verified-token-" + id,
  } as Session;
}
function snapshot(device: string, user = owner, paid = true) {
  const now = Date.now();
  const payload = JSON.stringify({
    v: 1,
    owner: user,
    device,
    iat: now,
    exp: now + 3600_000,
  });
  const license = {
    payload,
    signature: sign("sha256", Buffer.from(payload), {
      key: keys.privateKey,
      dsaEncoding: "ieee-p1363",
    }).toString("hex"),
  };
  return {
    configured: true,
    verificationKey: publicHex,
    pro: paid,
    status: paid ? "active" : "past_due",
    interval: "month",
    accessUntil: new Date(now + 3600_000).toISOString(),
    trialEnd: null,
    trialEligible: false,
    cancelAtPeriodEnd: false,
    canManage: true,
    license: paid ? license : null,
  };
}
function api(paid = true) {
  return vi.fn(async (_input: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify(snapshot(body.device, owner, paid)), {
      status: 200,
    });
  });
}
beforeAll(async () => {
  vi.stubEnv("EXPO_PUBLIC_SUPABASE_URL", "https://billing.example.test");
  vi.stubEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", "public-key");
  vi.stubEnv("EXPO_PUBLIC_PRO_LICENSE_PUBLIC_KEY", publicHex);
  mock.createClient.mockReturnValue({
    auth: {
      getSession: async () => ({
        data: { session: mock.session },
        error: null,
      }),
      signInWithOtp: mock.signInWithOtp,
      verifyOtp: mock.verifyOtp,
      signOut: mock.signOut,
      onAuthStateChange: (listener: () => void) => {
        mock.authListener = listener;
        return {
          data: {
            subscription: {
              unsubscribe() {
                mock.authListener = null;
              },
            },
          },
        };
      },
      startAutoRefresh() {},
      stopAutoRefresh() {},
    },
  });
  billing = await import("../../src/services/proBilling");
  billingClientArguments = mock.createClient.mock.calls[0]!;
});
beforeEach(() => {
  mock.storage.clear();
  mock.failTrackingRead = false;
  mock.session = null;
  mock.mainSession = session(account);
  mock.mainGetSession.mockReset().mockImplementation(async () => ({
    data: { session: mock.mainSession },
    error: null,
  }));
  mock.mainSetSession.mockReset();
  mock.signInWithOtp.mockReset().mockResolvedValue({ error: null });
  mock.verifyOtp.mockReset().mockImplementation(async () => {
    mock.session = session(owner);
    return { error: null };
  });
  mock.signOut.mockReset().mockImplementation(async () => {
    mock.session = null;
    return { error: null };
  });
  usePro.setState(emptyPro);
  vi.stubGlobal("addEventListener", listeners.addEventListener);
  vi.stubGlobal("removeEventListener", listeners.removeEventListener);
});
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("local billing identity isolation", () => {
  it("verifies/restores in a separate session without signing into the cloud workspace", async () => {
    const fetch = api();
    vi.stubGlobal("fetch", fetch);
    cleanup = billing.maintainPro("guest");
    await billing.refreshPro("guest");
    await billing.sendBillingCode("billing@example.test");
    await billing.verifyBillingCode("billing@example.test", "123456");
    expect(billingClientArguments).toEqual([
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        auth: expect.objectContaining({
          storageKey: "subloom.pro.billing.auth",
          detectSessionInUrl: false,
        }),
      }),
    ]);
    expect(mock.mainSetSession).not.toHaveBeenCalled();
    expect(mock.mainGetSession).not.toHaveBeenCalled();
    expect(usePro.getState()).toMatchObject({
      workspace: "guest",
      owner,
      ready: true,
    });
    expect(usePro.getState().offlineUntil).toBeGreaterThan(Date.now());
    expect(JSON.parse(String(fetch.mock.calls.at(-1)?.[1]?.body))).toEqual({
      action: "status",
      device: expect.any(String),
    });
    expect(fetch.mock.calls.at(-1)?.[1]?.headers).toMatchObject({
      Authorization: "Bearer verified-token-" + owner,
    });
    // No record contents, service labels, or payment-source data in a billing request.
    expect(String(fetch.mock.calls.at(-1)?.[1]?.body)).not.toMatch(
      /subscriptions|transactions|sources/,
    );
  });
  it("uses a signed offline cache during outages and replaces it on online revocation", async () => {
    mock.session = session(owner);
    vi.stubGlobal("fetch", api());
    cleanup = billing.maintainPro("guest");
    await billing.refreshPro("guest");
    expect(usePro.getState().offlineUntil).toBeGreaterThan(Date.now());
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await billing.refreshPro("guest");
    expect(usePro.getState().offlineUntil).toBeGreaterThan(Date.now());
    vi.stubGlobal("fetch", api(false));
    await billing.refreshPro("guest");
    expect(usePro.getState().offlineUntil).toBe(0);
    expect(
      [...mock.storage.keys()].filter((key) =>
        key.startsWith("subloom.pro.license"),
      ),
    ).toHaveLength(0);
  });
  it("clears cached access on authoritative authentication rejection", async () => {
    mock.session = session(owner);
    vi.stubGlobal("fetch", api());
    cleanup = billing.maintainPro("guest");
    await billing.refreshPro("guest");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Session expired" }), {
          status: 401,
        }),
      ),
    );
    await billing.refreshPro("guest");
    expect(usePro.getState().offlineUntil).toBe(0);
  });
  it("prevents purchases when server and app verification keys differ", async () => {
    mock.session = session(owner);
    const fetch = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          ...snapshot(body.device),
          verificationKey: "04" + "11".repeat(64),
        }),
      );
    });
    vi.stubGlobal("fetch", fetch);
    cleanup = billing.maintainPro("guest");
    await billing.refreshPro("guest");
    expect(usePro.getState().snapshot?.configured).toBe(false);
    const requests = fetch.mock.calls.length;
    await expect(billing.openProBilling("checkout", "month")).rejects.toThrow(
      /not configured/,
    );
    expect(fetch).toHaveBeenCalledTimes(requests);
  });
  it("does not transfer guest Pro or delayed responses into an unrelated account", async () => {
    mock.session = session(owner);
    vi.stubGlobal("fetch", api());
    cleanup = billing.maintainPro("guest");
    await billing.refreshPro("guest");
    let finish!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    const delayed = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", delayed);
    const refresh = billing.refreshPro("guest");
    await vi.waitFor(() => expect(delayed).toHaveBeenCalled());
    cleanup();
    cleanup = undefined;
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    cleanup = billing.maintainPro(account);
    await billing.refreshPro(account);
    const device = JSON.parse(delayed.mock.calls[0]?.[1]?.body).device;
    finish(new Response(JSON.stringify(snapshot(device))));
    await refresh;
    expect(usePro.getState()).toMatchObject({
      workspace: account,
      owner: account,
      offlineUntil: 0,
    });
  });
  it("deduplicates refreshes and preserves access while the same owner refreshes", async () => {
    mock.session = session(owner);
    vi.stubGlobal("fetch", api());
    cleanup = billing.maintainPro("guest");
    await billing.refreshPro("guest");
    const until = usePro.getState().offlineUntil;
    let finish!: (response: Response) => void;
    let device = "";
    const fetch = vi.fn((_input: unknown, init?: RequestInit) => {
      device = JSON.parse(String(init?.body)).device;
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    });
    vi.stubGlobal("fetch", fetch);
    const first = billing.refreshPro("guest");
    expect(billing.refreshPro("guest")).toBe(first);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(usePro.getState().offlineUntil).toBe(until);
    finish(new Response(JSON.stringify(snapshot(device))));
    await first;
    expect(usePro.getState().loading).toBe(false);
  });
  it("revokes access at expiry without waiting for the periodic refresh", async () => {
    mock.session = session(owner);
    vi.stubGlobal("fetch", api());
    cleanup = billing.maintainPro("guest");
    await billing.refreshPro("guest");
    vi.useFakeTimers();
    usePro.setState({ offlineUntil: Date.now() + 100 });
    await vi.advanceTimersByTimeAsync(101);
    expect(usePro.getState().offlineUntil).toBe(0);
  });
  it("keeps verified access when tracking-marker storage fails", async () => {
    mock.session = session(owner);
    mock.failTrackingRead = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: unknown, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        const end = new Date(Date.now() + 3600000).toISOString();
        return new Response(
          JSON.stringify({
            ...snapshot(body.device),
            tracking: {
              id: "bbbbbbbb-bbbb-5bbb-8bbb-bbbbbbbbbbbb",
              purchasedAt: new Date().toISOString(),
              periodEnd: end,
              anchorAt: end,
              trialEnd: null,
              canceledAt: null,
              endsAt: end,
              cancelAtPeriodEnd: false,
              status: "active",
              confirmed: true,
              interval: "month",
              amountMinor: 299,
              currency: "EUR",
            },
          }),
        );
      }),
    );
    cleanup = billing.maintainPro("guest");
    await billing.refreshPro("guest");
    expect(usePro.getState().offlineUntil).toBeGreaterThan(Date.now());
    expect(usePro.getState().error).toMatch(/tracking entry/);
  });
  it("cancels through the current billing identity and refreshes its status", async () => {
    mock.session = session(owner);
    const endsAt = new Date(Date.now() + 3600000).toISOString();
    let canceled = false;
    const fetch = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (body.action === "cancel") {
        canceled = true;
        return new Response(JSON.stringify({ canceled: true, endsAt }));
      }
      return new Response(
        JSON.stringify({
          ...snapshot(body.device),
          cancelAtPeriodEnd: canceled,
        }),
      );
    });
    vi.stubGlobal("fetch", fetch);
    cleanup = billing.maintainPro("guest");
    await billing.refreshPro("guest");
    await expect(billing.cancelProSubscription()).resolves.toEqual({
      canceled: true,
      endsAt,
    });
    const request = fetch.mock.calls.find(
      (call) => JSON.parse(String(call[1]?.body)).action === "cancel",
    );
    expect(request?.[1]?.headers).toMatchObject({
      Authorization: "Bearer verified-token-" + owner,
    });
    expect(usePro.getState().snapshot?.cancelAtPeriodEnd).toBe(true);
    expect(usePro.getState().offlineUntil).toBeGreaterThan(Date.now());
    expect(mock.mainSetSession).not.toHaveBeenCalled();
  });
  it("disconnects only billing and retains local workspace records", async () => {
    mock.storage.set("local-subscription-data", "still on device");
    mock.session = session(owner);
    vi.stubGlobal("fetch", api());
    cleanup = billing.maintainPro("guest");
    await billing.refreshPro("guest");
    await billing.disconnectBilling();
    expect(usePro.getState().offlineUntil).toBe(0);
    expect(mock.storage.get("local-subscription-data")).toBe("still on device");
    expect(mock.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mock.mainSetSession).not.toHaveBeenCalled();
  });
});
