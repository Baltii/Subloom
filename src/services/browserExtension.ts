import { Platform } from "react-native";
import { browserRenewals } from "../domain/browserRenewals";
import { useApp } from "../store/app";
import { appLock } from "./appLock";

export function installBrowserExtensionBridge() {
  if (Platform.OS !== "web" || window.top !== window) return;

  const receive = (event: MessageEvent) => {
    if (event.source !== window || event.origin !== window.location.origin)
      return;
    const { type, requestId } = event.data ?? {};
    if (
      type !== "subloom:extension:request" ||
      typeof requestId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(requestId)
    )
      return;

    const lock = appLock.state.getState();
    const state = useApp.getState();
    let payload;
    try {
      if (!lock.ready || !state.hydrated) payload = { status: "loading" };
      else if (!lock.unlocked) payload = { status: "locked" };
      else if (state.data.demo) payload = { status: "demo" };
      else payload = { status: "ready", ...browserRenewals(state.data) };
    } catch {
      payload = { status: "error" };
    }

    window.postMessage(
      { type: "subloom:extension:response", requestId, payload },
      window.location.origin,
    );
  };

  window.addEventListener("message", receive);
  return () => window.removeEventListener("message", receive);
}
