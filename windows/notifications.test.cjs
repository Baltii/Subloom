const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createNotificationBroker } = require("./notifications.cjs");
const owner = "10000000-0000-4000-8000-000000000001";
function fixture() {
  const calls = [],
    consent = new Map(),
    timers = new Map();
  let clock = Date.parse("2026-10-23T09:00:00Z"),
    next = 0,
    closed = 0;
  const broker = createNotificationBroker({
    supported: () => true,
    show: async (r, identity) => {
      calls.push({ ...r, identity });
      return () => closed++;
    },
    loadConsent: (id) => consent.get(id),
    saveConsent: (id, enabled) => consent.set(id, enabled),
    now: () => clock,
    schedule: (callback, delay) => {
      const id = ++next;
      timers.set(id, { callback, delay });
      return id;
    },
    unschedule: (id) => timers.delete(id),
  });
  const advance = async (ms) => {
    clock += ms;
    const due = [...timers.values()];
    timers.clear();
    due.forEach((t) => t.callback());
    await Promise.resolve();
    await Promise.resolve();
  };
  return { broker, calls, consent, timers, advance, closed: () => closed };
}
const reminder = (extra = {}) => ({
  id: "renewal-1",
  title: "Renewal",
  body: "Private reminder",
  path: "/subscription/" + owner,
  at: "2026-10-23T09:01:00Z",
  ...extra,
});
test("Windows reminders require local consent and only fire once", async () => {
  const f = fixture();
  f.broker.activate("guest");
  assert.equal(f.broker.replace("guest", [reminder()]).pending, 0);
  f.broker.enable("guest", true);
  assert.equal(f.broker.replace("guest", [reminder()]).pending, 1);
  await f.advance(60000);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].identity, "guest");
  assert.equal(f.broker.replace("guest", [reminder()]).pending, 0);
});
test("workspace switches and disabling revoke timers and visible alerts", async () => {
  const f = fixture();
  f.broker.activate(owner);
  f.broker.enable(owner, true);
  f.broker.replace(owner, [reminder()]);
  f.broker.activate("guest");
  assert.equal(f.timers.size, 0);
  assert.throws(() => f.broker.replace(owner, []), /workspace changed/);
  assert.equal(f.broker.activate(owner).enabled, true);
  await f.broker.test(owner);
  f.broker.enable(owner, false);
  assert.equal(f.closed(), 1);
  assert.equal(f.consent.get(owner), false);
  await assert.rejects(f.broker.test(owner), /Enable Windows/);
});
test("rejects unsafe schedules atomically and bounds long timer delays", () => {
  const f = fixture();
  f.broker.activate(owner);
  f.broker.enable(owner, true);
  f.broker.replace(owner, [reminder()]);
  for (const change of [
    { path: "https://evil.test" },
    { at: "invalid" },
    { title: "" },
    { path: "/subscription/invalid" },
  ]) {
    assert.throws(() => f.broker.replace(owner, [reminder(change)]), /Invalid/);
    assert.equal(f.timers.size, 1);
  }
  assert.throws(
    () => f.broker.replace(owner, Array(49).fill(reminder())),
    /Invalid/,
  );
  f.broker.replace(owner, [reminder({ at: "2027-09-01T09:00:00Z" })]);
  assert.equal([...f.timers.values()][0].delay, 2147483647);
});
test("long sleep skips stale alerts and test failures remain visible to the caller", async () => {
  const f = fixture();
  f.broker.activate(owner);
  f.broker.enable(owner, true);
  f.broker.replace(owner, [reminder()]);
  await f.advance(3600000);
  assert.equal(f.calls.length, 0);
  const broken = createNotificationBroker({
    supported: () => true,
    loadConsent: () => true,
    saveConsent: () => {},
    show: async () => {
      throw new Error("Windows rejected the toast");
    },
  });
  broken.activate(owner);
  await assert.rejects(broken.test(owner), /rejected/);
});
