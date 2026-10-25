import { createContext, useContext, useEffect, useState } from "react";
import { useApp } from "../store/app";
import { usePro, workspaceHasPro } from "../store/pro";
import { PRO_PLAN_ENABLED } from "../domain/planMode";

export type ProFeature =
  | "CSV import & export"
  | "Mailbox discovery"
  | "Statement imports"
  | "Transaction exports"
  | "More cards & wallets"
  | "More subscriptions";
export const ProAccessContext = createContext<(feature: ProFeature) => void>(
  () => {},
);

/** Re-render at license expiry, and always re-check entitlement when acting. */
export function useProAccess() {
  const open = useContext(ProAccessContext);
  const identity = useApp((state) => state.identity);
  const billing = usePro();
  const [, tick] = useState(0);
  useEffect(() => {
    const remaining = billing.offlineUntil - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(
      () => tick((value) => value + 1),
      Math.min(remaining + 1, 2147483647),
    );
    return () => clearTimeout(timer);
  }, [billing.offlineUntil]);
  return {
    pro: workspaceHasPro(identity),
    requestPro(feature: ProFeature) {
      if (useApp.getState().identity !== identity) return false;
      if (workspaceHasPro(identity)) return true;
      open(feature);
      return false;
    },
    openPro(feature: ProFeature) {
      if (PRO_PLAN_ENABLED) open(feature);
    },
  };
}
