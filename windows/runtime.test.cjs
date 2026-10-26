const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const {
  bundledFile,
  isAppURL,
  externalURL,
  createAuthBroker,
} = require("./runtime.cjs");

test("serves only bundled files, with SPA fallback and no filesystem escapes", () => {
  const root = mkdtempSync(path.join(tmpdir(), "subloom-assets-"));
  try {
    writeFileSync(path.join(root, "index.html"), "<html>Subloom</html>");
    writeFileSync(path.join(root, "app.js"), "console.log('Subloom')");
    assert.equal(
      bundledFile("subloom-app://bundle/app.js", root),
      path.join(root, "app.js"),
    );
    assert.equal(
      bundledFile(
        "subloom-app://bundle/subscription/example?tab=history",
        root,
      ),
      path.join(root, "index.html"),
    );
    for (const url of [
      "file:///etc/passwd",
      "https://bundle/app.js",
      "subloom-app://other/app.js",
      "subloom-app://user@bundle/app.js",
      "subloom-app://bundle:80/app.js",
      "subloom-app://bundle/missing.js",
      "subloom-app://bundle/.env",
      "subloom-app://bundle/%00",
      "subloom-app://bundle/%5cprivate",
      "subloom-app://bundle/%2f..%2fprivate",
      "subloom-app://bundle/%zz",
    ])
      assert.equal(bundledFile(url, root), null, url);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("only HTTPS links can leave the app and only the bundled origin receives the bridge", () => {
  assert.equal(
    externalURL("https://example.com/help"),
    "https://example.com/help",
  );
  for (const url of [
    "file:///private",
    "javascript:alert(1)",
    "http://example.com",
    "ms-settings:privacy",
    "https://user:password@example.com",
    null,
  ])
    assert.equal(externalURL(url), null);
  assert.equal(isAppURL("subloom-app://bundle/settings"), true);
  assert.equal(isAppURL("subloom-app://bundle.evil/settings"), false);
});
test("browser auth returns only the pending callback to the original PKCE profile", async () => {
  const opened = [];
  const broker = createAuthBroker(async (url) => opened.push(url));
  assert.equal(
    broker.complete("subloom://auth-callback?code=unsolicited"),
    false,
  );
  const result = broker.open(
    "https://provider.test/authorize",
    "subloom://auth-callback",
  );
  await assert.rejects(
    broker.open("https://provider.test", "subloom://auth-callback"),
    /in progress/,
  );
  for (const url of [
    "subloom://mailboxes?code=wrong",
    "https://auth-callback?code=wrong",
    "subloom://auth-callback.evil?code=wrong",
    "subloom://auth-callback/extra?code=wrong",
    "subloom://user@auth-callback?code=wrong",
  ])
    assert.equal(broker.complete(url), false);
  assert.equal(broker.complete("subloom://auth-callback?code=fixture"), true);
  assert.equal(await result, "subloom://auth-callback?code=fixture");
  assert.deepEqual(opened, ["https://provider.test/authorize"]);
  assert.equal(broker.complete("subloom://auth-callback?code=replay"), false);
});
test("mailbox consent, cancellation, timeout and browser errors release pending auth", async () => {
  const broker = createAuthBroker(async () => {});
  const mailbox = broker.open("https://provider.test", "subloom://mailboxes");
  broker.complete("subloom://mailboxes?connected=gmail");
  assert.equal(await mailbox, "subloom://mailboxes?connected=gmail");
  const canceled = broker.open(
    "https://provider.test",
    "subloom://auth-callback",
  );
  broker.cancel();
  await assert.rejects(canceled, /canceled/);
  const timeout = createAuthBroker(async () => {}, 5);
  await assert.rejects(
    timeout.open("https://provider.test", "subloom://auth-callback"),
    /timed out/,
  );
  const failed = createAuthBroker(async () => {
    throw new Error("Browser unavailable");
  });
  await assert.rejects(
    failed.open("https://provider.test", "subloom://auth-callback"),
    /Could not open/,
  );
  await assert.rejects(
    broker.open("file:///private", "subloom://auth-callback"),
    /not supported/,
  );
  await assert.rejects(
    broker.open("https://provider.test", "subloom://untrusted"),
    /not supported/,
  );
});

test("pins Supabase OAuth to the app callback and accepts the browser's root slash", async () => {
  const opened = [];
  const broker = createAuthBroker(async (url) => opened.push(url));
  const result = broker.open(
    "https://project.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fwebsite.test&code_challenge=fixture",
    "subloom://auth-callback",
  );
  await Promise.resolve();
  await Promise.resolve();
  const target = new URL(opened[0]);
  assert.equal(
    target.searchParams.get("redirect_to"),
    "subloom://auth-callback",
  );
  assert.equal(target.searchParams.get("code_challenge"), "fixture");
  assert.equal(broker.complete("subloom://auth-callback/?code=windows"), true);
  assert.equal(await result, "subloom://auth-callback/?code=windows");
});

test("notification links open only known screens and never accept external destinations", () => {
  const { notificationLinkPath } = require("./runtime.cjs");
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  for (const route of [
    "/",
    "/settings",
    "/subscription/" + id,
    "/detection/" + id,
  ]) {
    assert.equal(
      notificationLinkPath("subloom://open?path=" + encodeURIComponent(route)),
      route,
    );
  }
  for (const url of [
    "https://evil.test/open?path=%2F",
    "subloom://auth-callback?path=%2F",
    "subloom://open?path=https://evil.test",
    "subloom://open?path=%2F%2Fevil.test",
    "subloom://user@open?path=%2F",
    "subloom://open?path=%2Fauth-callback",
    "subloom://open/extra?path=%2F",
    "subloom://open?path=%2F#bad",
  ])
    assert.equal(notificationLinkPath(url), null);
});
