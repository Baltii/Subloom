import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { useApp } from "../../store/app";
import { useFeatureSetting } from "../../hooks/useFeatureSetting";
import { cancellationSchema } from "../../domain/cancellation";
import {
  calendarDays,
  calendarMonth,
  moveCalendarMonth,
} from "../../domain/calendar";
import {
  calendarEventLabels,
  monthEvents,
  type CalendarEvent,
} from "../../domain/calendarEvents";
import { dateLabel, today } from "../../domain/renewal";
import { useDisplayCurrency } from "../../hooks/useDisplayCurrency";
import type { Currency } from "../../domain/models";
import { useTheme, useWide } from "../../theme/useTheme";
import {
  Badge,
  Button,
  Card,
  Chips,
  Heading,
  IconButton,
  Label,
  Page,
} from "../../components/ui/Primitives";
import { FilterSheet } from "../../components/ui/FilterSheet";
import { ServiceIcon } from "../../components/subscriptions/ServiceIcon";

const initialPlans: ReturnType<typeof cancellationSchema.parse> = {};
const filters = [
  "All events",
  "Renewals",
  "Trials",
  "Deadlines",
  "Starts",
  "Access ends",
] as const;
const filterTypes: Record<
  (typeof filters)[number],
  CalendarEvent["type"] | null
> = {
  "All events": null,
  Renewals: "renewal",
  Trials: "trial",
  Deadlines: "deadline",
  Starts: "start",
  "Access ends": "paid_through",
};

