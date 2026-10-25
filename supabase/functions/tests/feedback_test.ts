import { type admin, endpoint } from "../_shared/http.ts";
import { feedbackNetworkKey, receiveFeedback } from "../_shared/feedback.ts";

function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
const input = () => ({
  id: crypto.randomUUID(),
  kind: "idea",
  title: "Calendar search",
  message: "Please add search to the calendar view.",
  replyEmail: null,
  platform: "web",
  appVersion: "1.8.0",
});
function fixture() {
  const rows = new Map<string, Record<string, unknown>>();
  const limits: string[] = [];
  const state = { limited: false, failure: false, notificationFailure: false };
  const notifications: string[] = [];
  const client = {
    rpc: (
      name: string,
      args: { key: string; maximum: number; window_seconds: number },
    ) => {
      assert(name === "take_rate_limit");
      assert(args.maximum > 0 && args.window_seconds > 0);
      limits.push(args.key);
      return Promise.resolve({ data: !state.limited, error: null });
    },
    from: (name: string) => {
      assert(name === "app_feedback");
      return {
        upsert: (
          row: Record<string, unknown>,
          options: { onConflict: string; ignoreDuplicates: boolean },
        ) => {
          assert(options.onConflict === "id" && options.ignoreDuplicates);
          if (!state.failure && !rows.has(String(row.id))) {
            rows.set(String(row.id), row);
          }
          return Promise.resolve({
            error: state.failure ? { message: "database unavailable" } : null,
          });
        },
      };
    },
  } as unknown as ReturnType<typeof admin>;
  const handler = endpoint((req) =>
    receiveFeedback(req, client, "test-server-key", async (id) => {
      notifications.push(id);
      if (state.notificationFailure) {
        throw new Error("Email provider unavailable");
      }
    })
  );
  const request = (body: unknown) =>
    handler(
      new Request("https://test.invalid/submit-feedback", {
        method: "POST",
        headers: {
          "cf-connecting-ip": "203.0.113.1",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    );
  return { rows, limits, state, handler, request, notifications };
}
Deno.test("guest feedback persists privately, returns an acknowledgement and makes retries idempotent", async () => {
  const f = fixture(), body = input();
  const first = await f.request(body);
  assert(first.status === 200);
  const result = await first.json();
  assert(result.accepted === true && result.id === body.id);
  const retry = await f.request({ ...body, title: "A retry cannot overwrite" });
  assert(retry.status === 200 && f.rows.size === 1);
  assert(f.rows.get(body.id)?.title === body.title);
  assert(f.rows.get(body.id)?.reply_email === null);
  assert(!JSON.stringify([...f.rows.values()]).includes("203.0.113.1"));
  assert(f.limits.length === 6);
  assert(first.headers.get("Cache-Control") === "no-store");
  assert(f.notifications.length === 2 && f.notifications[0] === body.id);
});
Deno.test("a failed immediate email leaves accepted feedback queued for the worker", async () => {
  const f = fixture();
  f.state.notificationFailure = true;
  const body = input();
  const response = await f.request(body);
  assert(response.status === 200 && (await response.json()).accepted);
  assert(f.rows.has(body.id) && f.notifications[0] === body.id);
});
Deno.test("feedback rejects invalid and oversized submissions before writing", async () => {
  const f = fixture();
  for (
    const patch of [
      { message: "tiny" },
      { replyEmail: "invalid" },
      { status: "planned" },
      { userId: crypto.randomUUID() },
      { subscriptions: [] },
    ]
  ) {
    assert((await f.request({ ...input(), ...patch })).status === 400);
  }
  assert(
    (await f.handler(
      new Request("https://test.invalid", { method: "POST", body: "{" }),
    )).status === 400,
  );
  assert(
    (await f.handler(
      new Request("https://test.invalid", {
        method: "POST",
        body: "x".repeat(20_001),
      }),
    )).status === 413,
  );
  assert(f.rows.size === 0 && f.limits.length === 0);
});
Deno.test("rate-limited and failed writes never report accepted feedback", async () => {
  const f = fixture();
  f.state.limited = true;
  assert((await f.request(input())).status === 429);
  f.state.limited = false;
  f.state.failure = true;
  const failed = await f.request(input());
  assert(failed.status === 503 && !(await failed.json()).accepted);
  assert(f.rows.size === 0);
  assert(
    (await f.handler(
      new Request("https://test.invalid", { method: "OPTIONS" }),
    )).status === 200,
  );
  assert((await f.handler(new Request("https://test.invalid"))).status === 405);
});
Deno.test("network rate keys are keyed hashes and ignore untrusted forwarded chains", async () => {
  const request = (headers: Record<string, string>) =>
    new Request("https://test.invalid", { headers });
  const a = await feedbackNetworkKey(
    request({ "cf-connecting-ip": "203.0.113.1", "x-forwarded-for": "forged" }),
    "key-a",
  );
  assert(/^[a-f0-9]{64}$/.test(a));
  assert(
    a ===
      await feedbackNetworkKey(
        request({ "cf-connecting-ip": "203.0.113.1" }),
        "key-a",
      ),
  );
  assert(
    a !==
      await feedbackNetworkKey(
        request({ "cf-connecting-ip": "203.0.113.1" }),
        "key-b",
      ),
  );
  assert(
    await feedbackNetworkKey(
      request({ "x-forwarded-for": "forged-a" }),
      "key-a",
    ) ===
      await feedbackNetworkKey(
        request({ "x-forwarded-for": "forged-b" }),
        "key-a",
      ),
  );
});
