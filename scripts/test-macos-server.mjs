import { strict as assert } from "node:assert";
import { request } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";

const checks = [];
function get(path, method = "GET", host = "127.0.0.1:48187") {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: "127.0.0.1",
        port: 48187,
        path,
        method,
        headers: { Host: host },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks),
          }),
        );
      },
    );
    req.on("error", reject);
    req.setTimeout(10000, () =>
      req.destroy(new Error("Local test server timed out.")),
    );
    req.end();
  });
}
async function check(name, action) {
  try {
    await action();
    checks.push({ name, status: "passed" });
    console.log("PASS " + name);
  } catch (error) {
    checks.push({ name, status: "failed" });
    throw error;
  }
}
try {
  let html;
  await check("Bundled HTML and protective headers", async () => {
    const result = await get("/");
    assert.equal(result.status, 200);
    html = result.body.toString();
    assert(html.includes("<html"));
    assert.equal(result.headers["x-content-type-options"], "nosniff");
    assert.equal(result.headers["cache-control"], "no-store");
    assert.equal(result.headers["referrer-policy"], "no-referrer");
  });
  await check("Bundled JavaScript is served completely", async () => {
    const script = html.match(/src="([^"]+\.js)"/)[1];
    const result = await get(script);
    assert.equal(result.status, 200);
    assert.equal(result.headers["content-type"], "text/javascript");
    assert.equal(result.body.length, Number(result.headers["content-length"]));
    assert(result.body.length > 100000);
  });
  await check("Deep link returns the bundled interface", async () => {
    assert.equal((await get("/subscription/local-test")).body.toString(), html);
  });
  await check("HEAD serves headers without a body", async () => {
    const result = await get("/", "HEAD");
    assert.equal(result.status, 200);
    assert.equal(result.body.length, 0);
  });
  await check("Local server cannot accept writes", async () => {
    assert.equal((await get("/", "POST")).status, 403);
  });
  await check("Unexpected Host header is rejected", async () => {
    assert.equal((await get("/", "GET", "example.com")).status, 403);
  });
  await check("Traversal and malformed paths are rejected", async () => {
    for (const path of [
      "/../macos/Info.plist",
      "/%2e%2e/Info.plist",
      "/%00",
      "/%5cInfo.plist",
      "/%zz",
    ]) {
      assert.equal((await get(path)).status, 400);
    }
  });
  await check("Unbundled files are unavailable", async () => {
    for (const path of ["/.env.local", "/macos/Info.plist", "/missing.js"])
      assert.equal((await get(path)).status, 404);
  });
} finally {
  mkdirSync("docs/verification", { recursive: true });
  writeFileSync(
    "docs/verification/macos-server.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        scope:
          "Running sandboxed Mac app loopback asset server; no cloud requests or workspace mutation.",
        checks,
      },
      null,
      2,
    ) + "\n",
  );
}
