import { useApp } from "../store/app";
import { useDrafts, hasUnsavedDrafts } from "../store/drafts";
import { macosBridge, macosRequest } from "./macosBridge";
import { windowsBridge } from "./windowsBridge";
export function maintainUpdateDraftProtection() {
  let previous: boolean | null = null;
  const sync = () => {
    const active = !useApp.getState().hydrated || hasUnsavedDrafts();
    if (active === previous) return;
    previous = active;
    if (macosBridge())
      void macosRequest("update.draft", { active }).catch(() => {});
    if (windowsBridge()?.updates)
      void windowsBridge()!
        .updates!.setDraft(active)
        .catch(() => {});
  };
  sync();
  const offDrafts = useDrafts.subscribe(sync),
    offApp = useApp.subscribe(sync);
  return () => {
    offDrafts();
    offApp();
  };
}
