import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { subscription } from "../fixtures";
import { randomUUID } from "node:crypto";
let db: PGlite;
const a = randomUUID(),
  b = randomUUID();
async function role<T>(name: string, action: () => Promise<T>) {
  await db.exec("set role " + name);
  try {
    return await action();
  } finally {
    await db.exec("reset role");
  }
}
async function save(key: string, data: unknown, version: number, owner = a) {
  return await role("authenticated", async () => {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    return await db.query(
      "select save_feature_setting($1,$2::jsonb,$3) as version",
      [key, JSON.stringify(data), version],
    );
  });
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema public,auth to authenticated,anon,service_role;",
  );
  for (const name of [
    "202610090001_core.sql",
    "202610090004_contract_validation.sql",
    "202610110001_feature_settings.sql",
    "20261012131814_payment_sources.sql",
    "20261012132927_subscription_radar.sql",
    "20261023160619_pro_billing.sql",
    "20261024173456_free_plan_limits.sql",
    "20261025124715_toggle_pro_plan.sql",
    "20261025124911_restrict_plan_configuration_access.sql",
  ])
    await db.exec(
      readFileSync(
        new URL("../../supabase/migrations/" + name, import.meta.url),
        "utf8",
      ),
    );
  await db.query("insert into auth.users values($1),($2)", [a, b]);
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("billing security in PostgreSQL", () => {
  it("denies public billing reads, self-grants and lease claims", async () => {
    for (const name of ["anon", "authenticated"])
      await role(name, async () => {
        await expect(db.query("select * from pro_billing")).rejects.toThrow(
          /permission denied/,
        );
        await expect(
          db.query(
            "insert into pro_billing(user_id,status) values($1,'active')",
            [a],
          ),
        ).rejects.toThrow(/permission denied/);
        await expect(
          db.query("select claim_pro_billing($1,$2)", [a, randomUUID()]),
        ).rejects.toThrow(/permission denied/);
        await expect(
          db.query("select * from pro_trial_history"),
        ).rejects.toThrow(/permission denied/);
      });
  });
  it("serializes billing operations and only reclaims expired leases", async () => {
    const token = randomUUID();
    await role("service_role", async () => {
      const first = await db.query<{ state: { lease_token: string } }>(
        "select claim_pro_billing($1,$2) as state",
        [a, token],
      );
      expect(first.rows[0]?.state.lease_token).toBe(token);
      expect(
        (
          await db.query("select claim_pro_billing($1,$2) as state", [
            a,
            randomUUID(),
          ])
        ).rows[0],
      ).toEqual({ state: null });
      await db.query(
        "update pro_billing set lease_until=now()-interval '1 second' where user_id=$1",
        [a],
      );
      expect(
        (
          await db.query("select claim_pro_billing($1,$2) as state", [
            a,
            randomUUID(),
          ])
        ).rows[0],
      ).not.toEqual({ state: null });
    });
  });
  it("enforces free limits on direct writes and keeps expired Pro records editable", async () => {
    const profile = (count: number) => ({
      sources: Array.from({ length: count }, (_, i) => ({
        id: String(i),
        kind: i % 2 ? "wallet" : "card",
        name: "Card " + i,
      })),
      links: [],
    });
    await save("payment_sources", profile(2), 0);
    await expect(save("payment_sources", profile(3), 1)).rejects.toThrow(/Pro/);
    await expect(
      save("payment_transactions", [{ id: "charge-a" }], 0),
    ).rejects.toThrow(/Pro/);
    await db.query(
      "update pro_billing set status='trialing', access_until=now()+interval '1 day',verified_at=now() where user_id=$1",
      [a],
    );
    await save("payment_sources", profile(4), 1);
    await save("payment_transactions", [{ id: "charge-a" }], 0);
    await expect(save("payment_sources", profile(5), 0, b)).rejects.toThrow(
      /Pro/,
    );
    await db.query(
      "update pro_billing set access_until=now()-interval '1 second' where user_id=$1",
      [a],
    );
    const edited = profile(4);
    edited.sources[0]!.name = "Renamed";
    await save("payment_sources", edited, 2);
    await expect(save("payment_sources", profile(5), 3)).rejects.toThrow(/Pro/);
    await save("payment_transactions", [{ id: "charge-a", ignored: true }], 1);
    await expect(
      save("payment_transactions", [{ id: "charge-a" }, { id: "charge-b" }], 2),
    ).rejects.toThrow(/Pro/);
    await save("payment_sources", profile(3), 3);
    await save("payment_transactions", [], 2);
    await expect(save("payment_sources", profile(2), 1)).rejects.toThrow(
      /conflict/,
    );
  });
  it("rejects stale processor verification and blocked or unpaid subscriptions", async () => {
    for (const patch of [
      "status='past_due',access_until=now()+interval '1 day',verified_at=now()",
      "status='active',payment_blocked=true",
      "status='active',payment_blocked=false,verified_at=now()-interval '73 hours'",
    ]) {
      await db.query("update pro_billing set " + patch + " where user_id=$1", [
        a,
      ]);
      await expect(
        save(
          "payment_sources",
          {
            sources: [0, 1, 2, 3].map((id) => ({
              id: String(id),
              kind: "card",
            })),
          },
          4,
        ),
      ).rejects.toThrow(/Pro/);
    }
  });
  it("caps subscriptions including API upserts, allows edits and deletes after expiry, and isolates owners", async () => {
    const owner = randomUUID();
    await db.query("insert into auth.users values($1)", [owner]);
    const put = async (id: string, version = 1) =>
      role("authenticated", async () => {
        await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
          owner,
        ]);
        const data = subscription({ id, userId: owner, version });
        return db.query("select apply_operation($1::jsonb)", [
          JSON.stringify({
            id: randomUUID(),
            entity: "subscription",
            entityId: id,
            action: "put",
            expectedVersion: version === 1 ? null : version - 1,
            payload: { subscription: data },
            createdAt: new Date().toISOString(),
          }),
        ]);
      });
    const ids = Array.from({ length: 10 }, () => randomUUID());
    for (const id of ids) await put(id);
    await expect(put(randomUUID())).rejects.toThrow(/10 subscriptions/);
    await put(ids[0]!, 2);
    await db.query(
      "insert into pro_billing(user_id,status,access_until,verified_at) values($1,'active',now()+interval '1 day',now())",
      [owner],
    );
    const extra = randomUUID();
    await put(extra);
    await db.query(
      "update pro_billing set access_until=now()-interval '1 second' where user_id=$1",
      [owner],
    );
    await put(extra, 2);
    await expect(put(randomUUID())).rejects.toThrow(/Pro/);
    await role("authenticated", async () => {
      await db.query("select apply_operation($1::jsonb)", [
        JSON.stringify({
          id: randomUUID(),
          entity: "subscription",
          entityId: extra,
          action: "delete",
          expectedVersion: 2,
          payload: {},
          createdAt: new Date().toISOString(),
        }),
      ]);
    });
    expect(
      (await db.query("select id from subscriptions where user_id=$1", [owner]))
        .rows,
    ).toHaveLength(10);
    // A different workspace has its own capacity and cannot change the first owner's rows.
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [b]);
    const foreign = subscription({ id: ids[0], userId: b, version: 3 });
    await expect(
      db.query(
        "insert into subscriptions(id,user_id,data,version) values($1,$2,$3,3)",
        [foreign.id, owner, foreign],
      ),
    ).rejects.toThrow(/owner/);
  });
  it("rejects missing or forged method kinds and duplicate IDs", async () => {
    for (const sources of [
      [{ id: "x" }],
      [{ id: "x", kind: "other" }],
      [
        { id: "x", kind: "card" },
        { id: "x", kind: "wallet" },
      ],
      [{ id: "x", kind: "bank" }],
    ])
      await expect(
        save("payment_sources", { sources, links: [] }, 0, b),
      ).rejects.toThrow(/Invalid|Pro/);
  });
  it("cascades billing rows on deletion while retaining minimal trial-abuse history", async () => {
    await db.query("insert into pro_trial_history(email_hash) values($1)", [
      "a".repeat(64),
    ]);
    await db.query("delete from auth.users where id=$1", [a]);
    expect(
      (await db.query("select * from pro_billing where user_id=$1", [a])).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from pro_trial_history")).rows,
    ).toHaveLength(1);
  });
});

