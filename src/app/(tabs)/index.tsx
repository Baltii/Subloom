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
  Plus,
} from "lucide-react-native";
import { homeGreeting } from "../../domain/greeting";
import { convertedSubscriptions } from "../../domain/exchangeRates";
import { useDisplayCurrency } from "../../hooks/useDisplayCurrency";
import { SelectField } from "../../components/ui/Selection";
import { currencyOptions } from "../../components/ui/pickerOptions";
import {
  useApp,
  updatePreferences,
  notify,
  readableError,
} from "../../store/app";
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
  IconButton,
  Page,
  SectionTitle,
} from "../../components/ui/Primitives";
import { FinancialArt } from "../../components/ui/FinancialArt";
import { DashboardActions } from "../../components/ui/DashboardActions";
import { SubscriptionRow } from "../../components/subscriptions/SubscriptionRow";
import { ServiceIcon } from "../../components/subscriptions/ServiceIcon";
import { CategoryChart } from "../../components/ui/CategoryChart";
import { RenewalChart } from "../../components/ui/RenewalChart";
import { AnimatedMoney } from "../../components/ui/AnimatedMoney";
import { syncNow } from "../../services/sync";
export default function Home() {
  const [refreshing, setRefreshing] = useState(false);
  const { colors } = useTheme(),
    wide = useWide(),
    data = useApp((s) => s.data);
  const identity = useApp((state) => state.identity);
  const profile = useApp((state) => state.greetingProfile);
  const display = useDisplayCurrency();
  const { currency, query: rates } = display;
  const converted = useMemo(
    () =>
      convertedSubscriptions(
        data.subscriptions,
        currency,
        rates.data?.rates || [],
      ),
    [data.subscriptions, currency, rates.data],
  );
  const main = useMemo(
    () => recurringTotals(converted.subscriptions)[0],
    [converted.subscriptions],
  );
  const complete = converted.missing.length === 0;
  const displayedSubscriptions = useMemo(
    () =>
      new Map(
        converted.subscriptions.map((subscription) => [
          subscription.id,
          subscription,
        ]),
      ),
    [converted.subscriptions],
  );
  const hasConversion = data.subscriptions.some(
    (s) => ["active", "trial"].includes(s.status) && s.currency !== currency,
  );
  const events = useMemo(
    () => upcoming(data.subscriptions, data.preferences.timezone),
    [data.subscriptions, data.preferences.timezone],
  );
  const largest = converted.subscriptions
    .filter((s) => ["active", "trial"].includes(s.status))
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
      title={homeGreeting(identity, profile)}
      subtitle={dateLabel(reference, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })}
      leadingActions={
        <View style={{ width: 80 }}>
          <SelectField
            label="App currency"
            testID="home-currency"
            value={currency}
            options={currencyOptions}
            compact
            searchable
            onChange={(currency) => {
              void updatePreferences({
                currency,
                highRenewalThresholdMinor: null,
              }).catch((error) => notify(readableError(error), "error"));
            }}
          />
        </View>
      }
      right={
        <IconButton
          icon={Plus}
          label="Add subscription"
          onPress={() => router.push("/subscription/new")}
        />
      }
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
              minHeight: 216,
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
                right: 20,
                top: 12,
              }}
            >
              {wide ? <FinancialArt kind="renewals" size={140} /> : null}
            </View>
            <View style={{ gap: 12, paddingRight: wide ? 130 : 0 }}>
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
                {complete ? (
                  <AnimatedMoney
                    amountMinor={main?.monthly || 0}
                    currency={currency}
                    size={wide ? 54 : 45}
                    color={colors.heroText}
                  />
                ) : (
                  <Label size={wide ? 54 : 45} color={colors.heroText}>
                    —
                  </Label>
                )}
                <Label color={colors.heroSecondary} size={12}>
                  {currency} / month
                </Label>
              </View>
              <Label size={12} color={colors.heroSecondary}>
                {complete
                  ? `${formatMoney(main?.annual || 0, currency)} estimated per year`
                  : rates.isPending
                    ? "Loading exchange rates…"
                    : "Total unavailable · missing exchange rates"}
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
              minHeight: 216,
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
                    {display.format(
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
      {!complete && !rates.isPending && (
        <Card style={{ marginBottom: 24, gap: 12 }}>
          <Label color={colors.secondary}>
            Rates for {converted.missing.join(", ")} → {currency} are
            unavailable. Your original prices are saved.
          </Label>
          <Button
            small
            variant="secondary"
            loading={rates.isFetching}
            onPress={() => void rates.refetch()}
          >
            Retry exchange rates
          </Button>
        </Card>
      )}
      <DashboardActions />
      {complete && (
        <Card style={{ marginBottom: 24 }}>
          <SectionTitle title="Your next six months" />
          <RenewalChart
            subscriptions={converted.subscriptions}
            currency={currency}
            reference={reference}
          />
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
                onPress={() => router.push("/calendar")}
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
                      displayPrice={
                        displayedSubscriptions.get(event.subscription.id) ||
                        null
                      }
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
              {!complete ? (
                <Label size={12} color={colors.secondary}>
                  Your spending breakdown will appear when exchange rates are
                  available.
                </Label>
              ) : activeCount ? (
                <CategoryChart
                  converted={hasConversion}
                  subscriptions={converted.subscriptions}
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
          {complete && largest && (
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
