import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
it("public reference rates are read-only and the latest view preserves decimal strings", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;",
    );
    await db.exec(
      readFileSync(
        new URL(
          "../../supabase/migrations/20261014112614_exchange_rates.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      "insert into exchange_rates values('USD','TND',3.012345678901,'2026-10-13',now(),'frankfurter'),('USD','TND',3.123456789012,'2026-10-14',now(),'frankfurter')",
    );
    await db.exec("set role anon");
    expect(
      (await db.query("select rate,as_of::text from latest_exchange_rates")).rows[0],
    ).toMatchObject({ rate: "3.123456789012", as_of: "2026-10-14" });
    await expect(
      db.exec(
        "insert into exchange_rates values('USD','EUR',1,'2026-10-14',now(),'frankfurter')",
      ),
    ).rejects.toThrow(/permission denied/);
    await db.exec("reset role;set role authenticated");
    await expect(db.exec("delete from exchange_rates")).rejects.toThrow(
      /permission denied/,
    );
  } finally {
    await db.close();
  }
}, 30000);
