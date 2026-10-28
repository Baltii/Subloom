import { useEffect, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import { lockStorageKey } from "../../domain/appLock";
import { appLock, useAppLock } from "../../services/appLock";
import { LockScreen } from "./LockScreen";

export function AppLockGate({ children }: { children: ReactNode }) {
  const ready = useAppLock((s) => s.ready),
    unlocked = useAppLock((s) => s.unlocked);
  const loadError = useAppLock((s) => s.error);
  const lockRevision = useAppLock((s) => s.lockRevision);
  useEffect(() => {
    void appLock.initialize();
  }, []);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (next) => {
      if (next !== "active") appLock.lock();
    });
    if (Platform.OS !== "web") return () => listener.remove();
    const hide = () => {
      if (document.visibilityState === "hidden") appLock.lock();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === lockStorageKey || event.key === null)
        void appLock.initialize();
    };
    // Native shells dispatch this when the app deactivates (including minimizing).
    const deactivate = () => appLock.lock();
    const pageHide = () => appLock.lock();
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("storage", storage);
    window.addEventListener("subloom:background", deactivate);
    window.addEventListener("pagehide", pageHide);
    return () => {
      listener.remove();
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("storage", storage);
      window.removeEventListener("subloom:background", deactivate);
      window.removeEventListener("pagehide", pageHide);
    };
  }, []);
  if (ready && unlocked) return children;
  // Protected routes and their native modals never mount before verification.
  return (
    <LockScreen
      key={ready ? "ready:" + lockRevision : "loading"}
      ready={ready}
      loadError={loadError}
    />
  );
}
