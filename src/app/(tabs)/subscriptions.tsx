import { useMemo, useState } from "react";
import { FlatList, TextInput, View } from "react-native";
import { router } from "expo-router";
import { CalendarDays, List, Plus, Search } from "lucide-react-native";
import { useApp } from "../../store/app";
import { categories } from "../../domain/models";
import { dateLabel, nextEvent, today, upcoming } from "../../domain/renewal";
import { useTheme, useWide } from "../../theme/useTheme";
import { tokens } from "../../theme/tokens";
import {
  Badge,
  Button,
  Chips,
  Empty,
  Heading,
  IconButton,
  Label,
} from "../../components/ui/Primitives";
import { SubscriptionRow } from "../../components/subscriptions/SubscriptionRow";
import { SwipeRow } from "../../components/subscriptions/SwipeRow";
import { SelectField } from "../../components/ui/Selection";
export default function Subscriptions() {
  const { colors } = useTheme(),
    wide = useWide(),
    data = useApp((s) => s.data);
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("All"),
    [category, setCategory] = useState("All categories"),
    [sort, setSort] = useState("Renewal date"),
    [timeline, setTimeline] = useState(false);
  const reference = today(data.preferences.timezone);
  const filtered = useMemo(() => {
    const list = data.subscriptions.filter(
      (s) =>
        s.name.toLowerCase().includes(query.trim().toLowerCase()) &&
        (status === "All" || s.status === status.toLowerCase()) &&
        (category === "All categories" || s.category === category),
    );
    return list.sort((a, b) =>
      sort === "Name"
        ? a.name.localeCompare(b.name)
        : sort === "Price"
          ? a.currency.localeCompare(b.currency) ||
            b.amountMinor - a.amountMinor
          : (nextEvent(a, reference)?.date || "9999").localeCompare(
              nextEvent(b, reference)?.date || "9999",
            ),
    );
  }, [data.subscriptions, query, status, category, sort, reference]);
  const rows = timeline
    ? upcoming(filtered, data.preferences.timezone).map((e) => e.subscription)
    : filtered;
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingHorizontal: wide ? 38 : 22,
        maxWidth: 1280,
        alignSelf: "center",
        width: "100%",
      }}
    >
      <FlatList
        data={rows}
        keyExtractor={(s) => s.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: wide ? 38 : 22,
          paddingBottom: 100,
        }}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        windowSize={7}
        ListHeaderComponent={
          <>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 28,
                gap: 10,
              }}
            >
              <View style={{ flex: 1, gap: 6 }}>
                <Heading size={wide ? 30 : 27}>Your recurring world.</Heading>
                <Label size={13} color={colors.secondary}>
                  {data.subscriptions.length} subscriptions. One clear picture.
                </Label>
              </View>
              <Button
                small
                icon={Plus}
                onPress={() => router.push("/subscription/new")}
              >
                {wide ? "Add subscription" : "Add"}
              </Button>
            </View>
            {data.demo && (
              <View style={{ marginBottom: 16 }}>
                <Badge tone="warning">
                  Sample workspace · illustrative data
                </Badge>
              </View>
            )}
            <View
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 13,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 16,
                marginBottom: 17,
              }}
            >
              <Search size={18} color={colors.secondary} />
              <TextInput
                testID="subscriptions-search"
                accessibilityLabel="Search subscriptions"
                value={query}
                onChangeText={setQuery}
                placeholder="Find a subscription…"
                placeholderTextColor={colors.faint}
                style={{
                  color: colors.text,
                  fontFamily: tokens.fonts.body,
                  fontSize: 14,
                  flex: 1,
                  minHeight: 50,
                }}
              />
            </View>
            <Chips
              values={[
                "All",
                "Active",
                "Trial",
                "Paused",
                "Canceled",
                "Expired",
              ]}
              selected={status}
              onChange={setStatus}
            />
            <View
              style={{
                flexDirection: "row",
                gap: 10,
                marginTop: 16,
                marginBottom: 20,
                alignItems: "center",
              }}
            >
              <View style={{ flex: 1 }}>
                <SelectField
                  compact
                  label="Filter category"
                  value={category}
                  options={["All categories", ...categories].map((value) => ({
                    value,
                    label: value,
                  }))}
                  onChange={setCategory}
                  searchable
                />
              </View>
              <View style={{ flex: 1 }}>
                <SelectField
                  compact
                  label="Sort subscriptions"
                  value={sort}
                  options={["Renewal date", "Name", "Price"].map((value) => ({
                    value,
                    label: value,
                  }))}
                  onChange={setSort}
                />
              </View>
              <IconButton
                icon={timeline ? List : CalendarDays}
                label={
                  timeline ? "Show subscription list" : "Show renewal timeline"
                }
                onPress={() => setTimeline(!timeline)}
              />
            </View>
            {sort === "Price" && (
              <Label
                size={11}
                color={colors.secondary}
                style={{ marginBottom: 16 }}
              >
                Prices are sorted within each original currency.
              </Label>
            )}
            {timeline && (
              <Label
                size={11}
                color={colors.secondary}
                style={{ marginBottom: 16 }}
              >
                Next scheduled events · paused and expired tracking is excluded.
              </Label>
            )}
          </>
        }
        renderItem={({ item, index }) => {
          const event = nextEvent(item, reference),
            previous = rows[index - 1],
            previousDate = previous
              ? nextEvent(previous, reference)?.date
              : null;
          return (
            <View>
              {timeline && event?.date !== previousDate && (
                <View style={{ paddingTop: 18, paddingBottom: 5 }}>
                  <Label bold color={colors.primary} size={12}>
                    {event
                      ? dateLabel(event.date, {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })
                      : "No upcoming event"}
                  </Label>
                </View>
              )}
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 16,
                  paddingHorizontal: 20,
                  marginBottom: 10,
                }}
              >
                <SwipeRow subscription={item}>
                  <SubscriptionRow subscription={item} reference={reference} />
                </SwipeRow>
                {item.status !== "active" && (
                  <View style={{ marginBottom: 14 }}>
                    <Badge
                      tone={item.status === "trial" ? "warning" : "neutral"}
                    >
                      {item.status}
                    </Badge>
                  </View>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Empty
            icon={Search}
            title={
              data.subscriptions.length
                ? "Nothing matches just yet."
                : "A fresh start."
            }
            body={
              data.subscriptions.length
                ? "Try another search or clear your filters."
                : "Add your first subscription to start seeing your recurring costs clearly."
            }
            action={data.subscriptions.length ? undefined : "Add subscription"}
            onPress={() => router.push("/subscription/new")}
          />
        }
      />
    </View>
  );
}
