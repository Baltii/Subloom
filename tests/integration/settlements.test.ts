import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { it, expect } from "vitest";
import { subscription, userA, userB } from "../fixtures";
it("protects family snapshots, receipt authority, history and versioned corrections", async () => {
  const db = new PGlite(),
    outsider = randomUUID(),
    chargeId = randomUUID(),
    settlementId = randomUUID();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;",
    );
    const directory = new URL("../../supabase/migrations/", import.meta.url);
    for (const migration of [
      "202610090001_core.sql",
      "202610090002_ingestion.sql",
      "202610090004_contract_validation.sql",
      "202610110003_workspaces.sql",
      readdirSync(directory).find((name) =>
        name.endsWith("_family_settlements.sql"),
      )!,
    ])
      await db.exec(readFileSync(new URL(migration, directory), "utf8"));
    await db.query(
      "insert into auth.users(id,email) values($1,'a@example.test'),($2,'b@example.test'),($3,'c@example.test')",
      [userA, userB, outsider],
    );
    async function as(user: string, sql: string, params: unknown[] = []) {
      await db.exec("set role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        user,
      ]);
      try {
        return await db.query<Record<string, unknown>>(sql, params);
      } finally {
        await db.exec("reset role");
      }
    }
    const scope = (
      await as(userA, "select create_workspace('Family','Owner') as id")
    ).rows[0]!.id as string;
    await db.query("insert into workspace_members values($1,$2,'Member')", [
      scope,
      userB,
    ]);
    const s = subscription({
        id: randomUUID(),
        amountMinor: 1001,
        currency: "EUR",
      }),
      shares = [
        { userId: userA, amountMinor: 501 },
        { userId: userB, amountMinor: 500 },
      ];
    await as(userA, "select save_workspace_subscription($1,$2,$3,$4,0)", [
      scope,
      JSON.stringify(s),
      userA,
      JSON.stringify(shares),
    ]);
    const charge =
      "insert into workspace_ledger(id,workspace_id,kind,payer,currency,amount_minor,event_date,subscription_id,shares,note) values($1,$2,'charge',$3,'EUR',1001,'2026-10-12',$4,$5,'Receipt-1') returning *";
    await expect(
      as(userB, charge, [chargeId, scope, userA, s.id, JSON.stringify(shares)]),
    ).rejects.toThrow(/Billing owner/);
    await expect(
      as(userA, charge, [chargeId, scope, userA, s.id, "[]"]),
    ).rejects.toThrow(/Reload/);
    await as(userA, charge, [
      chargeId,
      scope,
      userA,
      s.id,
      JSON.stringify(shares),
    ]);
    await expect(
      as(userA, charge, [
        randomUUID(),
        scope,
        userA,
        s.id,
        JSON.stringify(shares),
      ]),
    ).rejects.toThrow(/unique/);
    expect(
      (await as(userB, "select * from workspace_ledger")).rows,
    ).toHaveLength(1);
    expect((await as(outsider, "select * from workspace_ledger")).rows).toEqual(
      [],
    );
    await expect(
      as(outsider, "select workspace_ledger_history($1)", [scope]),
    ).rejects.toThrow(/membership/);
    const receipt =
      "insert into workspace_ledger(id,workspace_id,kind,payer,payee,currency,amount_minor,event_date,note) values($1,$2,'settlement',$3,$4,'EUR',200,'2026-10-12','Received-1')";
    await expect(
      as(userB, receipt, [settlementId, scope, userB, userA]),
    ).rejects.toThrow(/Recipient/);
    await as(userA, receipt, [settlementId, scope, userB, userA]);
    await expect(
      as(userA, "update workspace_ledger set amount_minor=1 where id=$1", [
        chargeId,
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(userB, "update workspace_ledger set voided=true where id=$1", [
        chargeId,
      ]),
    ).resolves.toMatchObject({ affectedRows: 0 });
    expect(
      (
        await as(
          userA,
          "update workspace_ledger set voided=true where id=$1 and version=1 returning version",
          [chargeId],
        )
      ).rows[0],
    ).toEqual({ version: 2 });
    expect(
      (
        await as(
          userA,
          "update workspace_ledger set voided=false where id=$1 and version=1 returning version",
          [chargeId],
        )
      ).rows,
    ).toEqual([]);
    await as(
      userA,
      "update workspace_ledger set voided=false where id=$1 and version=2",
      [chargeId],
    );
    const full = (
      await as(userB, "select workspace_ledger_history($1) as history", [scope])
    ).rows[0]!.history as unknown[];
    expect(full).toHaveLength(2);
    await as(
      userA,
      "insert into workspace_ledger(id,workspace_id,kind,payer,payee,currency,amount_minor,event_date,note) select gen_random_uuid(),$1,'request',$2,$3,'EUR',1,'2026-10-12','Limit QA' from generate_series(1,1998)",
      [scope, userB, userA],
    );
    await expect(
      as(userA, receipt, [randomUUID(), scope, userB, userA]),
    ).rejects.toThrow(/history is full/);
    expect(
      (
        await as(userB, "select workspace_ledger_history($1) as history", [
          scope,
        ])
      ).rows[0]!.history as unknown[],
    ).toHaveLength(2000);
    await as(userA, "select manage_workspace($1,'delete_subscription',$2,1)", [
      scope,
      s.id,
    ]);
    expect(
      (await as(userB, "select * from workspace_ledger")).rows,
    ).toHaveLength(2000);
    await db.query("delete from auth.users where id=$1", [userB]);
    expect(
      (await as(userA, "select * from workspace_ledger")).rows,
    ).toHaveLength(1);
    await as(userA, "select manage_workspace($1,'delete_workspace')", [scope]);
    expect((await db.query("select * from workspace_ledger")).rows).toEqual([]);
    await db.exec("set role anon");
    await expect(db.query("select * from workspace_ledger")).rejects.toThrow(
      /permission denied/,
    );
  } finally {
    await db.close();
  }
}, 30000);
