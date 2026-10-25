import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

let db: PGlite;
async function role<T>(name: string, action: () => Promise<T>) {
  await db.exec("set role " + name);
  try {
    return await action();
  } finally {
    await db.exec("reset role");
  }
}
function insert(
  id: string = randomUUID(),
  kind = "idea",
  title = "Calendar search",
  message = "Please add a search option to the calendar.",
) {
  return db.query(
    "insert into public.app_feedback(id,kind,title,message,platform,app_version) values($1,$2,$3,$4,'web','1.8.0') returning id,status,reply_email",
    [id, kind, title, message],
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;",
  );
  await db.exec(
    readFileSync(
      new URL(
        "../../supabase/migrations/20261025133225_feedback_inbox.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        "../../supabase/migrations/20261025140948_feedback_email_delivery.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("private feedback inbox in PostgreSQL", () => {
  it("allows backend review and status updates with optional contact details", async () => {
    await role("service_role", async () => {
      const id = randomUUID();
      expect((await insert(id)).rows).toEqual([
        { id, status: "new", reply_email: null },
      ]);
      await db.query(
        "update public.app_feedback set status='planned' where id=$1",
        [id],
      );
      expect(
        (
          await db.query("select status from public.app_feedback where id=$1", [
            id,
          ])
        ).rows,
      ).toEqual([{ status: "planned" }]);
    });
  });
  it("blocks guests and signed-in clients from reading or writing any submissions", async () => {
    for (const name of ["anon", "authenticated"])
      await role(name, async () => {
        await expect(
          db.query("select * from public.app_feedback"),
        ).rejects.toThrow(/permission denied/);
        await expect(insert()).rejects.toThrow(/permission denied/);
        await expect(
          db.exec("update public.app_feedback set status='closed'"),
        ).rejects.toThrow(/permission denied/);
        await expect(
          db.exec("delete from public.app_feedback"),
        ).rejects.toThrow(/permission denied/);
      });
  });
  it("keeps RLS as a second barrier even if a client read grant is added", async () => {
    await db.exec("grant select on public.app_feedback to authenticated");
    try {
      await role("authenticated", async () => {
        expect(
          (await db.query("select * from public.app_feedback")).rows,
        ).toEqual([]);
      });
    } finally {
      await db.exec("revoke select on public.app_feedback from authenticated");
    }
  });
  it("rejects invalid content and prevents duplicate requests from overwriting the original", async () => {
    for (const args of [
      [randomUUID(), "forged"],
      [randomUUID(), "idea", " "],
      [randomUUID(), "idea", "valid title", "tiny"],
      [randomUUID(), "idea", "a".repeat(121)],
    ] as const)
      await expect(insert(...args)).rejects.toThrow(/check constraint/);
    const id = randomUUID();
    await insert(id);
    await expect(insert(id, "problem", "Overwrite attempt")).rejects.toThrow(
      /unique constraint/,
    );
    expect(
      (
        await db.query("select title from public.app_feedback where id=$1", [
          id,
        ])
      ).rows,
    ).toEqual([{ title: "Calendar search" }]);
  });
});

describe("feedback email outbox", () => {
  it("only permits server workers to claim queued email", async () => {
    for (const name of ["anon", "authenticated"])
      await role(name, async () => {
        await expect(
          db.query("select * from public.claim_feedback_emails(1,null)"),
        ).rejects.toThrow(/permission denied/);
      });
  });
  it("leases each message once, reclaims expired work and excludes sent feedback", async () => {
    const id = randomUUID();
    await insert(id);
    await role("service_role", async () => {
      const first = (
        await db.query<{ email_lease_token: string; email_attempts: number }>(
          "select * from public.claim_feedback_emails(1,$1)",
          [id],
        )
      ).rows[0]!;
      expect(first.email_attempts).toBe(1);
      expect(
        (
          await db.query("select * from public.claim_feedback_emails(1,$1)", [
            id,
          ])
        ).rows,
      ).toHaveLength(0);
      await db.query(
        "update public.app_feedback set email_lease_until=now()-interval '1 second' where id=$1",
        [id],
      );
      const retry = (
        await db.query<{ email_lease_token: string; email_attempts: number }>(
          "select * from public.claim_feedback_emails(1,$1)",
          [id],
        )
      ).rows[0]!;
      expect(retry.email_attempts).toBe(2);
      expect(retry.email_lease_token).not.toBe(first.email_lease_token);
      expect(
        (
          await db.query(
            "update public.app_feedback set email_sent_at=now() where id=$1 and email_lease_token=$2 returning id",
            [id, first.email_lease_token],
          )
        ).rows,
      ).toHaveLength(0);
      await db.query(
        "update public.app_feedback set email_sent_at=now() where id=$1 and email_lease_token=$2",
        [id, retry.email_lease_token],
      );
      expect(
        (
          await db.query("select * from public.claim_feedback_emails(1,$1)", [
            id,
          ])
        ).rows,
      ).toHaveLength(0);
    });
  });
  it("bounds retries, respects backoff and avoids replay outside the provider deduplication window", async () => {
    for (const patch of [
      "email_attempts=8",
      "email_first_attempt_at=now()-interval '24 hours'",
      "email_next_attempt_at=now()+interval '1 hour'",
    ]) {
      const id = randomUUID();
      await insert(id);
      await db.query(
        "update public.app_feedback set " + patch + " where id=$1",
        [id],
      );
      await role("service_role", async () => {
        expect(
          (
            await db.query("select * from public.claim_feedback_emails(1,$1)", [
              id,
            ])
          ).rows,
        ).toHaveLength(0);
      });
    }
  });
});
