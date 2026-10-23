// Local reminders run only while the desktop process is alive. Store consent,
// never subscription content, and discard the old owner's alerts on activation.
function safePath(value) {
  return (
    typeof value === "string" &&
    (value === "/settings" ||
      value === "/" ||
      /^\/subscription\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      ))
  );
}
function createNotificationBroker({
  supported,
  show,
  loadConsent,
  saveConsent,
  now = Date.now,
  schedule = setTimeout,
  unschedule = clearTimeout,
}) {
  let identity = null;
  let timers = new Map();
  let shown = new Set();
  let closeVisible = [];
  let enabled = false;
  const validIdentity = (value) =>
    value === "guest" ||
    (typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      ));
  const clear = () => {
    for (const timer of timers.values()) unschedule(timer);
    timers.clear();
    for (const close of closeVisible) close();
    closeVisible = [];
  };
  const status = () => ({
    supported: supported(),
    enabled,
    pending: timers.size,
  });
  const requireOwner = (owner) => {
    if (!identity || owner !== identity)
      throw new Error(
        "Your workspace changed. Retry in the current workspace.",
      );
  };
  const deliver = async (request) => {
    const owner = identity;
    const close = await show(request, owner);
    if (owner !== identity || !enabled) close?.();
    else if (close) closeVisible.push(close);
  };
  return {
    activate(owner) {
      if (owner !== null && !validIdentity(owner))
        throw new Error("Invalid notification workspace.");
      if (owner !== identity) {
        clear();
        shown.clear();
        identity = owner;
        enabled = owner !== null && loadConsent(owner) === true;
      }
      return status();
    },
    enable(owner, value) {
      requireOwner(owner);
      if (typeof value !== "boolean")
        throw new Error("Invalid notification setting.");
      if (value && !supported())
        throw new Error(
          "System notifications are unavailable on this Windows installation.",
        );
      saveConsent(owner, value);
      enabled = value;
      clear();
      return status();
    },
    replace(owner, requests) {
      requireOwner(owner);
      if (!Array.isArray(requests) || requests.length > 48)
        throw new Error("Invalid reminder schedule.");
      const ids = new Set();
      for (const r of requests) {
        if (
          !r ||
          typeof r.id !== "string" ||
          !r.id ||
          r.id.length > 256 ||
          ids.has(r.id) ||
          typeof r.title !== "string" ||
          !r.title ||
          r.title.length > 256 ||
          typeof r.body !== "string" ||
          r.body.length > 2048 ||
          !safePath(r.path) ||
          typeof r.at !== "string" ||
          !Number.isFinite(Date.parse(r.at)) ||
          Date.parse(r.at) > now() + 367 * 86400000
        )
          throw new Error("Invalid reminder schedule.");
        ids.add(r.id);
      }
      // Validate the entire replacement before removing a valid schedule.
      clear();
      if (!enabled || !supported()) return status();
      for (const request of requests) {
        if (Date.parse(request.at) <= now() || shown.has(request.id)) continue;
        const arm = () => {
          const remaining = Date.parse(request.at) - now();
          if (remaining > 0) {
            timers.set(
              request.id,
              schedule(arm, Math.min(remaining, 2147483647)),
            );
            return;
          }
          timers.delete(request.id);
          if (remaining < -15 * 60000) return; // Avoid a burst after a long sleep.
          shown.add(request.id);
          void deliver(request).catch(() => {});
        };
        arm();
      }
      // Keep only IDs still in the planner's bounded window.
      shown = new Set([...shown].filter((id) => ids.has(id)));
      return status();
    },
    async test(owner) {
      requireOwner(owner);
      if (!enabled || !supported())
        throw new Error("Enable Windows notifications first.");
      await deliver({
        title: "Subloom",
        body: "Windows notifications are ready. Your reminders will appear here while Subloom is running.",
        path: "/settings",
      });
    },
    currentOwner: () => identity,
    dispose: clear,
  };
}
module.exports = { createNotificationBroker };
