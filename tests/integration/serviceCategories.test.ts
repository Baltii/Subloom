import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";
import {
  categoryDefinitions,
  categoryAppearance,
} from "../../src/domain/categories";
import {
  categories,
  subscriptionSchema,
  customServiceSchema,
} from "../../src/domain/models";
import { personalServiceCatalog } from "../../src/domain/customServices";
import { subscription, userA } from "../fixtures";

it("saves every category through PostgreSQL and keeps custom service styling consistent", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
    );
    const directory = new URL("../../supabase/migrations/", import.meta.url);
    const expansion = readdirSync(directory).find((file) =>
      file.endsWith("_expand_service_categories.sql"),
    )!;
    for (const file of [
      "202610090001_core.sql",
      "202610090004_contract_validation.sql",
      expansion,
    ])
      await db.exec(readFileSync(new URL(file, directory), "utf8"));
    await db.query(
      "insert into auth.users(id,email) values($1,'categories@example.test')",
      [userA],
    );
    expect(categories.length).toBeGreaterThan(50);
    expect(new Set(categories).size).toBe(categories.length);
    expect(new Set(categoryDefinitions.map((item) => item.color)).size).toBe(
      categories.length,
    );
    expect(new Set(categoryDefinitions.map((item) => item.icon)).size).toBe(
      categories.length,
    );
    for (const category of categories) {
      const row = subscriptionSchema.parse(subscription({ category }));
      const custom = customServiceSchema.parse({
        id: `custom:${row.id}`,
        name: "My service",
        category,
      });
      expect(personalServiceCatalog([custom])[0]).toMatchObject({
        color: categoryAppearance(category).color,
        background: categoryAppearance(category).background,
      });
      await db.query(
        "insert into subscriptions(id,user_id,data,version) values($1,$2,$3,1)",
        [row.id, userA, JSON.stringify(row)],
      );
      await db.query("delete from subscriptions where id=$1", [row.id]);
    }
    for (const patch of [
      { category: "Unknown category" },
      { name: "" },
      { startDate: "2026-02-30" },
      { amountMinor: -1 },
    ])
      expect(
        (
          await db.query("select public.validate_subscription($1) as valid", [
            JSON.stringify({ ...subscription(), ...patch }),
          ])
        ).rows[0],
      ).toEqual({ valid: false });
    // Replacing the function must retain its restricted execution permissions.
    await db.exec("set role anon");
    await expect(
      db.query("select public.validate_subscription($1)", [
        JSON.stringify(subscription()),
      ]),
    ).rejects.toThrow(/permission denied/);
  } finally {
    await db.close();
  }
}, 30000);
