import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { preferences, subscription, userA, userB } from "../fixtures";
import { extractReceipt } from "../../src/domain/detection";
let database: PGlite;
async function asUser(user: string, sql: string, params: unknown[] = []) {
  await database.exec(
    "set role authenticated; select set_config('request.jwt.claim.sub','" +
      user +
      "',false)",
  );
  try {
    return await database.query(sql, params);
  } finally {
    await database.exec("reset role");
  }
}
function operation(
  entity: string,
  entityId: string,
  payload: unknown,
  expectedVersion: number | null = null,
  action = "put",
) {
  return {
    id: randomUUID(),
    entity,
    entityId,
    payload,
    expectedVersion,
    action,
    createdAt: new Date().toISOString(),
  };
}
beforeAll(async () => {
  database = new PGlite();
  await database.exec(
    "create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role;",
  );
  for (const name of [
    "202610090001_core.sql",
    "202610090002_ingestion.sql",
    "202610090003_scheduling.sql",
    "202610090004_contract_validation.sql",
    "202610090005_retention.sql",
  ])
    await database.exec(
      readFileSync(
        new URL("../../supabase/migrations/" + name, import.meta.url),
        "utf8",
      ),
    );
  await database.query(
    "insert into auth.users(id,email) values($1,$2),($3,$4)",
    [userA, "a@example.test", userB, "b@example.test"],
  );
}, 30000);
afterAll(async () => {
  await database?.close();
});
describe("real PostgreSQL migrations, transactions and RLS", () => {
  const s = subscription(),
    create = operation("subscription", s.id, { subscription: s });
  it("creates a profile and free entitlement through an auth trigger", async () => {
    expect((await asUser(userA, "select * from profiles")).rows).toHaveLength(
      1,
    );
    expect(
      (await asUser(userA, "select * from user_entitlements")).rows,
    ).toHaveLength(1);
  });
  it("permits valid CRUD through the authenticated RPC", async () => {
    const result = await asUser(
      userA,
      "select apply_operation($1::jsonb) as result",
      [JSON.stringify(create)],
    );
    expect(result.rows[0]).toMatchObject({ result: { ok: true, version: 1 } });
  });
  it("makes retried mutations idempotent", async () => {
    await asUser(userA, "select apply_operation($1::jsonb)", [
      JSON.stringify(create),
    ]);
    expect(
      (await asUser(userA, "select * from subscriptions")).rows,
    ).toHaveLength(1);
  });
  it("isolates reads between users", async () => {
    expect(
      (await asUser(userB, "select * from subscriptions")).rows,
    ).toHaveLength(0);
  });
  it("blocks direct subscription writes", async () => {
    await expect(asUser(userA, "delete from subscriptions")).rejects.toThrow(
      /permission denied/,
    );
  });
  it("prevents hijacking another user’s subscription ID", async () => {
    await expect(
      asUser(userB, "select apply_operation($1::jsonb)", [
        JSON.stringify(
          operation("subscription", s.id, {
            subscription: { ...s, userId: userB },
          }),
        ),
      ]),
    ).rejects.toThrow(/identity/);
  });
  it("rejects malformed financial data", async () => {
    await expect(
      asUser(userA, "select apply_operation($1::jsonb)", [
        JSON.stringify(
          operation("subscription", randomUUID(), {
            subscription: { ...s, id: randomUUID(), amountMinor: 1.5 },
          }),
        ),
      ]),
    ).rejects.toThrow(/Invalid subscription/);
  });
  it("rejects invalid dates on the server", async () => {
    const bad = { ...s, id: randomUUID(), nextRenewal: "2026-02-30" };
    await expect(
      asUser(userA, "select apply_operation($1::jsonb)", [
        JSON.stringify(
          operation("subscription", bad.id, { subscription: bad }),
        ),
      ]),
    ).rejects.toThrow(/Invalid subscription/);
  });
  it("detects version conflicts without overwriting data", async () => {
    await expect(
      asUser(userA, "select apply_operation($1::jsonb)", [
        JSON.stringify(
          operation(
            "subscription",
            s.id,
            { subscription: { ...s, name: "Wrong" } },
            0,
          ),
        ),
      ]),
    ).rejects.toThrow(/conflict/i);
  });
  it("increments revision exactly once for a successful edit", async () => {
    const edit = operation(
      "subscription",
      s.id,
      { subscription: { ...s, name: "Spotify Family", version: 2 } },
      1,
    );
    await asUser(userA, "select apply_operation($1::jsonb)", [
      JSON.stringify(edit),
    ]);
    await asUser(userA, "select apply_operation($1::jsonb)", [
      JSON.stringify(edit),
    ]);
    expect(
      (await asUser(userA, "select version,name from subscriptions")).rows[0],
    ).toMatchObject({ version: 2, name: "Spotify Family" });
  });
  it("persists validated timezone and reminder settings", async () => {
    await asUser(userA, "select apply_operation($1::jsonb)", [
      JSON.stringify(operation("preferences", "preferences", preferences())),
    ]);
    expect(
      (await asUser(userA, "select data from user_preferences")).rows[0],
    ).toMatchObject({ data: { timezone: "UTC" } });
    await expect(
      asUser(userB, "select apply_operation($1::jsonb)", [
        JSON.stringify(
          operation("preferences", "preferences", {
            ...preferences(),
            reminderHour: 29,
          }),
        ),
      ]),
    ).rejects.toThrow(/Invalid preferences/);
  });
  it("deduplicates server notification events by deterministic key", async () => {
    await database.query(
      "insert into notification_events(user_id,event_key,subscription_id,subscription_version,kind,payload,due_at) values($1,'test-reminder',$2,2,'renewal','{}',now()) on conflict(event_key) do nothing",
      [userA, s.id],
    );
    await database.query(
      "insert into notification_events(user_id,event_key,kind,payload,due_at) values($1,'test-reminder','renewal','{}',now()) on conflict(event_key) do nothing",
      [userA],
    );
    expect(
      (
        await database.query(
          "select id from notification_events where event_key='test-reminder'",
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("invalidates outdated reminders in the same edit transaction", async () => {
    await asUser(userA, "select apply_operation($1::jsonb)", [
      JSON.stringify(
        operation(
          "subscription",
          s.id,
          { subscription: { ...s, version: 3 } },
          2,
        ),
      ),
    ]);
    expect(
      (
        await database.query<{ invalidated_at: string | null }>(
          "select invalidated_at from notification_events where event_key='test-reminder'",
        )
      ).rows[0]?.invalidated_at,
    ).not.toBeNull();
  });
  it("leases delivery jobs and prevents concurrent claiming", async () => {
    const event = (
      await database.query<{ id: string }>(
        "insert into notification_events(user_id,event_key,kind,payload,due_at) values($1,'lease-test','welcome','{}',now()) returning id",
        [userA],
      )
    ).rows[0]!;
    await database.query(
      "insert into notification_deliveries(user_id,event_id,channel,destination) values($1,$2,'email','a@example.test')",
      [userA, event.id],
    );
    const first = await database.query("select * from claim_deliveries(20)");
    expect(first.rows).toHaveLength(1);
    expect(
      (await database.query("select * from claim_deliveries(20)")).rows,
    ).toHaveLength(0);
  });
  it("handles webhook retries with a transactional replay claim", async () => {
    expect(
      (
        await database.query("select claim_webhook('receipt-1',$1) as result", [
          userA,
        ])
      ).rows[0],
    ).toMatchObject({ result: "claimed" });
    expect(
      (
        await database.query("select claim_webhook('receipt-1',$1) as result", [
          userA,
        ])
      ).rows[0],
    ).toMatchObject({ result: "busy" });
    await database.exec(
      "update webhook_receipts set state='done' where id='receipt-1'",
    );
    expect(
      (
        await database.query("select claim_webhook('receipt-1',$1) as result", [
          userA,
        ])
      ).rows[0],
    ).toMatchObject({ result: "done" });
  });
  it("rate limits ingestion atomically", async () => {
    for (let i = 0; i < 2; i++)
      expect(
        (
          await database.query(
            "select take_rate_limit('test-limit',2,3600,$1) as ok",
            [userA],
          )
        ).rows[0],
      ).toMatchObject({ ok: true });
    expect(
      (
        await database.query(
          "select take_rate_limit('test-limit',2,3600,$1) as ok",
          [userA],
        )
      ).rows[0],
    ).toMatchObject({ ok: false });
  });
  it("prevents cross-user push registration", async () => {
    await expect(
      asUser(
        userB,
        "insert into push_devices(id,user_id,token,platform) values($1,$2,$3,'ios')",
        [randomUUID(), userA, "ExpoPushToken[abc123]"],
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("confirms a candidate and subscription atomically, including retries", async () => {
    const candidate = extractReceipt(
      "Netflix monthly subscription USD 15.99\nNext renewal: 2026-11-09",
      randomUUID(),
    );
    await asUser(userA, "select apply_operation($1::jsonb)", [
      JSON.stringify(operation("candidate", candidate.id, { candidate })),
    ]);
    const sub = subscription({
      id: randomUUID(),
      name: "Netflix",
      serviceId: "netflix",
    });
    const confirmation = operation("confirmation", sub.id, {
      subscription: sub,
      candidate,
    });
    await asUser(userA, "select apply_operation($1::jsonb)", [
      JSON.stringify(confirmation),
    ]);
    await asUser(userA, "select apply_operation($1::jsonb)", [
      JSON.stringify(confirmation),
    ]);
    expect(
      (
        await asUser(
          userA,
          "select state from detected_candidates where id=$1",
          [candidate.id],
        )
      ).rows[0],
    ).toMatchObject({ state: "confirmed" });
    expect(
      (
        await asUser(userA, "select version from subscriptions where id=$1", [
          sub.id,
        ])
      ).rows[0],
    ).toMatchObject({ version: 1 });
    await expect(
      asUser(userA, "select apply_operation($1::jsonb)", [
        JSON.stringify(
          operation("confirmation", randomUUID(), {
            subscription: subscription({ id: randomUUID() }),
            candidate,
          }),
        ),
      ]),
    ).rejects.toThrow();
  });
  it("rolls back a subscription when confirming an unowned candidate", async () => {
    const candidate = extractReceipt(
      "Adobe monthly subscription USD 20",
      randomUUID(),
    );
    await asUser(userB, "select apply_operation($1::jsonb)", [
      JSON.stringify(operation("candidate", candidate.id, { candidate })),
    ]);
    const sub = subscription({ id: randomUUID() });
    await expect(
      asUser(userA, "select apply_operation($1::jsonb)", [
        JSON.stringify(
          operation("confirmation", sub.id, { subscription: sub, candidate }),
        ),
      ]),
    ).rejects.toThrow(/not owned/);
    expect(
      (
        await asUser(userA, "select id from subscriptions where id=$1", [
          sub.id,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await asUser(userA, "select * from detected_candidates where id=$1", [
          candidate.id,
        ])
      ).rows,
    ).toHaveLength(0);
  });
  it("rejects malformed candidates and direct confirmation bypasses", async () => {
    const candidate = extractReceipt("Spotify subscription", randomUUID());
    await expect(
      asUser(userA, "select apply_operation($1::jsonb)", [
        JSON.stringify(
          operation("candidate", candidate.id, {
            candidate: { ...candidate, confidence: 4 },
          }),
        ),
      ]),
    ).rejects.toThrow(/check constraint/);
    await expect(
      asUser(userA, "select apply_operation($1::jsonb)", [
        JSON.stringify(
          operation("candidate", candidate.id, {
            candidate: { ...candidate, state: "confirmed" },
          }),
        ),
      ]),
    ).rejects.toThrow(/must be pending/);
  });
  it("allows the actual service role to insert validated receipt candidates", async () => {
    const candidate = extractReceipt(
      "Spotify subscription USD 11 monthly Invoice: SERVICE-ROLE-TEST",
      randomUUID(),
    );
    await database.exec("set role service_role");
    try {
      await database.query(
        "insert into detected_candidates(id,user_id,data) values($1,$2,$3::jsonb)",
        [candidate.id, userA, JSON.stringify(candidate)],
      );
    } finally {
      await database.exec("reset role");
    }
    expect(
      (
        await asUser(userA, "select id from detected_candidates where id=$1", [
          candidate.id,
        ])
      ).rows,
    ).toHaveLength(1);
  });
  it("rejects wrong JSON field types before they reach client rendering", async () => {
    const bad = subscription({ id: randomUUID() });
    await expect(
      asUser(userA, "select apply_operation($1::jsonb)", [
        JSON.stringify(
          operation("subscription", bad.id, {
            subscription: { ...bad, notes: {} },
          }),
        ),
      ]),
    ).rejects.toThrow(/check constraint/);
  });
  it("remembers welcome acceptance even after delivery metadata expires", async () => {
    await database.query(
      "update notification_deliveries set status='accepted' where event_id in (select id from notification_events where event_key='lease-test')",
    );
    expect(
      (
        await database.query<{ welcome_sent_at: string | null }>(
          "select welcome_sent_at from profiles where user_id=$1",
          [userA],
        )
      ).rows[0]?.welcome_sent_at,
    ).not.toBeNull();
  });
  it("purges aged delivery metadata while retaining offline mutation IDs", async () => {
    await database.query(
      "insert into notification_events(user_id,event_key,kind,payload,due_at,created_at) values($1,'retention-old','welcome','{}',now(),now()-interval '100 days')",
      [userA],
    );
    await database.exec(
      "update operation_results set created_at=now()-interval '100 days'",
    );
    const before = (await database.query("select id from operation_results"))
      .rows.length;
    await expect(
      asUser(userA, "select purge_retained_metadata()"),
    ).rejects.toThrow(/permission denied/);
    await database.query("select purge_retained_metadata()");
    expect(
      (
        await database.query(
          "select id from notification_events where event_key='retention-old'",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (await database.query("select id from operation_results")).rows,
    ).toHaveLength(before);
  });
  it("cascades account deletion without touching another user", async () => {
    await database.query("delete from auth.users where id=$1", [userA]);
    expect(
      (await database.query("select * from subscriptions")).rows,
    ).toHaveLength(0);
    expect(
      (await database.query("select * from notification_events")).rows,
    ).toHaveLength(0);
    expect((await asUser(userB, "select * from profiles")).rows).toHaveLength(
      1,
    );
  });
});
