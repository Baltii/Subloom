import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
let db: PGlite;
const a = randomUUID(),
  b = randomUUID(),
  sub = randomUUID(),
  wallet = {
    id: randomUUID(),
    name: "Bitcoin",
    address: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
  };
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
    "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,service_role;create table public.subscriptions(id uuid primary key,user_id uuid references auth.users on delete cascade);grant select on public.subscriptions to authenticated,service_role;alter table public.subscriptions enable row level security;create policy owned_sub on public.subscriptions for select to authenticated using(user_id=(select auth.uid()));",
  );
  for (const file of [
    "20261014111959_finance_journal.sql",
    "20261014113152_crypto_wallet_history.sql",
    "20261017095506_financial_record_cleanup.sql",
  ])
    await db.exec(
      readFileSync(
        new URL("../../supabase/migrations/" + file, import.meta.url),
        "utf8",
      ),
    );
  await db.query("insert into auth.users values($1),($2)", [a, b]);
  await db.query("insert into subscriptions values($1,$2)", [sub, a]);
}, 30000);
afterAll(async () => await db?.close());
it("isolates crypto metadata, protects network observations and verifies subscription ownership", async () => {
  const data = {
    wallets: [wallet],
    intentions: [
      { subscriptionId: sub, mode: "cancel", reviewDate: "2026-10-14" },
    ],
  };
  await asUser(a, "insert into crypto_journals(user_id,data) values($1,$2)", [
    a,
    JSON.stringify(data),
  ]);
  expect((await asUser(b, "select * from crypto_journals")).rows).toHaveLength(
    0,
  );
  await expect(
    asUser(b, "insert into crypto_journals(user_id,data) values($1,$2)", [
      b,
      JSON.stringify(data),
    ]),
  ).rejects.toThrow(/owned subscription/);
  await expect(
    asUser(a, "update crypto_journals set data=$1,version=2", [
      JSON.stringify({ ...data, wallets: [{ ...wallet, seed: "secret" }] }),
    ]),
  ).rejects.toThrow();
  await expect(
    asUser(a, "update crypto_journals set data=$1,version=2", [
      JSON.stringify({
        ...data,
        wallets: [
          {
            ...wallet,
            address:
              "bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3",
          },
        ],
      }),
    ]),
  ).rejects.toThrow(/cannot change/);
  await expect(
    asUser(a, "insert into crypto_address_history values($1,$2,$3,$4)", [
      a,
      wallet.id,
      wallet.address,
      JSON.stringify({ transactions: [] }),
    ]),
  ).rejects.toThrow(/permission denied/);
  await db.query("insert into crypto_address_history values($1,$2,$3,$4)", [
    a,
    wallet.id,
    wallet.address,
    JSON.stringify({ transactions: [] }),
  ]);
  expect(
    (await asUser(b, "select * from crypto_address_history")).rows,
  ).toHaveLength(0);
  await asUser(b, "insert into crypto_journals(user_id,data) values($1,$2)", [
    b,
    JSON.stringify({ wallets: [wallet], intentions: [] }),
  ]);
  await db.query("insert into crypto_address_history values($1,$2,$3,$4)", [
    b,
    wallet.id,
    wallet.address,
    JSON.stringify({ transactions: [] }),
  ]);
  await db.query("delete from subscriptions where id=$1", [sub]);
  const cleaned = (await asUser(a, "select data,version from crypto_journals"))
    .rows[0] as { data: { intentions: unknown[] }; version: number };
  expect(cleaned.data.intentions).toEqual([]);
  expect(cleaned.version).toBe(2);
  await expect(
    asUser(a, "update crypto_journals set version=2"),
  ).rejects.toThrow(/version conflict/);
  await asUser(a, "update crypto_journals set data=$1,version=3", [
    JSON.stringify({ wallets: [], intentions: [] }),
  ]);
  expect(
    (await asUser(a, "select * from crypto_address_history")).rows,
  ).toHaveLength(0);
  await expect(
    db.query("insert into crypto_address_history values($1,$2,$3,$4)", [
      a,
      wallet.id,
      wallet.address,
      JSON.stringify({ transactions: [] }),
    ]),
  ).rejects.toThrow(/unavailable/);
  await expect(
    asUser(a, "select private.prune_bitcoin_observations()"),
  ).rejects.toThrow(/permission denied/);
  await db.query("delete from auth.users where id=$1", [a]);
  expect(
    (
      await db.query("select * from crypto_address_history where user_id=$1", [
        a,
      ])
    ).rows,
  ).toHaveLength(0);
  expect(
    (await asUser(b, "select * from crypto_address_history")).rows,
  ).toHaveLength(1);
});
