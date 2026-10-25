import { expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { currencies } from "../../src/domain/models";
import { extractReceipt } from "../../src/domain/detection";
import { subscription, preferences, userA } from "../fixtures";

it("accepts all supported currencies across stored subscriptions, preferences, receipts, journals and rates", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
    );
    for (const migration of [
      "202610090001_core.sql",
      "202610090002_ingestion.sql",
      "202610090004_contract_validation.sql",
      "202610110003_workspaces.sql",
      "20261012183830_family_settlements.sql",
      "20261014111959_finance_journal.sql",
      "20261014112614_exchange_rates.sql",
      "20261025195158_expand_currencies.sql",
    ])
      await db.exec(
        readFileSync(
          new URL(`../../supabase/migrations/${migration}`, import.meta.url),
          "utf8",
        ),
      );
    await db.query(
      "insert into auth.users(id,email) values($1,'currency-test@example.test')",
      [userA],
    );
    for (const currency of currencies) {
      const s = subscription({ currency });
      const candidate = extractReceipt(
        `Netflix ${currency} 10 monthly`,
        "receipt",
      );
      const journal = {
        wallets: [],
        transactions: [
          {
            id: s.id,
            merchant: "Netflix",
            currency,
            amountMinor: 100,
            date: "2026-10-25",
            kind: "charge",
            status: "settled",
            source: "manual",
            walletId: null,
            subscriptionId: null,
            createdAt: s.createdAt,
          },
        ],
      };
      expect(
        (
          await db.query(
            "select public.validate_preferences($1) as preferences, public.validate_candidate($2) as candidate, private.valid_finance_journal($3) as journal",
            [
              JSON.stringify({ ...preferences(), currency }),
              JSON.stringify(candidate),
              JSON.stringify(journal),
            ],
          )
        ).rows[0],
      ).toEqual({ preferences: true, candidate: true, journal: true });
      await db.query(
        "insert into subscriptions(id,user_id,data,version) values($1,$2,$3,1)",
        [s.id, userA, JSON.stringify(s)],
      );
      await db.query("delete from subscriptions where id=$1", [s.id]);
      if (currency !== "USD")
        await db.query(
          "insert into exchange_rates values('USD',$1,1,'2026-10-25',now(),'frankfurter')",
          [currency],
        );
    }
    expect(
      (await db.query("select * from latest_exchange_rates")).rows,
    ).toHaveLength(55);
    await expect(
      db.exec(
        "insert into exchange_rates values('USD','ZZZ',1,'2026-10-25',now(),'frankfurter')",
      ),
    ).rejects.toThrow(/check constraint/);
    await db.exec("set role anon");
    expect(
      (await db.query("select * from latest_exchange_rates")).rows,
    ).toHaveLength(55);
    await expect(db.exec("delete from exchange_rates")).rejects.toThrow(
      /permission denied/,
    );
  } finally {
    await db.close();
  }
}, 30000);
