/** Destructive only to freshly created, uniquely tagged QA accounts. Never accepts an existing user ID. */
import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (process.env.SUBLOOM_SERVER_ENV_FILE)
  process.loadEnvFile(process.env.SUBLOOM_SERVER_ENV_FILE);
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publicKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !publicKey)
  throw new Error("Configure the public Supabase URL and key first.");
const project = new URL(url).hostname.split(".")[0];
let adminKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!adminKey) {
  try {
    // Keys stay in process memory. Never print this output, including in error handlers.
    const keys = JSON.parse(
      execFileSync(
        "node_modules/.bin/supabase",
        [
          "projects",
          "api-keys",
          "--project-ref",
          project,
          "--reveal",
          "--output",
          "json",
          "--agent",
          "no",
          "--output-format",
          "text",
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      ),
    );
    adminKey =
      keys.find((k) => k.api_key?.startsWith("sb_secret_"))?.api_key ||
      keys.find((k) => k.name === "service_role")?.api_key;
  } catch {
    throw new Error(
      "Supabase deployment access is unavailable. Authenticate the CLI or supply a server key through SUBLOOM_SERVER_ENV_FILE.",
    );
  }
}
if (!adminKey)
  throw new Error("A server-only key is needed for disposable QA accounts.");
const config = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};
const admin = createClient(url, adminKey, config),
  anon = createClient(url, publicKey, config);
const created = [],
  results = [],
  run = randomUUID();
