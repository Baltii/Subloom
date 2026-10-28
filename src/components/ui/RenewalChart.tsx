import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import type { Currency, Subscription } from "../../domain/models";
import { renewalForecast } from "../../domain/insights";
import { dateLabel } from "../../domain/renewal";
import { formatMoney } from "../../domain/money";
import { useTheme, useWide } from "../../theme/useTheme";
import { ChartBar } from "./ChartBar";
import { Heading, Label } from "./Primitives";

export function RenewalChart({
  subscriptions,
  currency,
  reference,
}: {
  subscriptions: Subscription[];
  currency: Currency;
  reference: string;
}) {
  const { colors } = useTheme();
  const wide = useWide();
  const [index, setIndex] = useState(0);
  const forecast = useMemo(() => {
    try {
      return {
        months: renewalForecast(subscriptions, currency, reference),
        error: null,
      };
    } catch (error) {
      return {
        months: [],
        error:
          error instanceof Error
            ? error.message
            : "Could not build the forecast.",
      };
    }
  }, [subscriptions, currency, reference]);
  if (forecast.error)
    return <Label color={colors.error}>{forecast.error}</Label>;
  const selected = forecast.months[index]!;
  const maximum = Math.max(1, ...forecast.months.map((month) => month.amount));
  return (
    <View style={{ gap: 14 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <Heading size={24}>{formatMoney(selected.amount, currency)}</Heading>
        <Label size={12} color={colors.secondary}>
          {dateLabel(selected.month, { month: "long", year: "numeric" })} ·{" "}
          {selected.count} scheduled{" "}
          {selected.count === 1 ? "charge" : "charges"}
        </Label>
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
        {forecast.months.map((month, i) => (
          <Pressable
            key={month.month}
            testID={`forecast-${i}`}
            accessibilityRole="button"
            accessibilityLabel={`${dateLabel(month.month, { month: "long", year: "numeric" })}: ${formatMoney(month.amount, currency)} ${currency}, ${month.count} scheduled charges`}
            accessibilityState={{ selected: i === index }}
            onPress={() => setIndex(i)}
            style={({ pressed }) => ({
              flex: 1,
              minWidth: 0,
              padding: 5,
              borderRadius: 10,
              backgroundColor:
                i === index || pressed ? colors.mint : "transparent",
              gap: 7,
            })}
          >
            {wide && (
              <Label
                size={11}
                bold
                numberOfLines={1}
                style={{ textAlign: "center" }}
              >
                {formatMoney(month.amount, currency, true)}
              </Label>
            )}
            <View
              style={{
                height: 125,
                justifyContent: "flex-end",
                borderBottomWidth: 1,
                borderColor: colors.border,
              }}
            >
              <ChartBar
                vertical
                fraction={month.amount / maximum}
                color={i === index ? colors.primary : colors.heroArt}
              />
            </View>
            <Label
              size={11}
              color={i === index ? colors.primary : colors.secondary}
              bold={i === index}
              style={{ textAlign: "center" }}
            >
              {dateLabel(month.month, { month: "short" })}
            </Label>
          </Pressable>
        ))}
      </View>
      <View style={{ gap: 3 }}>
        {selected.events.slice(0, 3).map((event) => (
          <Pressable
            key={event.id}
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: "/subscription/[id]",
                params: { id: event.subscription.id },
              })
            }
            accessibilityLabel={`View ${event.subscription.name}, ${event.type === "trial" ? "trial ends" : "renewal"} ${dateLabel(event.date)}`}
            style={({ pressed }) => ({
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              backgroundColor: pressed ? colors.mint : "transparent",
            })}
          >
            <Label size={12} style={{ flex: 1 }}>
              {event.subscription.name} · {dateLabel(event.date)}
            </Label>
            <Label size={12} bold>
              {formatMoney(event.subscription.amountMinor, currency)}
            </Label>
          </Pressable>
        ))}
        {!selected.count && (
          <Label size={12} color={colors.secondary}>
            No scheduled charges in this month.
          </Label>
        )}
        {selected.count > 3 && (
          <Label size={11} color={colors.secondary}>
            Plus {selected.count - 3} more scheduled charges.
          </Label>
        )}
      </View>
      <Label size={11} color={colors.secondary}>
        Projected charges in {currency}, including trials at their renewal
        price.
      </Label>
    </View>
  );
}
