import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../store/app";
import { currencyDisplay } from "../domain/displayCurrency";
import { loadExchangeRates } from "../services/exchangeRates";

export function useDisplayCurrency() {
  const currency = useApp((state) => state.data.preferences.currency);
  const query = useQuery({
    queryKey: ["public-exchange-rates"],
    queryFn: loadExchangeRates,
    staleTime: 3_600_000,
  });
  const display = useMemo(
    () => currencyDisplay(currency, query.data?.rates || []),
    [currency, query.data],
  );
  return { ...display, query };
}
