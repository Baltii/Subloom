import { useMemo } from "react";
import { personalServiceCatalog } from "../domain/customServices";
import { useApp } from "../store/app";

export function useServiceCatalog() {
  const saved = useApp((state) => state.data.preferences.customServices);
  return useMemo(() => personalServiceCatalog(saved), [saved]);
}
