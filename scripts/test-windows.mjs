import { execFileSync, spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

if (process.platform !== "win32")
  throw new Error("Run installer tests on Windows.");
const root = mkdtempSync(resolve(tmpdir(), "subloom-installer-test-"));
const profile = resolve(root, "profile"),
  installation = resolve(root, "installed");
const installers = readdirSync("build/windows").filter((name) =>
  name.endsWith("-setup.exe"),
);
if (installers.length !== 1) throw new Error("Expected one Windows installer.");
const installer = resolve("build/windows", installers[0]);
const executable = resolve(installation, "Subloom.exe");
mkdirSync(profile);
let running;
function install(expected = 0) {
  // NSIS requires /D= to be the last argument. Runner temp paths have no spaces.
  const result = spawnSync(installer, ["/S", `/D=${installation}`], {
    stdio: "inherit",
    timeout: 120000,
  });
  if (result.error) throw result.error;
  if (result.status !== expected)
    throw new Error(`Installer exited ${result.status}, expected ${expected}`);
}
function smoke(mode) {
  const result = spawnSync(executable, [`--smoke-test=${mode}`], {
    env: { ...process.env, SUBLOOM_SMOKE_USER_DATA: profile },
    stdio: "inherit",
    timeout: 60000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Installed Windows ${mode} check exited ${result.status}`);
  console.log(
    `PASS installed app rendering, isolation, routes and guest persistence (${mode})`,
  );
}
function stopTestApp() {
  if (running?.exitCode === null)
    execFileSync("taskkill", ["/PID", String(running.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  running = undefined;
}
try {
  install();
  if (!existsSync(executable))
    throw new Error("Installer did not create Subloom.exe.");
  console.log("PASS fresh silent install");
  smoke("write");
  smoke("read");
  install();
  console.log("PASS reinstall with the app closed");
  smoke("read");
  running = spawn(executable, ["--smoke-test=hold"], {
    env: { ...process.env, SUBLOOM_SMOKE_USER_DATA: profile },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await new Promise((accept, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Test app did not start.")),
      30000,
    );
    running.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    running.once("exit", () => {
      clearTimeout(timer);
      reject(new Error("Test app exited before installation check."));
    });
    running.stdout.on("data", (data) => {
      if (data.toString().includes("SUBLOOM_SMOKE_READY")) {
        clearTimeout(timer);
        accept();
      }
    });
  });
  install(2);
  console.log(
    "PASS silent installer refuses a genuinely running Subloom process",
  );
  const exited = once(running, "exit");
  stopTestApp();
  await exited;
  install();
  smoke("read");
  console.log(
    "PASS reinstall after closing the app, preserving the guest workspace",
  );
} finally {
  stopTestApp();
  const uninstaller = resolve(installation, "Uninstall Subloom.exe");
  if (existsSync(uninstaller)) {
    const result = spawnSync(uninstaller, ["/S", `_?=${installation}`], {
      stdio: "inherit",
      timeout: 60000,
    });
    if (result.error || result.status !== 0)
      throw new Error("Could not remove the test installation.");
  }
  rmSync(root, { recursive: true, force: true });
}