const realtimeClients = [];
async function sessionFor(email) {
  const link = ok(
    await admin.auth.admin.generateLink({ type: "magiclink", email }),
  );
  const client = createClient(url, publicKey, config);
  const session = ok(
    await client.auth.verifyOtp({
      email,
      token: link.properties.email_otp,
      type: "email",
    }),
  );
  return { client, session };
}
async function watch(client, owner, events) {
  realtimeClients.push(client);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Realtime subscription timeout")),
      15000,
    );
    client
      .channel("qa:" + randomUUID())
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "account_sync_state",
          filter: "user_id=eq." + owner,
        },
        (payload) => events.push(payload.new),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timeout);
          reject(new Error("Realtime unavailable"));
        }
      });
  });
}
async function waitFor(condition) {
  const deadline = Date.now() + 10000;
  while (!condition()) {
    if (Date.now() >= deadline) throw new Error("Realtime event timeout");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
async function check(name, action) {
  try {
    await action();
    results.push({ name, status: "passed" });
    console.log("PASS " + name);
  } catch {
    results.push({ name, status: "failed" });
    throw new Error(
      "FAIL " + name + " (provider payload and credentials omitted)",
    );
  }
}
function ok(result) {
  assert.equal(result.error, null);
  return result.data;
}
async function account(label) {
  const email = `subloom-qa-${run}-${label}@example.invalid`;
  const { user } = ok(
    await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { subloom_test_run: run },
    }),
  );
  assert(user?.id);
  created.push(user.id);
  // Never enqueue provider sends for these test addresses, even if scheduling is enabled.
  ok(
    await admin
      .from("profiles")
      .update({ email_suppressed: true })
      .eq("user_id", user.id),
  );
  const { client, session } = await sessionFor(email);
  assert.equal(session.user.id, user.id);
  return { client, id: user.id, email, token: session.session.access_token };
}
function op(entity, id, payload, expectedVersion = null, action = "put") {
  return {
    id: randomUUID(),
    entity,
    entityId: id,
    payload,
    expectedVersion,
    action,
    createdAt: new Date().toISOString(),
  };
}
async function edge(name, token, body = {}) {
  return fetch(new URL("/functions/v1/" + name, url), {
    method: "POST",
    headers: {
      apikey: publicKey,
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
}
try {
  let a, b, second;
  const ownEvents = [],
    foreignEvents = [];
  await check(
    "Real Auth OTP verification and profile creation for two disposable accounts",
    async () => {
      a = await account("a");
      b = await account("b");
    },
  );
  await check("Verified session user and refresh token", async () => {
    assert.equal(ok(await a.client.auth.getUser()).user.id, a.id);
    assert.equal(ok(await a.client.auth.refreshSession()).user.id, a.id);
    a.token = (await a.client.auth.getSession()).data.session.access_token;
  });
  await check(
    "Invalid OTP rejected without establishing a session",
    async () => {
      const client = createClient(url, publicKey, config);
      assert(
        (
          await client.auth.verifyOtp({
            email: a.email,
            token: "0000000000",
            type: "email",
          })
        ).error,
      );
      assert.equal((await client.auth.getSession()).data.session, null);
    },
  );
  await check(
    "Second device session and owner-protected Realtime subscriptions",
    async () => {
      second = (await sessionFor(a.email)).client;
      assert.equal(ok(await second.auth.getUser()).user.id, a.id);
      await watch(second, a.id, ownEvents);
      // Deliberately request A's marker through B to test the Realtime RLS boundary.
      await watch(b.client, a.id, foreignEvents);
    },
  );
  const now = new Date().toISOString(),
    id = randomUUID();
  const subscription = {
    id,
    userId: a.id,
    serviceId: null,
    name: "Disposable deployment QA",
    category: "Other",
    amountMinor: 1234,
    currency: "USD",
    interval: "monthly",
    intervalCount: 1,
    customUnit: "day",
    startDate: "2050-01-31",
    nextRenewal: "2050-01-31",
    anchorDay: 31,
    status: "active",
    trialEnd: null,
    canceledAt: null,
    paidThrough: null,
    paymentMethod: "",
    notes: "Non-sensitive automated fixture",
    source: "manual",
    reminders: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
  const create = op("subscription", id, { subscription });
  await check("Authenticated create and idempotent replay", async () => {
    assert.equal(
      ok(await a.client.rpc("apply_operation", { operation: create })).version,
      1,
    );
    assert.equal(
      ok(await a.client.rpc("apply_operation", { operation: create })).version,
      1,
    );
    assert.equal(
      ok(await a.client.from("subscriptions").select("id").eq("id", id)).length,
      1,
    );
  });
  await check(
    "Second device receives create signal and reads the same account data",
    async () => {
      await waitFor(() => ownEvents.length > 0);
      assert.equal(
        ok(await second.from("subscriptions").select("data").eq("id", id))[0]
          .data.name,
        subscription.name,
      );
      assert.equal(foreignEvents.length, 0);
    },
  );
  await check("Cross-account RLS isolates subscription reads", async () => {
    assert.equal(
      ok(await b.client.from("subscriptions").select("id").eq("id", id)).length,
      0,
    );
  });
  await check("Cross-account ID hijacking rejected", async () => {
    assert(
      (
        await b.client.rpc("apply_operation", {
          operation: op("subscription", id, {
            subscription: { ...subscription, userId: b.id },
          }),
        })
      ).error,
    );
  });
  await check("Direct client writes and anonymous RPC denied", async () => {
    assert((await a.client.from("subscriptions").delete().eq("id", id)).error);
    assert(
      (
        await anon.rpc("apply_operation", {
          operation: op("subscription", randomUUID(), { subscription }),
        })
      ).error,
    );
  });
  await check(
    "Malformed price and invalid date rejected on server",
    async () => {
      for (const invalid of [
        { amountMinor: 1.5 },
        { nextRenewal: "2026-02-30" },
      ]) {
        const badId = randomUUID();
        assert(
          (
            await a.client.rpc("apply_operation", {
              operation: op("subscription", badId, {
                subscription: { ...subscription, ...invalid, id: badId },
              }),
            })
          ).error,
        );
      }
    },
  );
  await check(
    "Update persists version two and prevents stale overwrite",
    async () => {
      ok(
        await a.client.rpc("apply_operation", {
          operation: op(
            "subscription",
            id,
            {
              subscription: {
                ...subscription,
                name: "Updated QA",
                amountMinor: 2500,
              },
            },
            1,
          ),
        }),
      );
      assert(
        (
          await a.client.rpc("apply_operation", {
            operation: op("subscription", id, { subscription }, 1),
          })
        ).error,
      );
      const [row] = ok(
        await a.client
          .from("subscriptions")
          .select("data,version")
          .eq("id", id),
      );
      assert.equal(row.version, 2);
      assert.equal(row.data.amountMinor, 2500);
    },
  );
  await check(
    "Privileged worker RPC cannot be called by account clients",
    async () => {
      assert((await a.client.rpc("claim_deliveries", { batch_size: 1 })).error);
      assert(
        (await a.client.rpc("claim_schedule_users", { batch_size: 1 })).error,
      );
    },
  );
  await check(
    "Second device sees update and its edit rejects stale first-device writes",
    async () => {
      const [row] = ok(
        await second.from("subscriptions").select("data,version").eq("id", id),
      );
      assert.equal(row.version, 2);
      assert.equal(row.data.amountMinor, 2500);
      ok(
        await second.rpc("apply_operation", {
          operation: op(
            "subscription",
            id,
            {
              subscription: { ...row.data, name: "Second device edit" },
            },
            2,
          ),
        }),
      );
      assert(
        (
          await a.client.rpc("apply_operation", {
            operation: op("subscription", id, { subscription }, 2),
          })
        ).error,
      );
      assert.equal(
        ok(
          await a.client.from("subscriptions").select("version").eq("id", id),
        )[0].version,
        3,
      );
    },
  );
  await check(
    "Push registration rotation, account isolation and client-write restrictions",
    async () => {
      const device = randomUUID(),
        replacement = randomUUID();
      const token = "ExpoPushToken[" + randomUUID().replaceAll("-", "") + "]";
      const register = (client, installation) =>
        client.rpc("register_push_device", {
          installation_id: installation,
          device_token: token,
          device_platform: "android",
        });
      ok(await register(a.client, device));
      assert.equal(
        ok(
          await a.client
            .from("push_devices")
            .select("enabled")
            .eq("id", device),
        )[0].enabled,
        true,
      );
      assert.equal(
        ok(await b.client.from("push_devices").select("id").eq("id", device))
          .length,
        0,
      );
      assert((await register(b.client, device)).error);
      assert(
        (
          await a.client
            .from("push_devices")
            .update({ enabled: false })
            .eq("id", device)
        ).error,
      );
      assert.equal(
        (
          await edge("test-push", b.token, {
            installationId: device,
            requestId: randomUUID(),
          })
        ).status,
        404,
      );
      // Synthetic fixture tokens never enter the delivery queue: account push remains disabled.
      ok(await register(b.client, replacement));
      assert.equal(
        ok(
          await a.client
            .from("push_devices")
            .select("enabled")
            .eq("id", device),
        )[0].enabled,
        false,
      );
      ok(
        await b.client.rpc("disable_push_device", {
          installation_id: replacement,
        }),
      );
      assert.equal(
        ok(
          await b.client
            .from("push_devices")
            .select("enabled")
            .eq("id", replacement),
        )[0].enabled,
        false,
      );
    },
  );
  await check(
    "Test-push rejects malformed authenticated requests",
    async () => {
      assert.equal(
        (await edge("test-push", a.token, { installationId: "invalid" }))
          .status,
        400,
      );
    },
  );
  await check(
    "Authenticated cloud export excludes other account and credentials",
    async () => {
      const response = await edge("export-data", a.token);
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.subscriptions.length, 1);
      assert.equal(data.subscriptions[0].user_id, a.id);
      assert(!Object.hasOwn(data, "push_devices"));
      assert(!Object.hasOwn(data, "access_token"));
    },
  );
  await check(
    "Edge Functions reject missing/forged auth and unsigned webhooks",
    async () => {
      for (const name of [
        "export-data",
        "delete-account",
        "detection-sources",
        "process-detection",
        "test-push",
      ]) {
        assert.equal((await edge(name, null)).status, 401);
        assert.equal((await edge(name, "forged-token")).status, 401);
      }
      for (const name of ["inbound-receipt", "email-status"])
        assert([401, 503].includes((await edge(name, null)).status));
      for (const name of ["schedule-reminders", "send-reminder"])
        assert([401, 503].includes((await edge(name, null)).status));
    },
  );
  await check(
    "Authenticated delete removes subscription and replay stays idempotent",
    async () => {
      const revision = ok(
        await a.client
          .from("account_sync_state")
          .select("revision")
          .eq("user_id", a.id),
      )[0].revision;
      const remove = op("subscription", id, {}, 3, "delete");
      ok(await a.client.rpc("apply_operation", { operation: remove }));
      ok(await a.client.rpc("apply_operation", { operation: remove }));
      assert.equal(
        ok(await a.client.from("subscriptions").select("id").eq("id", id))
          .length,
        0,
      );
      await waitFor(() => ownEvents.some((event) => event.revision > revision));
      assert.equal(
        ok(await second.from("subscriptions").select("id").eq("id", id)).length,
        0,
      );
      assert.equal(foreignEvents.length, 0);
    },
  );
  await check("Session logout revokes refresh-token use", async () => {
    const session = (await b.client.auth.getSession()).data.session;
    ok(await b.client.auth.signOut());
    assert.equal((await b.client.auth.getSession()).data.session, null);
    assert(
      (await anon.auth.refreshSession({ refresh_token: session.refresh_token }))
        .error,
    );
  });
  await check(
    "Account deletion invalidates authenticated Edge Function use",
    async () => {
      const deleted = await edge("delete-account", a.token);
      assert.equal(deleted.status, 200);
      assert.equal((await edge("export-data", a.token)).status, 401);
      assert.equal(
        ok(await admin.from("profiles").select("user_id").eq("user_id", a.id))
          .length,
        0,
      );
    },
  );
} finally {
  await Promise.all(
    realtimeClients.map((client) => client.removeAllChannels()),
  );
  const cleanup = [];
  for (const id of created) {
    const response = await admin.auth.admin.getUserById(id);
    if (response.data.user?.user_metadata?.subloom_test_run === run) {
      const result = await admin.auth.admin.deleteUser(id, false);
      if (result.error) cleanup.push(id);
    }
  }
  mkdirSync("docs/verification", { recursive: true });
  writeFileSync(
    "docs/verification/live-smoke.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        scope:
          "Live Auth/PostgREST/Edge Functions with disposable accounts; no actual SMTP, OCR or push delivery.",
        results,
        cleanupFailed: cleanup.length,
      },
      null,
      2,
    ) + "\n",
  );
  if (cleanup.length) {
    console.error(
      "Disposable QA account cleanup failed: " +
        cleanup.length +
        "; use server access to remove only this run’s QA accounts.",
    );
    process.exitCode = 1;
  }
}
