import { useUpdateDraft } from "./useUpdateDraft";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useNavigation } from "expo-router";
import {
  usePreventRemove,
  type NavigationAction,
} from "expo-router/react-navigation";
import { Confirm } from "../components/ui/Primitives";
export function useDraftGuard(dirty: boolean, busy = false) {
  useUpdateDraft(dirty || busy);
  const navigation = useNavigation(),
    allowed = useRef(false);
  const [pending, setPending] = useState<NavigationAction | null>(null);
  usePreventRemove(dirty || busy, ({ data }) => {
    if (allowed.current) navigation.dispatch(data.action);
    else if (!busy) setPending(data.action);
  });
  useEffect(() => {
    if (Platform.OS !== "web" || (!dirty && !busy)) return;
    const protect = (event: BeforeUnloadEvent) => {
      if (!allowed.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty, busy]);
  return {
    saved: () => {
      allowed.current = true;
    },
    confirmation: (
      <Confirm
        visible={pending !== null}
        title="Discard unsaved changes?"
        body="Your edits have not been saved. Keep editing to finish, or discard them to leave."
        action="Discard changes"
        cancelLabel="Keep editing"
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (busy) return;
          allowed.current = true;
          if (pending) navigation.dispatch(pending);
        }}
      />
    ),
  };
}
