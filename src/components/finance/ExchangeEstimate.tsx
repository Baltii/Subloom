import { useMemo } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Temporal } from "@js-temporal/polyfill";
import { recurringTotals, formatMoney } from "../../domain/money";
import { convertMinor } from "../../domain/exchangeRates";
import { loadExchangeRates } from "../../services/exchangeRates";
import { useApp } from "../../store/app";
import { Button, Heading, Label } from "../ui/Primitives";
import { useTheme } from "../../theme/useTheme";
export function ExchangeEstimate() {
  const { colors } = useTheme(),
    subscriptions = useApp((s) => s.data.subscriptions),
    currency = useApp((s) => s.data.preferences.currency);
  const query = useQuery({
    queryKey: ["public-exchange-rates"],
    queryFn: loadExchangeRates,
    staleTime: 3_600_000,
  });
  const rows = useMemo(
    () =>
      recurringTotals(subscriptions).map((t) => {
        try {
          const rates = query.data?.rates ?? [];
          const required = [t.currency, currency].filter((c) => c !== "USD");
          const dates = rates
            .filter((r) => required.some((c) => c === r.quote_currency))
            .map((r) => r.as_of)
            .sort();
          const asOf = t.currency === currency ? null : (dates[0] ?? null);
          return {
            ...t,
            converted: convertMinor(t.monthly, t.currency, currency, rates),
            asOf,
            stale: asOf
              ? Temporal.PlainDate.from(asOf).until(
                  Temporal.Now.plainDateISO("UTC"),
                ).days > 7
              : false,
          };
        } catch {
          return { ...t, converted: null, asOf: null, stale: false };
        }
      }),
    [subscriptions, currency, query.data],
  );
  return (
    <View style={{ gap: 12 }}>
      <Heading size={20}>Monthly estimate in {currency}</Heading>
      <Label color={colors.secondary}>
        Daily reference rates estimate your recurring costs. Your bank’s
        exchange rate and fees can differ.
      </Label>
      {query.isPending && <Label>Loading cached exchange rates…</Label>}
      {query.data?.warning && <Label>{query.data.warning}</Label>}
      {rows.length ? (
        rows.map((r) => (
          <View key={r.currency} style={{ gap: 4 }}>
            <Label bold>
              {formatMoney(r.monthly, r.currency)} {r.currency} →{" "}
              {r.converted === null
                ? "Rate unavailable"
                : formatMoney(r.converted, currency) + " " + currency}
            </Label>
            {r.asOf && (
              <Label
                size={12}
                color={r.stale ? colors.warning : colors.secondary}
              >
                Frankfurter · rate date {r.asOf}
                {r.stale ? " · older than 7 days" : ""}
              </Label>
            )}
          </View>
        ))
      ) : (
        <Label>Add an active subscription to see converted estimates.</Label>
      )}
      <Button
        small
        variant="ghost"
        loading={query.isFetching}
        onPress={() => void query.refetch()}
      >
        Reload cached rates
      </Button>
    </View>
  );
}
