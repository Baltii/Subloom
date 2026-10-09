import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import {
  ArrowRight,
  CalendarDays,
  Layers2,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  ArrowUpRight,
} from "lucide-react-native";
import { useApp } from "../../store/app";
import { recurringTotals, formatMoney, annualCost } from "../../domain/money";
import { dateLabel, today, upcoming } from "../../domain/renewal";
import { useTheme, useWide } from "../../theme/useTheme";
import {
  AnimatedIn,
  Badge,
  Button,
  Card,
  Empty,
  Heading,
  Label,
  Page,
  SectionTitle,
} from "../../components/ui/Primitives";
import { BloomArt } from "../../components/ui/Brand";
import { SubscriptionRow } from "../../components/subscriptions/SubscriptionRow";
import { ServiceIcon } from "../../components/subscriptions/ServiceIcon";
import { CategoryChart } from "../../components/ui/CategoryChart";
import { AnimatedMoney } from "../../components/ui/AnimatedMoney";
import { syncNow } from "../../services/sync";
export default function Home() {
  const [refreshing, setRefreshing] = useState(false);
  const { colors } = useTheme(),
    wide = useWide(),
    data = useApp((s) => s.data);
  const totals = useMemo(
    () => recurringTotals(data.subscriptions),
    [data.subscriptions],
  );
  const events = useMemo(
    () => upcoming(data.subscriptions, data.preferences.timezone),
    [data.subscriptions, data.preferences.timezone],
  );
  const main =
      totals.find((t) => t.currency === data.preferences.currency) || totals[0],
    currency = main?.currency || data.preferences.currency;
  const largest = data.subscriptions
    .filter(
      (s) => s.currency === currency && ["active", "trial"].includes(s.status),
    )
    .reduce<(typeof data.subscriptions)[number] | undefined>(
      (best, s) => (!best || annualCost(s) > annualCost(best) ? s : best),
      undefined,
    );
  const next = events[0],
    reference = today(data.preferences.timezone),
    pending = data.candidates.filter((c) => c.state === "pending"),
    week = events.filter((e) => e.days <= 7 && e.type !== "paid_through");
  const activeCount = data.subscriptions.filter((s) =>
    ["active", "trial"].includes(s.status),
  ).length;
  return (
    <Page
      title="Your subscriptions, at a glance."
      subtitle="A little clarity. A lot more peace of mind."
      eyebrow={dateLabel(reference, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })}
      add
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void syncNow()
          .catch(() => {})
          .finally(() => setRefreshing(false));
      }}
    >
      <AnimatedIn>
        <View
          style={{
            flexDirection: wide ? "row" : "column",
            gap: 20,
            marginBottom: 28,
          }}
        >
          <View
            style={{
              flex: wide ? 1.85 : undefined,
              minHeight: 250,
              padding: 28,
              borderRadius: 22,
              backgroundColor: colors.hero,
              overflow: "hidden",
              justifyContent: "space-between",
            }}
          >
            <View
              style={{
                position: "absolute",
                right: -14,
                top: -3,
                opacity: 0.7,
              }}
            >
              <BloomArt size={240} color={colors.heroArt} />
            </View>
            <View style={{ gap: 12 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: colors.primary,
                  }}
                />
                <Label
                  bold
                  size={11}
                  color={colors.heroText}
                  style={{ letterSpacing: 0.3 }}
                >
                  ESTIMATED MONTHLY SPEND
                </Label>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  gap: 8,
                }}
              >
                <AnimatedMoney
                  amountMinor={main?.monthly || 0}
                  currency={currency}
                  size={wide ? 54 : 45}
                  color={colors.heroText}
                />
                <Label color={colors.heroSecondary} size={12}>
                  {currency} / month
                </Label>
              </View>
              <Label size={12} color={colors.heroSecondary}>
                {formatMoney(main?.annual || 0, currency)} estimated per year
              </Label>
            </View>
            <View
              style={{
                marginTop: 27,
                borderTopWidth: 1,
                borderTopColor: colors.heroArt + "65",
                paddingTop: 18,
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 25,
              }}
            >
              <View
                style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
              >
                <Layers2 size={15} color={colors.heroSecondary} />
                <Label size={12} bold color={colors.heroText}>
                  {activeCount} active{" "}
                  {activeCount === 1 ? "subscription" : "subscriptions"}
                </Label>
              </View>
              <View
                style={{ flexDirection: "row", gap: 6, alignItems: "center" }}
              >
                <ShieldCheck size={15} color={colors.heroSecondary} />
                <Label size={11} color={colors.heroSecondary}>
                  All in one place
                </Label>
              </View>
            </View>
          </View>
          <Card
            style={{
              flex: wide ? 1 : undefined,
              padding: 24,
              justifyContent: "space-between",
              minHeight: 250,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Label size={11} bold color={colors.secondary}>
                NEXT ON YOUR CALENDAR
              </Label>
              <CalendarDays color={colors.secondary} size={17} />
            </View>
            {next ? (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    marginTop: 17,
                  }}
                >
                  <ServiceIcon
                    serviceId={next.subscription.serviceId}
                    name={next.subscription.name}
                    size={43}
                  />
                  <View>
                    <Label bold>{next.subscription.name}</Label>
                    <Label size={11} color={colors.secondary}>
                      {dateLabel(next.date, { month: "long", day: "numeric" })}
                    </Label>
                  </View>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 19,
                  }}
                >
                  <Heading size={28}>
                    {formatMoney(
                      next.subscription.amountMinor,
                      next.subscription.currency,
                    )}
                  </Heading>
                  <Badge tone={next.type === "trial" ? "warning" : "green"}>
                    {next.type === "trial"
                      ? "Trial ends"
                      : next.type === "paid_through"
                        ? "Access ends"
                        : next.days === 0
                          ? "Today"
                          : next.days === 1
                            ? "Tomorrow"
                            : "In " + next.days + " days"}
                  </Badge>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/subscription/[id]",
                      params: { id: next.subscription.id },
                    })
                  }
                  style={{
                    flexDirection: "row",
                    gap: 7,
                    alignItems: "center",
                    marginTop: 12,
                    minHeight: 44,
                  }}
                >
                  <Label size={11} color={colors.primary} bold>
                    View subscription
                  </Label>
                  <ArrowUpRight color={colors.primary} size={13} />
                </Pressable>
              </>
            ) : (
              <View style={{ gap: 12, marginTop: 24 }}>
                <Heading size={22}>No surprises on the horizon.</Heading>
                <Label size={12} color={colors.secondary}>
                  Add a subscription to see your next renewal here.
                </Label>
              </View>
            )}
          </Card>
        </View>
      </AnimatedIn>
      {totals.length > 1 && (
        <Card style={{ marginBottom: 26, gap: 10 }}>
          <Label size={12} bold>
            Other currencies · kept separate for accuracy
          </Label>
          {totals
            .filter((t) => t.currency !== currency)
            .map((t) => (
              <Label key={t.currency} color={colors.secondary}>
                {t.currency}: {formatMoney(t.monthly, t.currency)} / month ·{" "}
                {formatMoney(t.annual, t.currency)} / year
              </Label>
            ))}
          <Label size={11} color={colors.secondary}>
            No exchange rates are applied.
          </Label>
        </Card>
      )}
      {pending.length > 0 && (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: "/detection/[id]",
              params: { id: pending[0]!.id },
            })
          }
          style={{
            marginBottom: 26,
            backgroundColor: colors.warningBg,
            borderRadius: 16,
            padding: 18,
            flexDirection: "row",
            gap: 14,
            alignItems: "center",
          }}
        >
          <Sparkles size={20} color={colors.warning} />
          <View style={{ flex: 1 }}>
            <Label bold>New subscription detected.</Label>
            <Label size={12} color={colors.secondary}>
              {pending.length}{" "}
              {pending.length === 1 ? "receipt is" : "receipts are"} ready for
              your review.
            </Label>
          </View>
          <ArrowRight size={18} color={colors.warning} />
        </Pressable>
      )}
      <View style={{ flexDirection: wide ? "row" : "column", gap: 24 }}>
        <View style={{ flex: wide ? 1.85 : undefined }}>
          <AnimatedIn delay={60}>
            <Card>
              <SectionTitle
                title="Coming up next"
                action="See all"
                onPress={() => router.push("/subscriptions")}
              />
              {events.length ? (
                events.slice(0, 5).map((event, i) => (
                  <View
                    key={event.subscription.id}
                    style={{
                      borderTopWidth: i ? 1 : 0,
                      borderColor: colors.border,
                    }}
                  >
                    <SubscriptionRow
                      subscription={event.subscription}
                      reference={reference}
                      days={event.days}
                      eventType={event.type}
                    />
                  </View>
                ))
              ) : (
                <Empty
                  title="Your first step to clarity."
                  body="Add the subscriptions you use. We’ll keep their renewals neatly in view."
                  action="Add your first subscription"
                  onPress={() => router.push("/subscription/new")}
                />
              )}
            </Card>
          </AnimatedIn>
          <AnimatedIn delay={100}>
            <View
              style={{
                backgroundColor: colors.mint,
                borderRadius: 18,
                padding: 22,
                flexDirection: "row",
                gap: 14,
                alignItems: "center",
                marginTop: 20,
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Sparkles size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Label bold size={13}>
                  {week.length
                    ? week.length +
                      (week.length === 1 ? " renewal" : " renewals") +
                      " in the next 7 days."
                    : "A quieter week ahead."}
                </Label>
                <Label size={11} color={colors.secondary}>
                  {week.length
                    ? "A good time to make sure they still work for you."
                    : "No scheduled renewals in the next 7 days."}
                </Label>
                {week.some((e) => e.type === "trial") && (
                  <Label size={11} color={colors.warning}>
                    A free trial ends this week. Review it before billing
                    begins.
                  </Label>
                )}
              </View>
            </View>
          </AnimatedIn>
        </View>
        <View style={{ flex: wide ? 1 : undefined }}>
          <AnimatedIn delay={100}>
            <Card>
              <SectionTitle title="Where it goes" />
              {activeCount ? (
                <CategoryChart
                  subscriptions={data.subscriptions}
                  currency={currency}
                />
              ) : (
                <View style={{ paddingVertical: 24, gap: 10 }}>
                  <Label color={colors.secondary}>
                    Your spending breakdown will grow as you add subscriptions.
                  </Label>
                  <View
                    style={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: colors.mintStrong,
                      marginTop: 12,
                    }}
                  />
                </View>
              )}
            </Card>
          </AnimatedIn>
          {largest && (
            <Card style={{ marginTop: 20, gap: 8 }}>
              <Label bold size={13}>
                Largest recurring commitment
              </Label>
              <Label size={13}>
                {largest.name} · {formatMoney(annualCost(largest), currency)}{" "}
                {currency} / year
              </Label>
              <Label size={11} color={colors.secondary}>
                Based on estimated annual costs in {currency}.
              </Label>
            </Card>
          )}
          <Card style={{ marginTop: 20, padding: 22 }}>
            <View
              style={{
                flexDirection: "row",
                gap: 9,
                alignItems: "center",
                marginBottom: 9,
              }}
            >
              <ReceiptText size={18} color={colors.primary} />
              <Label bold size={13}>
                Less typing. More tracking.
              </Label>
            </View>
            <Label size={12} color={colors.secondary}>
              Import a receipt and we’ll help you find the subscription details.
            </Label>
            <View style={{ marginTop: 17 }}>
              <Button
                small
                variant="secondary"
                onPress={() => router.push("/import")}
                icon={ArrowRight}
              >
                Import a receipt
              </Button>
            </View>
          </Card>
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          gap: 7,
          justifyContent: "center",
          alignItems: "center",
          marginTop: 32,
        }}
      >
        <ShieldCheck size={13} color={colors.faint} />
        <Label size={10} color={colors.secondary}>
          Made for a clearer financial life.
        </Label>
      </View>
    </Page>
  );
}
