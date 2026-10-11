import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
import { userA, userB } from "../fixtures";
it("protects mailbox credentials and handles OAuth replay, expiry, disconnect and scan leases", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,service_role;grant execute on function auth.uid()to authenticated,service_role;",
    );
    await db.exec(
      readFileSync(
        new URL(
          "../../supabase/migrations/202610110004_mailbox_connections.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.query("insert into auth.users values($1),($2)", [userA, userB]);
    await db.exec("set role service_role");
    const result = (
      await db.query<{ result: { id: string; generation: number } }>(
        "select begin_mailbox_connection($1,'gmail','hash-1','sealed-verifier','web')as result",
        [userA],
      )
    ).rows[0]!.result;
    const args = [result.id, result.generation];
    await db.query("select claim_mailbox_oauth('hash-1')");
    await expect(
      db.query("select claim_mailbox_oauth('hash-1')"),
    ).rejects.toThrow(/used/);
    await db.query(
      "select finish_mailbox_connection($1,$2,'sealed-tokens')",
      args,
    );
    await db.query("select claim_mailbox_scan($1,'gmail')", [userA]);
    await expect(
      db.query("select claim_mailbox_scan($1,'gmail')", [userA]),
    ).rejects.toThrow(/progress/);
    await db.exec("reset role;set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      userB,
    ]);
    expect((await db.query("select * from mailbox_connections")).rows).toEqual(
      [],
    );
    await expect(db.query("select * from mailbox_credentials")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      db.query("select disconnect_mailbox($1,'gmail')", [userA]),
    ).rejects.toThrow(/permission denied/);
    await db.exec("reset role;set role service_role");
    await db.query("select disconnect_mailbox($1,'gmail')", [userA]);
    expect((await db.query("select * from mailbox_credentials")).rows).toEqual(
      [],
    );
    await expect(
      db.query("select store_mailbox_tokens($1,$2,'stale')", args),
    ).rejects.toThrow(/changed/);
    await expect(
      db.query("select finish_mailbox_connection($1,$2,'stale')", args),
    ).rejects.toThrow(/changed/);
    await db.query(
      "select begin_mailbox_connection($1,'gmail','hash-expired','verifier','web')",
      [userA],
    );
    await db.exec(
      "update mailbox_oauth_states set expires_at=now()-interval '1 minute'",
    );
    await expect(
      db.query("select claim_mailbox_oauth('hash-expired')"),
    ).rejects.toThrow(/expired/);
    await db.exec("reset role");
    await db.query("delete from auth.users where id=$1", [userA]);
    expect((await db.query("select * from mailbox_connections")).rows).toEqual(
      [],
    );
    expect((await db.query("select * from mailbox_oauth_states")).rows).toEqual(
      [],
    );
  } finally {
    await db.close();
  }
}, 30000);
