import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
let db: PGlite;
const a = randomUUID(),
  b = randomUUID();
const wallet = {
  id: randomUUID(),
  name: "Everyday",
  kind: "card",
  lastFour: "1234",
  archived: false,
};
const transaction = {
  id: randomUUID(),
  merchant: "Music",
  amountMinor: 999,
  currency: "USD",
  date: "2026-10-14",
  kind: "charge",
  status: "settled",
  walletId: wallet.id,
  subscriptionId: null,
  source: "manual",
  createdAt: "2026-10-14T10:00:00Z",
};
const journal = { wallets: [wallet], transactions: [transaction] };
async function asUser(user: string, sql: string, params: unknown[] = []) {
  await db.exec(
    "set role authenticated; select set_config('request.jwt.claim.sub','" +
      user +
      "',false)",
  );
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role;",
  );
  await db.exec(
    readFileSync(
      new URL(
        "../../supabase/migrations/20261014111959_finance_journal.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.query("insert into auth.users values ($1),($2)", [a, b]);
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("finance journal database contract", () => {
  it("stores valid records and isolates owners", async () => {
    await asUser(
      a,
      "insert into finance_journals(user_id,data) values ($1,$2)",
      [a, JSON.stringify(journal)],
    );
    expect(
      (await asUser(b, "select * from finance_journals")).rows,
    ).toHaveLength(0);
    await expect(
      asUser(b, "insert into finance_journals(user_id,data) values ($1,$2)", [
        a,
        JSON.stringify(journal),
      ]),
    ).rejects.toThrow();
    expect(
      (
        await asUser(
          b,
          "update finance_journals set version=2 where user_id=$1 returning *",
          [a],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      asUser(a, "update finance_journals set user_id=$1,version=2", [b]),
    ).rejects.toThrow();
  });
  it("uses version comparisons to avoid overwriting another device", async () => {
    expect(
      (
        await asUser(
          a,
          "update finance_journals set version=2 where version=1 returning *",
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await asUser(
          a,
          "update finance_journals set version=2 where version=1 returning *",
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      asUser(a, "update finance_journals set version=7"),
    ).rejects.toThrow(/version/);
  });
  it("rejects sensitive payloads, forged imports, nulls and invalid money or dates", async () => {
    for (const data of [
      { ...journal, wallets: [{ ...wallet, cvv: "123" }] },
      { ...journal, wallets: [{ ...wallet, name: "4242 4242 4242 4242" }] },
      { ...journal, wallets: [{ ...wallet, kind: null }] },
      { ...journal, transactions: [{ ...transaction, source: "provider" }] },
      { ...journal, transactions: [{ ...transaction, date: "2026-02-30" }] },
      { ...journal, transactions: [{ ...transaction, amountMinor: 1.5 }] },
      { ...journal, transactions: [{ ...transaction, amountMinor: null }] },
      {
        ...journal,
        transactions: [{ ...transaction, walletId: randomUUID() }],
      },
    ])
      await expect(
        asUser(a, "update finance_journals set data=$1,version=3", [
          JSON.stringify(data),
        ]),
      ).rejects.toThrow();
  });
  it("cascades account deletion", async () => {
    await db.query("delete from auth.users where id=$1", [a]);
    expect(
      (await db.query("select * from finance_journals")).rows,
    ).toHaveLength(0);
  });
});