describe("reversible paid-plan enforcement", () => {
  it("keeps mode configuration available only to the backend", async () => {
    for (const name of ["anon", "authenticated"])
      await role(name, async () => {
        await expect(
          db.query("select public.pro_plan_enabled()"),
        ).rejects.toThrow(/permission denied/);
        await expect(
          db.exec(
            "update private.plan_configuration set pro_plan_enabled=false",
          ),
        ).rejects.toThrow(/permission denied/);
        await expect(
          db.exec("select * from private.plan_configuration"),
        ).rejects.toThrow(/permission denied/);
        await db.exec(
          "select set_config('app.pro_plan_enabled','false',false)",
        );
      });
    await role("service_role", async () => {
      expect(
        (await db.query("select public.pro_plan_enabled() as enabled")).rows,
      ).toEqual([{ enabled: true }]);
      await expect(
        db.exec("update private.plan_configuration set pro_plan_enabled=false"),
      ).rejects.toThrow(/permission denied/);
    });
  });
  it("allows unpaid API writes in free mode and restores restrictions while keeping data editable", async () => {
    const owner = randomUUID();
    await db.query("insert into auth.users values($1)", [owner]);
    const sources = (count: number) => ({
      sources: Array.from({ length: count }, (_, i) => ({
        id: String(i),
        kind: "card",
      })),
      links: [],
    });
    const put = (id: string, version = 1) =>
      role("authenticated", async () => {
        await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
          owner,
        ]);
        return db.query("select apply_operation($1::jsonb)", [
          JSON.stringify({
            id: randomUUID(),
            entity: "subscription",
            entityId: id,
            action: "put",
            expectedVersion: version === 1 ? null : version - 1,
            payload: {
              subscription: subscription({ id, userId: owner, version }),
            },
            createdAt: new Date().toISOString(),
          }),
        ]);
      });
    await db.exec(
      "update private.plan_configuration set pro_plan_enabled=false",
    );
    try {
      const ids = Array.from({ length: 12 }, () => randomUUID());
      for (const id of ids) await put(id);
      await save("payment_sources", sources(4), 0, owner);
      await save("payment_transactions", [{ id: "free-import" }], 0, owner);
      await expect(
        save("payment_sources", sources(51), 1, owner),
      ).rejects.toThrow(/50/);
      await expect(
        save(
          "payment_sources",
          { sources: [{ id: "bad", kind: "invalid" }] },
          1,
          owner,
        ),
      ).rejects.toThrow(/Invalid/);
      await expect(
        save("payment_sources", sources(4), 0, owner),
      ).rejects.toThrow(/conflict/);
      expect(
        (await db.query("select * from pro_billing where user_id=$1", [owner]))
          .rows,
      ).toHaveLength(0);
      await db.exec(
        "update private.plan_configuration set pro_plan_enabled=true",
      );
      await expect(put(randomUUID())).rejects.toThrow(/Pro/);
      await expect(
        save("payment_sources", sources(5), 1, owner),
      ).rejects.toThrow(/Pro/);
      await expect(
        save(
          "payment_transactions",
          [{ id: "free-import" }, { id: "new" }],
          1,
          owner,
        ),
      ).rejects.toThrow(/Pro/);
      await put(ids[0]!, 2);
      await save("payment_sources", sources(4), 1, owner);
      await save(
        "payment_transactions",
        [{ id: "free-import", ignored: true }],
        1,
        owner,
      );
      expect(
        (
          await db.query("select id from subscriptions where user_id=$1", [
            owner,
          ])
        ).rows,
      ).toHaveLength(12);
    } finally {
      await db.exec(
        "update private.plan_configuration set pro_plan_enabled=true",
      );
    }
  });
});
