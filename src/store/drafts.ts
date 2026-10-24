import { create } from "zustand";
export const useDrafts = create<{ active: Record<string, true> }>(() => ({
  active: {},
}));
export function setDraftActive(id: string, active: boolean) {
  useDrafts.setState((state) => {
    if (Boolean(state.active[id]) === active) return state;
    const next = { ...state.active };
    if (active) next[id] = true;
    else delete next[id];
    return { active: next };
  });
}
export const hasUnsavedDrafts = () =>
  Object.keys(useDrafts.getState().active).length > 0;
