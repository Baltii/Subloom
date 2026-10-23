import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
const profile = mkdtempSync(resolve(tmpdir(), "subloom-windows-smoke-"));
try {
  for (const mode of ["write", "read"]) {
    const result = spawnSync(
      resolve("build/windows/win-unpacked/Subloom.exe"),
      [`--smoke-test=${mode}`],
      {
        env: { ...process.env, SUBLOOM_SMOKE_USER_DATA: profile },
        stdio: "inherit",
        timeout: 60000,
      },
    );
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(`Packaged Windows ${mode} test exited ${result.status}`);
    console.log(
      `PASS packaged Windows rendering, isolation, routes, storage, OAuth recovery and notification IPC (${mode})`,
    );
  }
} finally {
  rmSync(profile, { recursive: true, force: true });
}
