import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { it, expect } from "vitest";
import { subscription, userA, userB } from "../fixtures";
it("enforces shared workspace access, invitation lifecycle, splits and version checks", async () => {
  const db = new PGlite();
  const outsider = randomUUID();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid()to anon,authenticated,service_role;",
    );
    for (const migration of [
      "202610090001_core.sql",
      "202610090002_ingestion.sql",
      "202610090004_contract_validation.sql",
      "202610110003_workspaces.sql",
    ])
      await db.exec(
        readFileSync(
          new URL("../../supabase/migrations/" + migration, import.meta.url),
          "utf8",
        ),
      );
    await db.query(
      "insert into auth.users(id,email)values($1,'a@example.test'),($2,'b@example.test'),($3,'c@example.test')",
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
      await as(userA, "select create_workspace('Family','Owner')as id")
    ).rows[0]!.id as string;
    expect((await as(userB, "select * from workspaces")).rows).toEqual([]);
    const code = (
      await as(userA, "select invite_workspace($1)as code", [scope])
    ).rows[0]!.code as string;
    await as(userB, "select join_workspace($1,'Member')", [code]);
    await expect(
      as(outsider, "select join_workspace($1,'Other')", [code]),
    ).rejects.toThrow(/unavailable/);
    expect((await as(userB, "select * from workspaces")).rows).toHaveLength(1);
    await expect(as(userB, "delete from workspace_members")).rejects.toThrow(
      /permission denied/,
    );
    const data = subscription({ id: randomUUID() });
    const shares = [
      { userId: userA, amountMinor: 550 },
      { userId: userB, amountMinor: 549 },
    ];
    await as(userA, "select save_workspace_subscription($1,$2,$3,$4,0)", [
      scope,
      JSON.stringify(data),
      userB,
      JSON.stringify(shares),
    ]);
    expect(
      (await as(userB, "select * from workspace_subscriptions")).rows,
    ).toHaveLength(1);
    expect(
      (await as(outsider, "select * from workspace_subscriptions")).rows,
    ).toEqual([]);
    await expect(
      as(userB, "select save_workspace_subscription($1,$2,$3,$4,1)", [
        scope,
        JSON.stringify(data),
        userB,
        JSON.stringify(shares),
      ]),
    ).rejects.toThrow(/Owner/);
    await expect(
      as(userA, "select save_workspace_subscription($1,$2,$3,$4,0)", [
        scope,
        JSON.stringify(data),
        userA,
        JSON.stringify(shares),
      ]),
    ).rejects.toThrow(/conflict/);
    await expect(
      as(userA, "select save_workspace_subscription($1,$2,$3,$4,1)", [
        scope,
        JSON.stringify(data),
        userA,
        JSON.stringify([{ userId: userA, amountMinor: 1 }]),
      ]),
    ).rejects.toThrow(/Shares/);
    await expect(
      as(userA, "select manage_workspace($1,'remove_member',$2)", [
        scope,
        userB,
      ]),
    ).rejects.toThrow(/Reassign/);
    const expired = (
      await as(userA, "select invite_workspace($1)as code", [scope])
    ).rows[0]!.code;
    await db.query(
      "update workspace_invites set expires_at=now()-interval '1 hour' where used_at is null",
    );
    await expect(
      as(outsider, "select join_workspace($1,'Other')", [expired]),
    ).rejects.toThrow(/unavailable/);
    const revoked = (
      await as(userA, "select invite_workspace($1)as code", [scope])
    ).rows[0]!.code;
    await as(userA, "select manage_workspace($1,'revoke_invites')", [scope]);
    await expect(
      as(outsider, "select join_workspace($1,'Other')", [revoked]),
    ).rejects.toThrow(/unavailable/);
    await db.query("delete from auth.users where id=$1", [userB]);
    expect(
      (await as(userA, "select managed_by,shares from workspace_subscriptions"))
        .rows[0],
    ).toEqual({
      managed_by: userA,
      shares: [{ userId: userA, amountMinor: 1099 }],
    });
    await as(userA, "select manage_workspace($1,'delete_workspace')", [scope]);
    expect(
      (await db.query("select * from workspace_subscriptions")).rows,
    ).toEqual([]);
  } finally {
    await db.close();
  }
}, 30000);
