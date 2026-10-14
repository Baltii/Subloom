import { useMemo, useState } from "react";
import { View } from "react-native";
import { useApp } from "../store/app";
import { currencies, type Currency } from "../domain/models";
import { reserveSchema, emptyReserve, reservePlan } from "../domain/reserve";
import { formatMoney, parseMoney } from "../domain/money";
import { today } from "../domain/renewal";
import { useFeatureSetting } from "../hooks/useFeatureSetting";
import { useDraftGuard } from "../hooks/useDraftGuard";
import {
  FeaturePage,
  OwnerFeature,
  useFeatureAction,
} from "../components/control-center/Feature";
import {
  Button,
  Card,
  Field,
  Heading,
  Label,
  Badge,
} from "../components/ui/Primitives";
import { SelectField } from "../components/ui/Selection";
export default function Route() {
  return <OwnerFeature component={Reserve} />;
}
function Reserve() {
  const subscriptions = useApp((s) => s.data.subscriptions),
    timezone = useApp((s) => s.data.preferences.timezone),
    demo = useApp((s) => s.data.demo);
  const settings = useFeatureSetting("reserve", reserveSchema, emptyReserve),
    action = useFeatureAction();
  const [payday, setPayday] = useState<string | null>(null),
    [currency, setCurrency] = useState<Currency>("EUR"),
    [amount, setAmount] = useState("");
  const guard = useDraftGuard(payday !== null || Boolean(amount), action.busy),
    reference = today(timezone),
    disabled = !settings.loaded || action.busy || demo;
  const calculation = useMemo(() => {
      try {
        return {
          plan: reservePlan(subscriptions, settings.value, reference),
          error: null,
        };
      } catch (e) {
        return {
          plan: null,
          error:
            e instanceof Error
              ? e.message
              : "Unable to calculate this schedule.",
        };
      }
    }, [subscriptions, settings.value, reference]),
    plan = calculation.plan;
  return (
    <FeaturePage
      title="Renewal Reserve"
      subtitle="Turn annual renewals into a savings plan, and review commitments due before your next payday."
      settings={settings}
      error={action.error}
    >
      <Badge tone="neutral">Planning buckets · no funds held</Badge>
      <Label>
        Planned amounts are figures you record for planning. Subloom does not
        hold, verify or transfer money.
      </Label>
      <Heading size={22}>Annual subscriptions, month by month</Heading>
      {plan?.monthly.length ? (
        plan.monthly.map((t) => (
          <Label key={t.currency}>
            {formatMoney(t.monthly, t.currency)} {t.currency} estimated monthly
            set-aside for {formatMoney(t.annual, t.currency)} {t.currency} in
            normalized annual commitments.
          </Label>
        ))
      ) : (
        <Label>No active annual subscription prices to plan for yet.</Label>
      )}
      <Label>
        Estimates use current recorded prices, including trial prices. They do
        not verify future charges. Each currency has its own plan.
      </Label>
      <Heading size={22}>Before your next payday</Heading>
      <Field
        label="Next payday (YYYY-MM-DD)"
        value={payday ?? settings.value.payday ?? plan?.payday ?? ""}
        onChangeText={(v) => {
          setPayday(v);
        }}
      />
      <Button
        disabled={disabled}
        onPress={() =>
          void action.run(async () => {
            const next = {
              ...settings.value,
              payday: payday ?? settings.value.payday ?? plan?.payday ?? null,
            };
            reserveSchema.parse(next);
            reservePlan(subscriptions, next, reference);
            await settings.save(next);
            setPayday(null);
          })
        }
      >
        Save next payday
      </Button>
      {calculation.error ? (
        <Label accessibilityRole="alert">{calculation.error}</Label>
      ) : null}
      {plan ? (
        <>
          <Label>
            From {reference} up to {plan.payday}, excluding payday itself.
          </Label>
          {plan.funding.map((f) => (
            <Card key={f.currency}>
              <View style={{ gap: 8 }}>
                <Heading size={18}>{f.currency} plan</Heading>
                <Label>
                  {formatMoney(f.dueMinor, f.currency)} expected charges ·{" "}
                  {formatMoney(f.plannedMinor, f.currency)} marked as planned
                </Label>
                <Label bold>
                  {formatMoney(f.gapMinor, f.currency)} additional amount to
                  plan for
                </Label>
              </View>
            </Card>
          ))}
          {plan.charges.length ? (
            plan.charges.slice(0, 50).map((e) => (
              <Label key={e.id}>
                {e.date} · {e.subscription.name} ·{" "}
                {formatMoney(
                  e.subscription.amountMinor,
                  e.subscription.currency,
                )}{" "}
                {e.subscription.currency} ·{" "}
                {e.type === "trial"
                  ? "trial-end price estimate"
                  : "expected charge"}
              </Label>
            ))
          ) : (
            <Label>No expected charges before this payday.</Label>
          )}
          {plan.charges.length > 50 ? (
            <Label>
              Showing the first 50 of {plan.charges.length} commitments. Choose
              an earlier payday to narrow the view.
            </Label>
          ) : null}
        </>
      ) : null}
      <Heading size={22}>Record a planning bucket</Heading>
      <SelectField
        label="Currency"
        value={currency}
        options={currencies.map((value) => ({ value, label: value }))}
        onChange={setCurrency}
      />
      <Field
        label="Amount already planned (not a bank balance)"
        value={amount}
        onChangeText={(v) => {
          setAmount(v);
        }}
        keyboardType="decimal-pad"
      />
      <Button
        disabled={disabled}
        loading={action.busy}
        onPress={() =>
          void action.run(async () => {
            await settings.save({
              ...settings.value,
              buckets: [
                ...settings.value.buckets.filter(
                  (b) => b.currency !== currency,
                ),
                { currency, plannedMinor: parseMoney(amount, currency) },
              ],
            });
            setAmount("");
          })
        }
      >
        Save planned amount
      </Button>
      {settings.value.buckets.map((b) => (
        <Button
          key={b.currency}
          variant="ghost"
          disabled={disabled}
          onPress={() =>
            void action.run(() =>
              settings.save({
                ...settings.value,
                buckets: settings.value.buckets.filter(
                  (row) => row.currency !== b.currency,
                ),
              }),
            )
          }
        >
          {"Remove " + b.currency + " bucket"}
        </Button>
      ))}
      <Heading size={22}>Next annual renewals</Heading>
      {plan?.rows.slice(0, 30).map((row) => (
        <View key={row.subscription.id} style={{ gap: 8 }}>
          <Heading size={18}>
            {row.subscription.name} · {row.date}
          </Heading>
          <Label>
            {formatMoney(
              row.subscription.amountMinor,
              row.subscription.currency,
            )}{" "}
            {row.subscription.currency} per expected renewal. Starting from
            zero, plan about{" "}
            {formatMoney(row.monthlyNeeded, row.subscription.currency)}{" "}
            {row.subscription.currency} per month across {row.periods} planning
            period(s).
          </Label>
        </View>
      ))}
      <Label>
        The catch-up illustration assumes zero allocated to that bill, 30-day
        planning periods and the first contribution now. Bills due in under 30
        days need the full amount this period. Buckets cover all upcoming
        commitments and are not allocated to individual bills.
      </Label>
      {guard.confirmation}
    </FeaturePage>
  );
}
