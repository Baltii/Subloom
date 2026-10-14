import { useMemo, useState } from "react";
import { Switch, View } from "react-native";
import { useApp } from "../store/app";
import {
  coachSchema,
  emptyCoach,
  costPerUse,
  offerComparison,
  possibleOverlap,
  rotationPlan,
  monthSchema,
} from "../domain/valueCoach";
import { ledgerSchema, emptyLedger } from "../domain/radar";
import { formatMoney, parseMoney } from "../domain/money";
import { today } from "../domain/renewal";
import { useFeatureSetting } from "../hooks/useFeatureSetting";
import { useDraftGuard } from "../hooks/useDraftGuard";
import {
  FeaturePage,
  OwnerFeature,
  useFeatureAction,
} from "../components/control-center/Feature";
import { PaymentSettingState } from "../components/payments/PaymentSettingState";
import {
  Badge,
  Button,
  Card,
  Field,
  Heading,
  Label,
} from "../components/ui/Primitives";
import { SelectField } from "../components/ui/Selection";
export default function Route() {
  return <OwnerFeature component={Coach} />;
}
function Coach() {
  const subscriptions = useApp((s) => s.data.subscriptions),
    timezone = useApp((s) => s.data.preferences.timezone),
    demo = useApp((s) => s.data.demo);
  const settings = useFeatureSetting("coach", coachSchema, emptyCoach),
    ledger = useFeatureSetting(
      "payment_transactions",
      ledgerSchema,
      emptyLedger,
    ),
    action = useFeatureAction(),
    date = today(timezone);
  const [id, setId] = useState(""),
    [month, setMonth] = useState(date.slice(0, 7)),
    [uses, setUses] = useState(""),
    [goal, setGoal] = useState<"keep" | "review" | "rotate">("review"),
    [monthly, setMonthly] = useState(""),
    [annual, setAnnual] = useState(""),
    [reference, setReference] = useState(""),
    [verified, setVerified] = useState(false),
    [visibleCheckins, setVisibleCheckins] = useState(30),
    [visibleQuotes, setVisibleQuotes] = useState(30);
  const hasDraft = Boolean(uses || monthly || annual || reference || verified);
  const guard = useDraftGuard(hasDraft, action.busy),
    chosen = subscriptions.find((s) => s.id === id),
    disabled = !settings.loaded || action.busy || demo;
  const insights = useMemo(
    () =>
      settings.value.checkins.map((c) => {
        const s =
          subscriptions.find((row) => row.id === c.subscriptionId) ?? null;
        return {
          s,
          c,
          ...(s
            ? costPerUse(s, c, ledger.value)
            : {
                totalMinor: null,
                perUseMinor: null,
                basis: "Subscription removed; cost unavailable",
                creditMinor: 0,
              }),
        };
      }),
    [settings.value.checkins, subscriptions, ledger.value],
  );
  const overlaps = useMemo(
    () => possibleOverlap(subscriptions),
    [subscriptions],
  );
  const rotation = useMemo(
    () =>
      rotationPlan(
        subscriptions,
        settings.value.checkins
          .filter((c) => c.month === date.slice(0, 7) && c.goal === "rotate")
          .map((c) => c.subscriptionId),
        date.slice(0, 7),
      ),
    [subscriptions, settings.value.checkins, date],
  );
  return (
    <FeaturePage
      title="Subscription Value Coach"
      subtitle="Use optional check-ins and confirmed prices to make your own subscription decisions."
      settings={settings}
      error={action.error}
    >
      <Badge tone="neutral">Your usage · your goals</Badge>
      <Label>
        Usage is supplied by you. Cost-per-use uses matched imported net charges
        when present, otherwise a current recurring estimate. Imported history
        may be incomplete and annual bills can make individual months uneven.
      </Label>
      <PaymentSettingState
        loaded={ledger.loaded}
        error={ledger.error}
        reload={ledger.reload}
      />
      <Heading size={22}>Usage check-in</Heading>
      <SelectField
        label="Subscription"
        value={id}
        disabled={hasDraft || action.busy}
        hint="Save or discard check-in and quote fields before changing subscriptions."
        options={subscriptions.map((s) => ({ value: s.id, label: s.name }))}
        onChange={setId}
      />
      {chosen ? (
        <View style={{ gap: 12 }}>
          <Field
            label="Usage month (YYYY-MM)"
            value={month}
            onChangeText={setMonth}
          />
          <Field
            label="Number of uses this month"
            value={uses}
            onChangeText={setUses}
            keyboardType="number-pad"
          />
          <SelectField
            label="My goal"
            value={goal}
            options={[
              { value: "keep", label: "Keep and use regularly" },
              { value: "review", label: "Review whether it is worth keeping" },
              { value: "rotate", label: "Consider rotating monthly services" },
            ]}
            onChange={setGoal}
          />
          <Button
            disabled={disabled}
            loading={action.busy}
            onPress={() =>
              void action.run(async () => {
                monthSchema.parse(month);
                if (!/^\d{1,5}$/.test(uses))
                  throw new Error(
                    "Enter a whole number of uses from 0 to 10000.",
                  );
                await settings.save({
                  ...settings.value,
                  checkins: [
                    ...settings.value.checkins.filter(
                      (c) => c.subscriptionId !== id || c.month !== month,
                    ),
                    { subscriptionId: id, month, uses: Number(uses), goal },
                  ],
                });
                setUses("");
              })
            }
          >
            Save usage check-in
          </Button>
          <Heading size={20}>Compare confirmed price options</Heading>
          <Field
            label={"Confirmed monthly price · " + chosen.currency}
            value={monthly}
            onChangeText={setMonthly}
            keyboardType="decimal-pad"
          />
          <Field
            label={"Confirmed annual price · " + chosen.currency}
            value={annual}
            onChangeText={setAnnual}
            keyboardType="decimal-pad"
          />
          <Field
            label="Where you confirmed these prices"
            value={reference}
            onChangeText={setReference}
            maxLength={160}
          />
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Label style={{ flex: 1 }}>
              I checked that both prices cover the same service and plan
            </Label>
            <Switch
              accessibilityLabel="I confirmed comparable monthly and annual prices"
              value={verified}
              onValueChange={setVerified}
            />
          </View>
          <Button
            disabled={disabled || !verified}
            onPress={() =>
              void action.run(async () => {
                await settings.save({
                  ...settings.value,
                  quotes: [
                    ...settings.value.quotes.filter(
                      (q) => q.subscriptionId !== id,
                    ),
                    {
                      subscriptionId: id,
                      currency: chosen.currency,
                      monthlyMinor: parseMoney(monthly, chosen.currency),
                      annualMinor: parseMoney(annual, chosen.currency),
                      reference,
                      confirmedDate: date,
                    },
                  ],
                });
                setMonthly("");
                setAnnual("");
                setReference("");
                setVerified(false);
              })
            }
          >
            Save confirmed comparison
          </Button>
        </View>
      ) : (
        <Label>
          Choose a service to record a check-in or compare confirmed prices.
        </Label>
      )}
      {hasDraft ? (
        <Button
          variant="ghost"
          disabled={action.busy}
          onPress={() => {
            setUses("");
            setMonthly("");
            setAnnual("");
            setReference("");
            setVerified(false);
          }}
        >
          Discard unsaved check-in and quote fields
        </Button>
      ) : null}
      <Heading size={22}>Your check-ins</Heading>
      {!insights.length && settings.loaded ? (
        <Label>No usage check-ins yet.</Label>
      ) : (
        insights
          .toReversed()
          .slice(0, visibleCheckins)
          .map((row) => (
            <Card key={row.c.subscriptionId + row.c.month}>
              <View style={{ gap: 10 }}>
                <Heading size={18}>
                  {row.s?.name ?? "Deleted subscription"} · {row.c.month}
                </Heading>
                <Label>
                  {row.c.uses} uses · goal: {row.c.goal}
                </Label>
                <Label>
                  {row.s && row.totalMinor !== null
                    ? formatMoney(row.totalMinor, row.s.currency) +
                      " " +
                      row.s.currency
                    : "Cost unavailable"}{" "}
                  · {row.basis}
                </Label>
                <Label>
                  {row.s && row.perUseMinor !== null
                    ? formatMoney(row.perUseMinor, row.s.currency) +
                      " " +
                      row.s.currency +
                      " per use"
                    : row.c.uses === 0
                      ? "No uses recorded; cost per use is undefined."
                      : "No current estimate is available for this tracking status."}
                </Label>
                {row.s && row.creditMinor ? (
                  <Label>
                    Net imported credit:{" "}
                    {formatMoney(row.creditMinor, row.s.currency)}{" "}
                    {row.s.currency}
                  </Label>
                ) : null}
                <Button
                  variant="ghost"
                  disabled={disabled}
                  onPress={() =>
                    void action.run(() =>
                      settings.save({
                        ...settings.value,
                        checkins: settings.value.checkins.filter(
                          (c) =>
                            c.subscriptionId !== row.c.subscriptionId ||
                            c.month !== row.c.month,
                        ),
                      }),
                    )
                  }
                >
                  Remove check-in
                </Button>
              </View>
            </Card>
          ))
      )}
      {insights.length > visibleCheckins ? (
        <Button
          variant="secondary"
          onPress={() => setVisibleCheckins((v) => v + 30)}
        >
          Show more check-ins
        </Button>
      ) : null}
      <Heading size={22}>Price comparisons</Heading>
      {settings.value.quotes
        .toReversed()
        .slice(0, visibleQuotes)
        .map((q) => {
          const result = offerComparison(q),
            s = subscriptions.find((row) => row.id === q.subscriptionId);
          return (
            <View key={q.subscriptionId} style={{ gap: 8 }}>
              <Heading size={18}>
                {s?.name ?? "Deleted subscription"} · {q.currency}
              </Heading>
              <Label>
                {result.annualSavingMinor >= 0
                  ? "Annual option saves "
                  : "Annual option costs an extra "}
                {formatMoney(Math.abs(result.annualSavingMinor), q.currency)}{" "}
                over 12 monthly payments.
              </Label>
              <Label>
                {result.breakEvenMonths !== null
                  ? "Annual price equals about " +
                    result.breakEvenMonths +
                    " monthly payments."
                  : "The monthly price is zero; a break-even point is unavailable."}{" "}
                Prices confirmed {q.confirmedDate}: {q.reference}. Assumes equal
                plan coverage, no taxes or discounts beyond the supplied quotes,
                and 12 months of use.
              </Label>
              {s && s.currency !== q.currency ? (
                <Label>
                  The subscription currency changed; update this comparison
                  before using it.
                </Label>
              ) : null}
              <Button
                variant="ghost"
                disabled={disabled}
                onPress={() =>
                  void action.run(() =>
                    settings.save({
                      ...settings.value,
                      quotes: settings.value.quotes.filter(
                        (row) => row.subscriptionId !== q.subscriptionId,
                      ),
                    }),
                  )
                }
              >
                Remove comparison
              </Button>
            </View>
          );
        })}
      {settings.value.quotes.length > visibleQuotes ? (
        <Button
          variant="secondary"
          onPress={() => setVisibleQuotes((v) => v + 30)}
        >
          Show more price comparisons
        </Button>
      ) : null}
      <Heading size={22}>Potential overlap</Heading>
      {overlaps.length ? (
        overlaps.map((rows) => (
          <Label key={rows[0]!.category + rows[0]!.currency}>
            {rows[0]!.category} · {rows[0]!.currency}:{" "}
            {rows.map((s) => s.name).join(", ")}. Shared categories suggest a
            review; they do not prove these services are interchangeable.
          </Label>
        ))
      ) : (
        <Label>No active services share a category and currency.</Label>
      )}
      <Heading size={22}>Rotation illustration</Heading>
      {rotation ? (
        <View style={{ gap: 10 }}>
          <Label>
            {formatMoney(rotation.savingMinor, rotation.currency)}{" "}
            {rotation.currency} estimated savings over 12 months, compared with
            keeping every selected service active.
          </Label>
          {rotation.schedule.map((row) => (
            <Label key={row.month}>
              {row.month} · {row.subscription.name}
            </Label>
          ))}
          <Label>
            Based on your current-month rotate goals. Assumes one service active
            each month, unchanged monthly prices, immediate
            cancellation/restart, no fees, and no overlapping paid access. You
            must make provider changes yourself.
          </Label>
        </View>
      ) : (
        <Label>
          Set this month’s goal to rotate for 2–12 active, monthly services in
          the same category and currency to preview a schedule. Annual and trial
          services are excluded.
        </Label>
      )}
      {guard.confirmation}
    </FeaturePage>
  );
}
