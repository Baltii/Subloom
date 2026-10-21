import { useMemo, useState } from "react";
import { FlatList, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Plus, Search, Zap, X } from "lucide-react-native";
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
import { useQuickActions } from "../../hooks/useQuickActions";
import { useBillingMethods } from "../../hooks/useBillingMethods";
import { PaymentMethodIcon } from "../../components/payments/PaymentMethodIcon";
import {
  billingMethodLabel,
  billingReference,
  matchesBillingFilter,
  subscriptionBillingLabel,
} from "../../domain/billingMethods";
export default function SubscriptionsRoute() {
  const identity = useApp((state) => state.identity);
  return <Subscriptions key={identity} />;
}
function Subscriptions() {
  const quickActions = useQuickActions();
  const billingMethods = useBillingMethods();
  const params = useLocalSearchParams<{ billing?: string | string[] }>();
  const billing = typeof params.billing === "string" ? params.billing : "all";
  function setBilling(value: string) {
    router.setParams({ billing: value });
  }
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
        (category === "All categories" || s.category === category) &&
        (billing === "all" ||
          (billingMethods.loaded &&
            matchesBillingFilter(s, billingMethods.value, billing))),
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
  }, [
    data.subscriptions,
    query,
    status,
    category,
    sort,
    reference,
    billing,
    billingMethods.loaded,
    billingMethods.value,
  ]);
  const billingOptions = [
    { value: "all", label: "All billing methods" },
    { value: "cards", label: "All cards" },
    { value: "wallets", label: "All wallets" },
    { value: "unassigned", label: "Not assigned / unavailable" },
    ...billingMethods.value.sources.map((source) => ({
      value: billingReference(source.id),
      label: billingMethodLabel(source),
      icon: <PaymentMethodIcon source={source} size={24} />,
    })),
  ];
  if (!billingOptions.some((option) => option.value === billing))
    billingOptions.push({
      value: billing,
      label: "Unavailable billing method",
    });
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
                <Heading size={wide ? 30 : 27}>Subscriptions</Heading>
                <Label size={13} color={colors.secondary}>
                  {data.subscriptions.length} subscriptions. One clear picture.
                </Label>
              </View>
              <View
                style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
              >
                {quickActions && (
                  <IconButton
                    icon={Zap}
                    label="Quick actions"
                    onPress={quickActions}
                  />
                )}
                <Button
                  small
                  icon={Plus}
                  onPress={() => router.push("/subscription/new")}
                >
                  {wide ? "Add subscription" : "Add"}
                </Button>
              </View>
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
                  fontSize: 16,
                  flex: 1,
                  minHeight: 50,
                }}
              />
              {Boolean(query) && (
                <IconButton
                  icon={X}
                  label="Clear subscription search"
                  onPress={() => setQuery("")}
                />
              )}
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
                marginBottom: 12,
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
            </View>
            <View
              style={{
                flexDirection: "row",
                gap: 10,
                marginBottom: 12,
                alignItems: "center",
              }}
            >
              <View style={{ flex: 1 }}>
                <SelectField
                  compact
                  label="Filter billing method"
                  testID="subscriptions-billing-filter"
                  value={billing}
                  options={billingOptions}
                  onChange={setBilling}
                  searchable
                  disabled={!billingMethods.loaded}
                />
              </View>
              <Button
                small
                variant="ghost"
                onPress={() => router.push("/billing-methods")}
              >
                Cards & wallets
              </Button>
            </View>
            {billingMethods.error && (
              <View style={{ marginBottom: 12, gap: 8 }}>
                <Label size={12} color={colors.error} accessibilityRole="alert">
                  {billingMethods.error}
                </Label>
                <Button
                  small
                  variant="secondary"
                  onPress={() => void billingMethods.reload()}
                >
                  Reload billing methods
                </Button>
                {billing !== "all" && (
                  <Button
                    small
                    variant="ghost"
                    onPress={() => setBilling("all")}
                  >
                    Show all billing methods
                  </Button>
                )}
              </View>
            )}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                marginBottom: 18,
              }}
            >
              <Label size={12} color={colors.secondary}>
                {rows.length}{" "}
                {rows.length === 1 ? "subscription" : "subscriptions"}
                {filtered.length !== data.subscriptions.length
                  ? " matching your filters"
                  : " tracked"}
              </Label>
              <Chips
                values={["List", "Timeline"] as const}
                selected={timeline ? "Timeline" : "List"}
                onChange={(value) => setTimeline(value === "Timeline")}
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
                  <SubscriptionRow
                    subscription={item}
                    reference={reference}
                    showActions
                    billingLabel={
                      billingMethods.loaded
                        ? subscriptionBillingLabel(item, billingMethods.value)
                        : undefined
                    }
                  />
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
          billing !== "all" && !billingMethods.loaded ? (
            <Label color={colors.secondary}>
              {billingMethods.error
                ? "Reload billing methods to use this filter."
                : "Loading billing methods…"}
            </Label>
          ) : (
            <Empty
              icon={Search}
              actionIcon={data.subscriptions.length ? X : Plus}
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
              action={
                data.subscriptions.length ? "Clear filters" : "Add subscription"
              }
              onPress={() => {
                if (data.subscriptions.length) {
                  setQuery("");
                  setStatus("All");
                  setCategory("All categories");
                  setBilling("all");
                  setTimeline(false);
                } else router.push("/subscription/new");
              }}
            />
          )
        }
      />
    </View>
  );
}
