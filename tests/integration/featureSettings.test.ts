import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { userA, userB } from "../fixtures";
describe("feature setting security", () => {
  it("isolates accounts, prevents blind writes and cascades deletes", async () => {
    const db = new PGlite();
    try {
      await db.exec(
        "create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema public,auth to authenticated; grant execute on function auth.uid() to authenticated;",
      );
      await db.exec(
        readFileSync(
          new URL(
            "../../supabase/migrations/202610110001_feature_settings.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      await db.query("insert into auth.users values($1),($2)", [userA, userB]);
      await db.exec("set role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        userA,
      ]);
      expect(
        (
          await db.query(
            "select save_feature_setting('budgets','[]',0) as version",
          )
        ).rows[0],
      ).toEqual({ version: 1 });
      await expect(
        db.query("select save_feature_setting('budgets','[]',0)"),
      ).rejects.toThrow(/conflict/);
      await expect(db.query("delete from feature_settings")).rejects.toThrow(
        /permission denied/,
      );
      await expect(
        db.query("select save_feature_setting('unknown','[]',0)"),
      ).rejects.toThrow();
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        userB,
      ]);
      expect((await db.query("select * from feature_settings")).rows).toEqual(
        [],
      );
      expect(
        (
          await db.query(
            "select save_feature_setting('budgets','[]',0) as version",
          )
        ).rows[0],
      ).toEqual({ version: 1 });
      await db.exec("reset role");
      await db.query("delete from auth.users where id=$1", [userA]);
      expect(
        (await db.query("select user_id from feature_settings")).rows,
      ).toEqual([{ user_id: userB }]);
    } finally {
      await db.close();
    }
  }, 30000);
});
