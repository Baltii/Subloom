import { useState } from "react";
import { View, Pressable } from "react-native";
import { router } from "expo-router";
import {
  Activity as ActivityIcon,
  CalendarDays,
  Check,
  Pencil,
  ReceiptText,
  X,
} from "lucide-react-native";
import { useApp } from "../../store/app";
import { dateLabel, upcoming } from "../../domain/renewal";
import { useTheme } from "../../theme/useTheme";
import {
  Badge,
  Card,
  Chips,
  Empty,
  Label,
  Page,
  SectionTitle,
} from "../../components/ui/Primitives";
export default function Activity() {
  const { colors } = useTheme(),
    data = useApp((s) => s.data),
    [filter, setFilter] = useState("All");
  const pending = data.candidates.filter((c) => c.state === "pending"),
    events = upcoming(data.subscriptions, data.preferences.timezone).filter(
      (e) => e.days <= 7,
    );
  const history = data.activity.filter((a) =>
    filter === "All" || filter === "Detections"
      ? filter === "All" ||
        ["detected", "confirmed", "dismissed"].includes(a.type)
      : filter === "Changes"
        ? !["detected", "confirmed", "dismissed", "reminder"].includes(a.type)
        : a.type === "reminder",
  );
  return (
    <Page
      title="The story of your subscriptions."
      subtitle="A clear trail of what’s coming and what’s changed."
      add
    >
      <View style={{ marginBottom: 24 }}>
        <Chips
          values={["All", "Detections", "Changes", "Reminders"]}
          selected={filter}
          onChange={setFilter}
        />
      </View>
      {(filter === "All" || filter === "Detections") && pending.length > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <SectionTitle title="Waiting for your review" />
          {pending.map((c) => (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/detection/[id]",
                  params: { id: c.id },
                })
              }
              style={{
                flexDirection: "row",
                gap: 14,
                alignItems: "center",
                paddingVertical: 15,
                borderTopWidth: 1,
                borderColor: colors.border,
              }}
            >
              <ReceiptText size={20} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Label bold>{c.merchant}</Label>
                <Label size={11} color={colors.secondary}>
                  {c.explanation}
                </Label>
              </View>
              <Badge tone="warning">Review</Badge>
            </Pressable>
          ))}
        </Card>
      )}
      {(filter === "All" || filter === "Reminders") && events.length > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <SectionTitle title="Scheduled this week" />
          {events.map((e) => (
            <Pressable
              key={e.subscription.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/subscription/[id]",
                  params: { id: e.subscription.id },
                })
              }
              style={{
                flexDirection: "row",
                gap: 14,
                alignItems: "center",
                paddingVertical: 14,
              }}
            >
              <CalendarDays size={19} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Label bold size={13}>
                  {e.subscription.name} ·{" "}
                  {e.type === "trial"
                    ? "trial ends"
                    : e.type === "paid_through"
                      ? "paid access ends"
                      : "renewal"}
                </Label>
                <Label color={colors.secondary} size={11}>
                  {dateLabel(e.date)} · scheduled, not a confirmed payment
                </Label>
              </View>
            </Pressable>
          ))}
        </Card>
      )}
      <Card>
        <SectionTitle title="Your activity" />
        {history.length ? (
          history.map((item, i) => {
            const Icon =
              item.type === "detected"
                ? ReceiptText
                : item.type === "dismissed" || item.type === "deleted"
                  ? X
                  : item.type === "edited"
                    ? Pencil
                    : Check;
            const candidate = data.candidates.some(
                (c) => c.id === item.targetId,
              ),
              subscription = data.subscriptions.some(
                (s) => s.id === item.targetId,
              );
            return (
              <Pressable
                key={item.id}
                accessibilityRole={
                  item.targetId && (candidate || subscription)
                    ? "button"
                    : "text"
                }
                onPress={() => {
                  if (candidate)
                    router.push({
                      pathname: "/detection/[id]",
                      params: { id: item.targetId! },
                    });
                  else if (subscription)
                    router.push({
                      pathname: "/subscription/[id]",
                      params: { id: item.targetId! },
                    });
                }}
                style={{
                  flexDirection: "row",
                  gap: 15,
                  paddingVertical: 20,
                  borderTopWidth: i ? 1 : 0,
                  borderColor: colors.border,
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    backgroundColor: colors.mint,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Label bold size={13}>
                    {item.title}
                  </Label>
                  <Label color={colors.secondary} size={12}>
                    {item.detail}
                  </Label>
                </View>
                <Label size={10} color={colors.secondary}>
                  {new Date(item.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </Label>
              </Pressable>
            );
          })
        ) : (
          <Empty
            icon={ActivityIcon}
            title="A clean slate."
            body="Your changes and receipt reviews will appear here as you go."
          />
        )}
      </Card>
    </Page>
  );
}