export default function Calendar() {
  const { colors, isDark } = useTheme();
  const wide = useWide(),
    reduced = useReducedMotion();
  const data = useApp((state) => state.data);
  const display = useDisplayCurrency();
  const reference = today(data.preferences.timezone);
  const [month, setMonth] = useState(() => calendarMonth(reference, reference));
  const [selected, setSelected] = useState(reference);
  const [filter, setFilter] = useState<(typeof filters)[number]>("All events");
  const [currency, setCurrency] = useState<Currency | "All">("All");
  const [addByDate, setAddByDate] = useState(false);
  const settings = useFeatureSetting(
    "cancellation",
    cancellationSchema,
    initialPlans,
  );
  const reloadPlans = settings.reload;
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void reloadPlans();
    }, [reloadPlans]),
  );
  const plans = data.demo ? initialPlans : settings.value;
  const currencies = useMemo(
    () => [...new Set(data.subscriptions.map((row) => row.currency))].sort(),
    [data.subscriptions],
  );
  const effectiveCurrency =
    currency === "All" || currencies.includes(currency) ? currency : "All";
  const schedule = useMemo(() => {
    try {
      return {
        events: monthEvents(data.subscriptions, month, plans),
        error: null,
      };
    } catch (error) {
      return {
        events: [],
        error:
          error instanceof Error
            ? error.message
            : "Could not load this calendar.",
      };
    }
  }, [data.subscriptions, month, plans]);
  const visible = useMemo(
    () =>
      schedule.events.filter(
        (event) =>
          (filterTypes[filter] === null ||
            event.type === filterTypes[filter]) &&
          (effectiveCurrency === "All" ||
            event.subscription.currency === effectiveCurrency),
      ),
    [schedule.events, filter, effectiveCurrency],
  );
  const byDay = useMemo(() => {
    const groups = new Map<string, CalendarEvent[]>();
    for (const event of visible) {
      const group = groups.get(event.date) ?? [];
      group.push(event);
      groups.set(event.date, group);
    }
    return groups;
  }, [visible]);
  const dayEvents = byDay.get(selected) ?? [];
  const charges = visible.filter(
    (event) => event.type === "renewal" || event.type === "trial",
  );
  const total = display.total(charges.map((event) => event.subscription));
  function add(date: string) {
    setAddByDate(false);
    router.push({ pathname: "/subscription/new", params: { date } });
  }
  function move(amount: number) {
    const next = moveCalendarMonth(month, amount);
    setMonth(next);
    setSelected(next);
  }
  function eventColor(type: CalendarEvent["type"]) {
    return type === "deadline" || type === "trial"
      ? colors.warning
      : type === "start" || type === "paid_through"
        ? colors.secondary
        : colors.primary;
  }
  return (
    <Page
      title="Your subscription calendar."
      subtitle={data.preferences.timezone.replaceAll("_", " ")}
    >
      <View style={{ gap: 18 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <IconButton
              icon={ChevronLeft}
              label="Previous month"
              onPress={() => move(-1)}
            />
            <Heading size={wide ? 24 : 19}>
              {dateLabel(month, { month: "long", year: "numeric" })}
            </Heading>
            <IconButton
              icon={ChevronRight}
              label="Next month"
              onPress={() => move(1)}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button
              small
              variant="secondary"
              onPress={() => {
                setMonth(calendarMonth(reference, reference));
                setSelected(reference);
              }}
            >
              Today
            </Button>
            <Button
              small
              variant={addByDate ? "primary" : "secondary"}
              icon={Plus}
              onPress={() => setAddByDate((value) => !value)}
            >
              {addByDate ? "Cancel date selection" : "Add by date"}
            </Button>
          </View>
        </View>
        {addByDate && (
          <View
            style={{
              padding: 14,
              borderRadius: 12,
              backgroundColor: colors.mint,
            }}
            accessibilityLiveRegion="polite"
          >
            <Label bold color={colors.primary}>
              Choose a day to add a subscription.
            </Label>
            <Label size={12} color={colors.secondary}>
              The form opens with that renewal date filled in. You still review
              and save the subscription.
            </Label>
          </View>
        )}
        <FilterSheet<{
          filter: (typeof filters)[number];
          currency: Currency | "All";
        }>
          title="Calendar filters"
          value={{ filter, currency: effectiveCurrency }}
          defaults={{ filter: "All events", currency: "All" }}
          count={
            Number(filter !== "All events") +
            Number(effectiveCurrency !== "All")
          }
          summary={[
            filter !== "All events" ? filter : "",
            effectiveCurrency !== "All" ? effectiveCurrency : "",
          ]
            .filter(Boolean)
            .join(" · ")}
          onApply={(next) => {
            setFilter(next.filter);
            setCurrency(next.currency);
          }}
        >
          {(draft, update) => (
            <>
              <View style={{ gap: 8 }}>
                <Label bold>Event type</Label>
                <Chips
                  wrap
                  values={filters}
                  selected={draft.filter}
                  onChange={(filter) => update({ ...draft, filter })}
                />
              </View>
              <View style={{ gap: 8 }}>
                <Label bold>Original billing currency</Label>
                <Chips
                  wrap
                  values={["All", ...currencies] as const}
                  labels={{ All: "All currencies" }}
                  selected={draft.currency}
                  onChange={(currency) => update({ ...draft, currency })}
                />
                <Label size={12} color={colors.secondary}>
                  Prices are displayed in your app currency: {display.currency}.
                </Label>
              </View>
            </>
          )}
        </FilterSheet>
        {!data.demo && !settings.loaded && !settings.error && (
          <Label size={12} color={colors.secondary}>
            Loading your saved cancellation deadlines…
          </Label>
        )}
        {!data.demo && settings.error && (
          <View style={{ gap: 8 }}>
            <Label size={12} color={colors.error}>
              Cancellation deadlines could not load. Renewals below are still
              available. {settings.error}
            </Label>
            <Button
              small
              variant="secondary"
              onPress={() => void settings.reload()}
            >
              Retry deadlines
            </Button>
          </View>
        )}
        {schedule.error && (
          <Label accessibilityRole="alert" color={colors.error}>
            {schedule.error}
          </Label>
        )}
        <View
          style={{
            flexDirection: wide ? "row" : "column",
            alignItems: "flex-start",
            gap: 22,
          }}
        >
          <View
            style={{
              flex: wide ? 1.8 : undefined,
              width: wide ? undefined : "100%",
              minWidth: 0,
              gap: 16,
            }}
          >
            <Animated.View
              key={month}
              entering={reduced ? undefined : FadeIn.duration(150)}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                backgroundColor: colors.surface,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  backgroundColor: colors.background,
                }}
              >
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                  (day) => (
                    <View
                      key={day}
                      style={{
                        width: `${100 / 7}%`,
                        paddingVertical: 12,
                        alignItems: "center",
                      }}
                    >
                      <Label size={11} bold color={colors.secondary}>
                        {day}
                      </Label>
                    </View>
                  ),
                )}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {calendarDays(month).map((date, index) => {
                  const events = date ? (byDay.get(date) ?? []) : [];
                  const chosen = date === selected;
                  return (
                    <View
                      key={date ?? `blank-${index}`}
                      style={{
                        width: `${100 / 7}%`,
                        borderTopWidth: 1,
                        borderRightWidth: index % 7 === 6 ? 0 : 1,
                        borderColor: colors.border,
                      }}
                    >
                      {date ? (
                        <Pressable
                          testID={`calendar-day-${date}`}
                          accessibilityRole="button"
                          accessibilityState={{ selected: chosen }}
                          accessibilityLabel={`${dateLabel(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${date === reference ? ", today" : ""}, ${events.length} events${
                            events.length
                              ? ": " +
                                events
                                  .slice(0, 3)
                                  .map(
                                    (event) =>
                                      `${event.subscription.name} ${calendarEventLabels[event.type]}`,
                                  )
                                  .join(", ")
                              : ""
                          }`}
                          accessibilityHint={
                            addByDate
                              ? "Open a new subscription with this renewal date"
                              : "Show this day's events and add-subscription action"
                          }
                          onPress={() => {
                            setSelected(date);
                            if (addByDate) add(date);
                          }}
                          style={({ pressed }) => ({
                            minHeight: wide ? 125 : 84,
                            padding: wide ? 10 : 5,
                            gap: 7,
                            backgroundColor:
                              chosen || pressed ? colors.mint : "transparent",
                            borderWidth: 2,
                            borderColor: chosen
                              ? colors.primary
                              : "transparent",
                          })}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: wide ? "space-between" : "center",
                            }}
                          >
                            <View
                              style={{
                                minWidth: 26,
                                minHeight: 26,
                                borderRadius: 13,
                                justifyContent: "center",
                                alignItems: "center",
                                backgroundColor:
                                  date === reference
                                    ? colors.primary
                                    : "transparent",
                              }}
                            >
                              <Label
                                size={12}
                                bold={chosen || date === reference}
                                color={
                                  date === reference
                                    ? isDark
                                      ? "#102219"
                                      : "#FFFFFF"
                                    : chosen
                                      ? colors.primary
                                      : colors.text
                                }
                              >
                                {Number(date.slice(-2))}
                              </Label>
                            </View>
                            {wide && addByDate && (
                              <Plus size={14} color={colors.primary} />
                            )}
                          </View>
                          {wide ? (
                            events.slice(0, 2).map((event) => (
                              <View key={event.id} style={{ gap: 1 }}>
                                <Label size={11} numberOfLines={1}>
                                  {event.subscription.name}
                                </Label>
                                <Label
                                  size={11}
                                  color={eventColor(event.type)}
                                  numberOfLines={1}
                                >
                                  {event.type === "deadline"
                                    ? "Cancel by"
                                    : event.type === "start"
                                      ? "Starts"
                                      : calendarEventLabels[event.type]}
                                </Label>
                              </View>
                            ))
                          ) : events.length > 0 ? (
                            <View style={{ alignItems: "center", gap: 4 }}>
                              <View style={{ flexDirection: "row", gap: 3 }}>
                                {events.slice(0, 3).map((event) => (
                                  <View
                                    key={event.id}
                                    style={{
                                      width: 4,
                                      height: 4,
                                      borderRadius: 2,
                                      backgroundColor: eventColor(event.type),
                                    }}
                                  />
                                ))}
                              </View>
                              <Label size={11} color={colors.secondary}>
                                {events.length}
                              </Label>
                            </View>
                          ) : null}
                          {wide && events.length > 2 && (
                            <Label size={11} color={colors.secondary}>
                              +{events.length - 2} more
                            </Label>
                          )}
                        </Pressable>
                      ) : (
                        <View
                          style={{
                            minHeight: wide ? 125 : 84,
                            backgroundColor: colors.background,
                          }}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            </Animated.View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {Object.entries(calendarEventLabels).map(([type, label]) => (
                <Label
                  key={type}
                  size={11}
                  color={eventColor(type as CalendarEvent["type"])}
                >
                  {label}
                </Label>
              ))}
            </View>
            <Label size={11} color={colors.secondary}>
              Scheduled dates are projections, not confirmed payments. Trials
              assume conversion at the recorded price. Cancellation targets are
              your own saved deadlines, not merchant guarantees.
            </Label>
          </View>
          <View
            style={{
              flex: wide ? 1 : undefined,
              width: wide ? undefined : "100%",
              minWidth: 0,
              gap: 16,
            }}
          >
            <Card style={{ padding: 20, gap: 16 }}>
              <Heading size={20}>
                {dateLabel(selected, { month: "long", day: "numeric" })}
              </Heading>
              <Label size={12} color={colors.secondary}>
                {dayEvents.length} {dayEvents.length === 1 ? "event" : "events"}{" "}
                with current filters
              </Label>
              <Button small icon={Plus} onPress={() => add(selected)}>
                Add subscription on this date
              </Button>
              <View
                key={`${selected}:${filter}:${effectiveCurrency}`}
                style={{ gap: 14 }}
              >
                {dayEvents.map((event) => (
                  <Pressable
                    key={event.id}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${event.subscription.name}, ${calendarEventLabels[event.type]}`}
                    onPress={() =>
                      event.type === "deadline"
                        ? router.push({
                            pathname: "/cancellation",
                            params: { id: event.subscription.id },
                          })
                        : router.push({
                            pathname: "/subscription/[id]",
                            params: { id: event.subscription.id },
                          })
                    }
                    style={({ pressed }) => ({
                      minHeight: 48,
                      paddingVertical: 10,
                      flexDirection: "row",
                      gap: 10,
                      alignItems: "center",
                      borderTopWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: pressed ? colors.mint : "transparent",
                    })}
                  >
                    <ServiceIcon
                      serviceId={event.subscription.serviceId}
                      name={event.subscription.name}
                      size={34}
                    />
                    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      <Label bold size={13}>
                        {event.subscription.name}
                      </Label>
                      <Badge
                        tone={
                          event.type === "trial" || event.type === "deadline"
                            ? "warning"
                            : "neutral"
                        }
                      >
                        {calendarEventLabels[event.type]}
                      </Badge>
                      {(event.type === "trial" || event.type === "renewal") && (
                        <Label size={12}>
                          {display.format(
                            event.subscription.amountMinor,
                            event.subscription.currency,
                          )}{" "}
                          {display.currency} projected
                        </Label>
                      )}
                    </View>
                  </Pressable>
                ))}
                {!dayEvents.length && (
                  <View style={{ paddingVertical: 12, gap: 8 }}>
                    <CalendarDays size={24} color={colors.primary} />
                    <Label bold size={13}>
                      A clear day.
                    </Label>
                    <Label size={12} color={colors.secondary}>
                      No events match these filters. Add a subscription here or
                      select another day.
                    </Label>
                  </View>
                )}
              </View>
            </Card>
            <View style={{ gap: 10, padding: 4 }}>
              <Heading size={17}>Scheduled charges this month</Heading>
              {charges.length ? (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <Label size={12} color={colors.secondary}>
                    {display.currency}
                  </Label>
                  <Label size={14} bold>
                    {total === null
                      ? "Rate unavailable"
                      : display.format(total)}
                  </Label>
                </View>
              ) : (
                <Label size={12} color={colors.secondary}>
                  No projected charges with these filters.
                </Label>
              )}
              <Label size={11} color={colors.secondary}>
                Renewals and trial conversions, estimated in {display.currency}.
              </Label>
            </View>
            <Button
              small
              variant="ghost"
              onPress={() => router.push("/calendar-export")}
            >
              Export renewal calendar
            </Button>
          </View>
        </View>
      </View>
    </Page>
  );
}
