import { useMemo } from "react";
import { View } from "react-native";
import { recurringTotals } from "../../domain/money";
import { convertedSubscriptions } from "../../domain/exchangeRates";
import { useDisplayCurrency } from "../../hooks/useDisplayCurrency";
import { useApp } from "../../store/app";
import { Button, Heading, Label } from "../ui/Primitives";
import { useTheme } from "../../theme/useTheme";
export function ExchangeEstimate() {
  const { colors } = useTheme();
  const subscriptions = useApp((state) => state.data.subscriptions);
  const display = useDisplayCurrency();
  const converted = useMemo(
    () =>
      convertedSubscriptions(
        subscriptions,
        display.currency,
        display.query.data?.rates || [],
      ),
    [subscriptions, display.currency, display.query.data],
  );
  const total = recurringTotals(converted.subscriptions)[0]?.monthly || 0;
  return (
    <View style={{ gap: 12 }}>
      <Heading size={20}>Monthly estimate in {display.currency}</Heading>
      <Label bold>
        {converted.missing.length
          ? "Rate unavailable"
          : display.format(total, display.currency, true)}
      </Label>
      <Label color={colors.secondary}>
        Daily rates estimate your recurring costs. Your bank’s exchange rate and
        fees can differ.
      </Label>
      {display.query.data?.warning && (
        <Label>{display.query.data.warning}</Label>
      )}
      <Button
        small
        variant="ghost"
        loading={display.query.isFetching}
        onPress={() => void display.query.refetch()}
      >
        Refresh rates
      </Button>
    </View>
  );
}
