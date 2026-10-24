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
    void win.updates.status().then(accept).catch(updateFailure);
    return off;
  }
  if (mac) {
    const onState = (event: Event) => {
      const result = updateStateSchema.safeParse((event as CustomEvent).detail);
      if (result.success) accept(result.data);
    };
    globalThis.addEventListener("subloom-update-state", onState);
    void macosRequest("update.status")
      .then(accept)
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
  return () => {};
}
export async function checkAppUpdates() {
  try {
    if (macosBridge()) accept(await macosRequest("update.check"));
    else if (windowsBridge()?.updates)
      accept(await windowsBridge()!.updates!.check());
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
