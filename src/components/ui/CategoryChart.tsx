import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { recurringTotals } from "../../domain/money";
import type { Currency, Subscription } from "../../domain/models";
import { useTheme } from "../../theme/useTheme";
import { Label } from "./Primitives";
const palette = [
  "#1B7156",
  "#82B99A",
  "#C8D9B4",
  "#E9BE78",
  "#B4A4CD",
  "#91C4D7",
  "#D4DAD3",
];
export function CategoryChart({
  subscriptions,
  currency,
}: {
  subscriptions: Subscription[];
  currency: Currency;
}) {
  const { colors } = useTheme(),
    active = subscriptions.filter(
      (s) => s.currency === currency && ["active", "trial"].includes(s.status),
    );
  const categories = [...new Set(active.map((s) => s.category))].map(
    (category) => ({
      category,
      amount:
        recurringTotals(active.filter((s) => s.category === category))[0]
          ?.monthly ?? 0,
    }),
  );
  const total = categories.reduce((sum, c) => sum + c.amount, 0),
    circumference = 2 * Math.PI * 54;
  let offset = 0;
  return (
    <View>
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          marginVertical: 12,
        }}
      >
        <Svg width={160} height={160} viewBox="0 0 160 160">
          <Circle
            cx="80"
            cy="80"
            r="54"
            stroke={colors.border}
            strokeWidth="19"
            fill="none"
          />
          {categories.map((c, i) => {
            const fraction = total ? c.amount / total : 0,
              start = offset;
            offset += fraction * circumference;
            return (
              <Circle
                key={c.category}
                cx="80"
                cy="80"
                r="54"
                fill="none"
                stroke={palette[i % palette.length]}
                strokeWidth="19"
                strokeDasharray={
                  Math.max(0, fraction * circumference - 4) +
                  " " +
                  circumference
                }
                strokeDashoffset={-start}
                transform="rotate(-90 80 80)"
              />
            );
          })}
        </Svg>
        <View style={{ position: "absolute", alignItems: "center" }}>
          <Label size={25} bold>
            {active.length}
          </Label>
          <Label size={10} color={colors.secondary}>
            subscriptions
          </Label>
        </View>
      </View>
      <View style={{ gap: 13, marginTop: 9 }}>
        {categories.map((c, i) => (
          <View
            key={c.category}
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 3.5,
                backgroundColor: palette[i % palette.length],
              }}
            />
            <Label size={11} color={colors.secondary} style={{ flex: 1 }}>
              {c.category}
            </Label>
            <Label size={11} bold>
              {total ? Math.round((c.amount / total) * 100) : 0}%
            </Label>
          </View>
        ))}
      </View>
      <Label size={10} color={colors.secondary} style={{ marginTop: 20 }}>
        Estimated monthly costs in {currency}.
      </Label>
    </View>
  );
}
