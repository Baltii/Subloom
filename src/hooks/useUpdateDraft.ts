import { useEffect, useId } from "react";
import { setDraftActive } from "../store/drafts";
export function useUpdateDraft(dirty: boolean) {
  const id = useId();
  useEffect(() => {
    setDraftActive(id, dirty);
    return () => setDraftActive(id, false);
  }, [id, dirty]);
}
