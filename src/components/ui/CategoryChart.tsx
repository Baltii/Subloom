import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import type { Currency, Subscription } from "../../domain/models";
import { categorySpending } from "../../domain/insights";
import { formatMoney } from "../../domain/money";
import { useTheme } from "../../theme/useTheme";
import { Label } from "./Primitives";
import { ChartBar } from "./ChartBar";

export function CategoryChart({
  subscriptions,
  currency,
  converted = false,
}: {
  subscriptions: Subscription[];
  currency: Currency;
  converted?: boolean;
}) {
  const { colors } = useTheme();
  const [period, setPeriod] = useState<"monthly" | "annual">("monthly");
  const categories = useMemo(
    () => categorySpending(subscriptions, currency, period),
    [subscriptions, currency, period],
  );
  const total = categories.reduce((sum, category) => sum + category.amount, 0);
  return (
    <View style={{ gap: 18 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["monthly", "annual"] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={`${value} category costs`}
            accessibilityState={{ selected: period === value }}
            onPress={() => setPeriod(value)}
            style={({ pressed }) => ({
              minHeight: 44,
              paddingHorizontal: 12,
              justifyContent: "center",
              borderRadius: 10,
              backgroundColor:
                period === value
                  ? colors.mint
                  : pressed
                    ? colors.background
                    : "transparent",
            })}
          >
            <Label
              size={12}
              bold
              color={period === value ? colors.primary : colors.secondary}
            >
              {value === "monthly" ? "Monthly" : "Yearly"}
            </Label>
          </Pressable>
        ))}
      </View>
      {categories.map((category) => (
        <View key={category.category} style={{ gap: 7 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <Label size={12} style={{ flex: 1 }}>
              {category.category}
            </Label>
            <Label size={12} bold>
              {formatMoney(category.amount, currency)}
            </Label>
          </View>
          <View
            accessible
            accessibilityLabel={`${category.category}: ${formatMoney(category.amount, currency)} ${currency} per ${period === "monthly" ? "month" : "year"}, ${total ? Math.round((category.amount / total) * 100) : 0} percent`}
            style={{
              height: 9,
              backgroundColor: colors.mint,
              borderRadius: 5,
              overflow: "hidden",
            }}
          >
            <ChartBar
              fraction={total ? category.amount / total : 0}
              color={colors.primary}
            />
          </View>
          <Label size={11} color={colors.secondary}>
            {category.count}{" "}
            {category.count === 1 ? "subscription" : "subscriptions"} ·{" "}
            {total ? Math.round((category.amount / total) * 100) : 0}%
          </Label>
        </View>
      ))}
      {!categories.length && (
        <Label size={12} color={colors.secondary}>
          No active subscriptions in {currency} yet.
        </Label>
      )}
      <Label size={11} color={colors.secondary}>
        Estimated {period} costs in {currency}.
        {converted ? " Converted with reference rates." : ""}
      </Label>
    </View>
  );
}
