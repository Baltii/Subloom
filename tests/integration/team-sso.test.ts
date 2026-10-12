import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { it, expect } from "vitest";
import { userA, userB, subscription } from "../fixtures";
it("enforces team membership and signed SAML tenant claims on reads and every mutation", async () => {
  const db = new PGlite(),
    provider = randomUUID(),
    other = randomUUID(),
    outsider = randomUUID();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid(),auth.jwt()to anon,authenticated,service_role;",
    );
    for (const migration of [
      "202610090001_core.sql",
      "202610090002_ingestion.sql",
      "202610090004_contract_validation.sql",
      "202610110003_workspaces.sql",
      "202610110005_team_sso.sql",
    ])
      await db.exec(
        readFileSync(
          new URL("../../supabase/migrations/" + migration, import.meta.url),
          "utf8",
        ),
      );
    await db.query("insert into auth.users(id)values($1),($2),($3)", [
      userA,
      userB,
      outsider,
    ]);
    const saml = (p = provider) => ({
      amr: [{ method: "totp" }, { method: "sso/saml", provider: p }],
    });
    async function as(
      user: string,
      claims: unknown,
      sql: string,
      params: unknown[] = [],
    ) {
      await db.exec("set role authenticated");
      await db.query(
        "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
        [user, JSON.stringify(claims)],
      );
      try {
        return await db.query<Record<string, unknown>>(sql, params);
      } finally {
        await db.exec("reset role");
      }
    }
    await expect(
      as(
        userA,
        { amr: [{ method: "otp" }], user_metadata: { iss: provider } },
        "select create_team_workspace('Team','Owner')",
      ),
    ).rejects.toThrow(/SSO/);
    const scope = (
      await as(
        userA,
        saml(),
        "select create_team_workspace('Team','Owner')as id",
      )
    ).rows[0]!.id;
    expect(
      (await as(userA, saml(), "select * from workspaces")).rows,
    ).toHaveLength(1);
    expect(
      (await as(userA, saml(other), "select * from workspaces")).rows,
    ).toEqual([]);
    expect(
      (await as(outsider, saml(), "select * from workspaces")).rows,
    ).toEqual([]);
    const code = (
      await as(userA, saml(), "select invite_workspace($1)as code", [scope])
    ).rows[0]!.code;
    await expect(
      as(userB, saml(other), "select join_workspace($1,'Member')", [code]),
    ).rejects.toThrow(/SSO/);
    await expect(
      as(
        userB,
        { amr: [{ method: "otp" }], user_metadata: { iss: provider } },
        "select join_workspace($1,'Member')",
        [code],
      ),
    ).rejects.toThrow(/SSO/);
    await as(userB, saml(), "select join_workspace($1,'Member')", [code]);
    expect(
      (await as(userB, saml(), "select * from workspaces")).rows,
    ).toHaveLength(1);
    const data = subscription({ id: randomUUID() }),
      shares = JSON.stringify([
        { userId: userA, amountMinor: data.amountMinor },
      ]),
      saveArgs = [scope, JSON.stringify(data), userA, shares];
    await as(
      userA,
      saml(),
      "select save_workspace_subscription($1,$2,$3,$4,0)",
      saveArgs,
    );
    expect(
      (await as(userB, saml(), "select * from workspace_subscriptions")).rows,
    ).toHaveLength(1);
    expect(
      (await as(userB, saml(other), "select * from workspace_subscriptions"))
        .rows,
    ).toEqual([]);
    for (const claims of [{ amr: [{ method: "otp" }] }, saml(other)]) {
      await expect(
        as(userA, claims, "select invite_workspace($1)", [scope]),
      ).rejects.toThrow(/SSO/);
      await expect(
        as(
          userA,
          claims,
          "select save_workspace_subscription($1,$2,$3,$4,1)",
          saveArgs,
        ),
      ).rejects.toThrow(/SSO/);
      await expect(
        as(userA, claims, "select manage_workspace($1,'delete_workspace')", [
          scope,
        ]),
      ).rejects.toThrow(/SSO/);
    }
    await expect(
      as(
        userA,
        saml(),
        "select manage_workspace_internal($1,'delete_workspace')",
        [scope],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(userB, saml(), "select manage_workspace($1,'delete_workspace')", [
        scope,
      ]),
    ).rejects.toThrow(/Owner/);
    const family = (
      await as(userA, {}, "select create_workspace('Family','Owner')as id")
    ).rows[0]!.id;
    const invite = (
      await as(userA, {}, "select invite_workspace($1)as code", [family])
    ).rows[0]!.code;
    await as(outsider, {}, "select join_workspace($1,'Family member')", [
      invite,
    ]);
    expect(
      (await as(outsider, {}, "select * from workspaces")).rows,
    ).toHaveLength(1);
    await as(userA, saml(), "select manage_workspace($1,'delete_workspace')", [
      scope,
    ]);
    expect(
      (await db.query("select * from workspace_subscriptions")).rows,
    ).toEqual([]);
  } finally {
    await db.close();
  }
}, 30000);
