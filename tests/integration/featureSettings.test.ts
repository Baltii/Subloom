import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { userA, userB } from "../fixtures";
import { buildBillingMethod } from "../../src/domain/billingMethods";
import { paymentProfileSchema } from "../../src/domain/payments";
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
      const directory = new URL("../../supabase/migrations/", import.meta.url);
      for (const file of readdirSync(directory)
        .sort()
        .filter((name) =>
          /_(payment_sources|subscription_radar|cancellation_watch|renewal_autopilot|virtual_card_plans|renewal_reserve|value_coach)\.sql$/.test(
            name,
          ),
        ))
        await db.exec(readFileSync(new URL(file, directory), "utf8"));
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
      const billingProfile = {
        sources: [
          buildBillingMethod(
            {
              kind: "card",
              cardBrand: "Mastercard",
              walletProvider: "PayPal",
              last4: "0042",
              nickname: "Daily",
            },
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            "2026-10-19T20:00:00Z",
          ),
        ],
        links: [],
      };
      await db.query(
        "select save_feature_setting('payment_sources',$1::jsonb,0)",
        [JSON.stringify(billingProfile)],
      );
      const stored = await db.query<{ data: unknown }>(
        "select data from feature_settings where key='payment_sources'",
      );
      expect(paymentProfileSchema.parse(stored.rows[0]!.data)).toEqual(
        billingProfile,
      );
      await expect(
        db.query("select save_feature_setting('payment_sources','{}',0)"),
      ).rejects.toThrow(/conflict/);
      await db.query(
        "select save_feature_setting('payment_transactions','[]',0)",
      );
      await expect(
        db.query("select save_feature_setting('payment_transactions','[]',0)"),
      ).rejects.toThrow(/conflict/);
      await db.query(
        "select save_feature_setting('cancellation_watch','[]',0)",
      );
      const constraint = (
        await db.query<{ definition: string }>(
          "select pg_get_constraintdef(oid) as definition from pg_constraint where conname='feature_settings_key_check'",
        )
      ).rows[0]!.definition;
      for (const key of [
        "autopilot",
        "virtual_plans",
        "reserve",
        "coach",
      ].filter((key) => constraint.includes("'" + key + "'"))) {
        await db.query("select save_feature_setting($1,'{}',0)", [key]);
        await expect(
          db.query("select save_feature_setting($1,'{}',0)", [key]),
        ).rejects.toThrow(/conflict/);
      }
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
