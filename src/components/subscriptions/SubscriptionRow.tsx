import { memo } from "react";
import { Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { router } from "expo-router";
import type { Subscription } from "../../domain/models";
import { formatMoney } from "../../domain/money";
import { dateLabel, intervalLabel, nextEvent } from "../../domain/renewal";
import { useTheme, useWide } from "../../theme/useTheme";
import { Badge, Label } from "../ui/Primitives";
import { ServiceIcon } from "./ServiceIcon";
import { SubscriptionActions } from "./SubscriptionActions";
export const SubscriptionRow = memo(function SubscriptionRow({
  subscription: s,
  reference,
  days,
  eventType,
  showActions = false,
}: {
  subscription: Subscription;
  reference: string;
  days?: number;
  eventType?: string;
  showActions?: boolean;
}) {
  const { colors } = useTheme(),
    wide = useWide(),
    event = nextEvent(s, reference);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          s.name +
          ", " +
          formatMoney(s.amountMinor, s.currency) +
          " " +
          s.currency +
          " per " +
          intervalLabel(s) +
          ", " +
          s.status +
          (event ? ", next event " + dateLabel(event.date) : "")
        }
        onPress={() =>
          router.push({ pathname: "/subscription/[id]", params: { id: s.id } })
        }
        style={({ pressed }) => ({
          flexDirection: "row",
          gap: 14,
          alignItems: "center",
          flex: 1,
          minWidth: 0,
          paddingVertical: 18,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <ServiceIcon serviceId={s.serviceId} name={s.name} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Label bold size={15} numberOfLines={2}>
            {s.name}
          </Label>
          <Label color={colors.secondary} size={12}>
            {days === undefined
              ? (wide ? s.category : "") +
                (event
                  ? (wide ? " · " : "") +
                    dateLabel(event.date, { month: "short", day: "numeric" })
                  : "")
              : event
                ? dateLabel(event.date, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })
                : s.status}
          </Label>
        </View>
        {wide && days !== undefined && (
          <Badge
            tone={days <= 1 || eventType === "trial" ? "warning" : "neutral"}
          >
            {eventType === "trial" ? "Trial ends · " : ""}
            {days === 0
              ? "Today"
              : days === 1
                ? "Tomorrow"
                : "In " + days + " days"}
          </Badge>
        )}
        <View style={{ alignItems: "flex-end", gap: 3 }}>
          <Label bold size={14}>
            {formatMoney(s.amountMinor, s.currency)}
            {days !== undefined && !wide ? " " + s.currency : ""}
          </Label>
          <Label size={12} color={colors.secondary}>
            {days !== undefined && !wide
              ? days === 0
                ? "Today"
                : "In " + days + " days"
              : s.currency + " / " + intervalLabel(s)}
          </Label>
        </View>
        {wide && !showActions && (
          <ChevronRight size={15} color={colors.faint} />
        )}
      </Pressable>
      {showActions && <SubscriptionActions subscription={s} />}
    </View>
  );
});
