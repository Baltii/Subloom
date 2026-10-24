import { create } from "zustand";
import type { ProTracking } from "../domain/proTracking";
export type ProSnapshot = {
  configured: boolean;
  pro: boolean;
  status: string;
  interval: "month" | "year" | null;
  accessUntil: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEligible: boolean;
  canManage: boolean;
  tracking?: ProTracking | null;
};
type ProState = {
  workspace: string | null;
  owner: string | null;
  email: string | null;
  ready: boolean;
  loading: boolean;
  offlineUntil: number;
  snapshot: ProSnapshot | null;
  error: string | null;
};
export const emptyPro: ProState = {
  workspace: null,
  owner: null,
  email: null,
  ready: false,
  loading: false,
  offlineUntil: 0,
  snapshot: null,
  error: null,
};
export const usePro = create<ProState>(() => ({ ...emptyPro }));
export function workspaceHasPro(workspace: string, now = Date.now()) {
  const state = usePro.getState();
  return (
    state.ready &&
    state.workspace === workspace &&
    Boolean(state.owner) &&
    state.offlineUntil > now
  );
}
export function requirePro(workspace: string) {
  if (!workspaceHasPro(workspace))
    throw new Error(
      "This feature needs Pro. Open Subloom Pro to purchase or restore access; your input is still here.",
    );
}
