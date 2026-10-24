import { create } from "zustand";
import type { AppUpdateState } from "../domain/updates";
export type UpdateKind =
  "web" | "bootstrap" | "mac" | "windows" | "ota" | "apk" | "none";
export const useUpdates = create<AppUpdateState & { kind: UpdateKind }>(() => ({
  kind: "web",
  supported: true,
  status: "idle",
  currentVersion: "",
  availableVersion: null,
  progress: null,
  error: null,
}));
export function updateFailure(error: unknown) {
  useUpdates.setState({
    status: "error",
    progress: null,
    error:
      error instanceof Error
        ? error.message.slice(0, 500)
        : "The update could not finish. Try again while connected.",
  });
}
