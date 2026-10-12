import { createContext, useContext } from "react";

export const QuickActionsContext = createContext<(() => void) | null>(null);
export function useQuickActions() {
  return useContext(QuickActionsContext);
}
