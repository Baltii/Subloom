import { newerVersion } from "../../updates/protocol.cjs";
import { version } from "../../package.json";
import { updateStateSchema } from "../domain/updates";
import { useUpdates, updateFailure } from "../store/updates";
import { hasUnsavedDrafts } from "../store/drafts";
import { flushPendingWrites } from "../store/app";
import { macosBridge, macosRequest } from "./macosBridge";
import { windowsBridge } from "./windowsBridge";

const accept = (state: unknown) =>
  useUpdates.setState(updateStateSchema.parse(state));
export function maintainAppUpdates() {
  const win = windowsBridge(),
    mac = macosBridge();
  useUpdates.setState({
    currentVersion: version,
    kind: mac ? "mac" : win?.updates ? "windows" : win ? "bootstrap" : "web",
  });
  if (win?.updates) {
    const off = win.updates.onState(accept);
    void win.updates
      .status()
      .then((state) => {
        accept(state);
        if (state.status === "idle") void checkAppUpdates();
      })
      .catch(updateFailure);
    return off;
  }
  if (mac) {
    const onState = (event: Event) => {
      const result = updateStateSchema.safeParse((event as CustomEvent).detail);
      if (result.success) accept(result.data);
    };
    globalThis.addEventListener("subloom-update-state", onState);
    void macosRequest("update.status")
      .then((state) => {
        accept(state);
        if (updateStateSchema.parse(state).status === "idle")
          void checkAppUpdates();
      })
      .catch(() =>
        useUpdates.setState({
          kind: "bootstrap",
          supported: false,
          status: "unavailable",
        }),
      );
    return () =>
      globalThis.removeEventListener("subloom-update-state", onState);
  }
  void checkAppUpdates();
  const onFocus = () => {
    void checkAppUpdates();
  };
  globalThis.addEventListener("focus", onFocus);
  return () => globalThis.removeEventListener("focus", onFocus);
}
let webCheck: Promise<void> | null = null;
async function checkWebUpdate() {
  if (webCheck) return webCheck;
  if (["available", "ready"].includes(useUpdates.getState().status)) return;
  webCheck = (async () => {
    useUpdates.setState({ status: "checking", error: null });
    const response = await fetch(`/app-version.json?t=${Date.now()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok)
      throw new Error(
        "Could not check for updates. Try again while connected.",
      );
    const latest = await response.json();
    if (typeof latest.version !== "string")
      throw new Error("Update information is unavailable. Try again later.");
    const available = newerVersion(latest.version, version);
    useUpdates.setState({
      status: available ? "available" : "current",
      availableVersion: available ? latest.version : null,
    });
  })().finally(() => {
    webCheck = null;
  });
  return webCheck;
}
export async function checkAppUpdates() {
  try {
    if (macosBridge()) accept(await macosRequest("update.check"));
    else if (windowsBridge()?.updates)
      accept(await windowsBridge()!.updates!.check());
    else if (useUpdates.getState().kind === "web") await checkWebUpdate();
  } catch (error) {
    updateFailure(error);
  }
}
export async function downloadAppUpdate() {
  await installAppUpdate();
}
export async function installAppUpdate() {
  if (hasUnsavedDrafts())
    throw new Error("Save or discard your open changes before updating.");
  await flushPendingWrites();
  if (macosBridge()) await macosRequest("update.install");
  else if (windowsBridge()?.updates) await windowsBridge()!.updates!.install();
  else if (useUpdates.getState().kind === "web") globalThis.location.reload();
}
export async function openUpdateInstallSettings() {}
