import { useMemo, useState } from "react";
import { View } from "react-native";
import { useApp } from "../store/app";
import { useFeatureSetting } from "../hooks/useFeatureSetting";
import { useDraftGuard } from "../hooks/useDraftGuard";
import {
  virtualPlansSchema,
  emptyVirtualPlans,
  planHistory,
  simulateControl,
  issuingReadiness,
} from "../domain/virtualPlans";
import { emptyLedger, ledgerSchema } from "../domain/radar";
import { formatMoney, moneyInput, parseMoney } from "../domain/money";
import { today } from "../domain/renewal";
import { shareText } from "../services/files";
import {
  FeaturePage,
  OwnerFeature,
  useFeatureAction,
} from "../components/control-center/Feature";
import { PaymentSettingState } from "../components/payments/PaymentSettingState";
import { SelectField } from "../components/ui/Selection";
import {
  Badge,
  Button,
  Card,
  Field,
  Heading,
  Label,
} from "../components/ui/Primitives";
export default function Route() {
  return <OwnerFeature component={Plans} />;
}
function Plans() {
  const subscriptions = useApp((s) => s.data.subscriptions),
    timezone = useApp((s) => s.data.preferences.timezone),
    demo = useApp((s) => s.data.demo);
  const settings = useFeatureSetting(
      "virtual_plans",
      virtualPlansSchema,
      emptyVirtualPlans,
    ),
    ledger = useFeatureSetting(
      "payment_transactions",
      ledgerSchema,
      emptyLedger,
    ),
    action = useFeatureAction();
  const [id, setId] = useState(""),
    [cap, setCap] = useState(""),
    [desiredState, setDesiredState] = useState<"allow" | "block">("allow"),
    [stop, setStop] = useState(""),
    [scenario, setScenario] = useState(""),
    [result, setResult] = useState(""),
    [dirty, setDirty] = useState(false);
  const guard = useDraftGuard(dirty, action.busy),
    date = today(timezone),
    chosen = subscriptions.find((s) => s.id === id),
    plan = settings.value.find((p) => p.subscriptionId === id),
    disabled = !settings.loaded || action.busy || demo;
  const history = useMemo(
    () => (plan ? planHistory(plan, ledger.value, date) : null),
    [plan, ledger.value, date],
  );
  return (
    <FeaturePage
      title="Virtual card plans"
      subtitle="Plan a dedicated card for each service and test its proposed controls before a consumer issuing partner is connected."
      settings={settings}
      error={action.error}
    >
      <Badge tone="warning">Planning only · cards unavailable</Badge>
      <Label>{issuingReadiness.reason}</Label>
      <Label>
        Initial market: personal consumers in Europe and the UK. Blocking a card
        payment would not cancel your contract with a provider.
      </Label>
      <SelectField
        label="Subscription"
        value={id}
        disabled={dirty || action.busy}
        hint="Save or discard control edits before changing subscriptions."
        options={subscriptions.map((s) => ({ value: s.id, label: s.name }))}
        onChange={(value) => {
          setId(value);
          const row = settings.value.find((p) => p.subscriptionId === value);
          setCap(
            row &&
              row.currency ===
                subscriptions.find((s) => s.id === value)?.currency
              ? moneyInput(row.monthlyCapMinor, row.currency)
              : "",
          );
          setDesiredState(row?.desiredState ?? "allow");
          setStop(row?.stopAfter ?? "");
          setResult("");
          setDirty(false);
        }}
      />
      {chosen ? (
        <View style={{ gap: 16 }}>
          <Heading size={20}>Proposed controls for {chosen.name}</Heading>
          <Field
            label={"Monthly cap · " + chosen.currency}
            value={cap}
            onChangeText={(v) => {
              setCap(v);
              setDirty(true);
            }}
            keyboardType="decimal-pad"
          />
          <SelectField
            label="Requested authorization state (not enforced)"
            value={desiredState}
            options={[
              { value: "allow", label: "Allow within planned cap" },
              { value: "block", label: "Block future authorizations in plan" },
            ]}
            onChange={(v) => {
              setDesiredState(v);
              setDirty(true);
            }}
          />
          <Field
            label="Last allowed date (optional YYYY-MM-DD)"
            hint="Use the trial end date if you want the plan to stop after your trial."
            value={stop}
            onChangeText={(v) => {
              setStop(v);
              setDirty(true);
            }}
          />
          <Button
            disabled={disabled}
            loading={action.busy}
            onPress={() =>
              void action.run(async () => {
                await settings.save([
                  ...settings.value.filter((p) => p.subscriptionId !== id),
                  {
                    subscriptionId: id,
                    currency: chosen.currency,
                    monthlyCapMinor: parseMoney(cap, chosen.currency),
                    desiredState,
                    stopAfter: stop || null,
                  },
                ]);
                setDirty(false);
                setResult("");
              })
            }
          >
            Save control plan
          </Button>
          {dirty ? (
            <Button
              variant="ghost"
              disabled={action.busy}
              onPress={() => {
                setCap(
                  plan && plan.currency === chosen.currency
                    ? moneyInput(plan.monthlyCapMinor, plan.currency)
                    : "",
                );
                setDesiredState(plan?.desiredState ?? "allow");
                setStop(plan?.stopAfter ?? "");
                setDirty(false);
                setResult("");
              }}
            >
              Discard unsaved control edits
            </Button>
          ) : null}
          {plan && plan.currency !== chosen.currency ? (
            <Label>
              The subscription currency changed. Enter and save a new cap in{" "}
              {chosen.currency} before using this plan.
            </Label>
          ) : null}
          {plan && history ? (
            <Card>
              <View style={{ gap: 12 }}>
                <Heading size={20}>Test the saved plan</Heading>
                <Label>
                  {formatMoney(history.spentMinor, plan.currency)}{" "}
                  {plan.currency} in matched imported debits this month. Credits
                  shown separately:{" "}
                  {formatMoney(history.creditMinor, plan.currency)}{" "}
                  {plan.currency}.
                </Label>
                <PaymentSettingState
                  loaded={ledger.loaded}
                  error={ledger.error}
                  reload={ledger.reload}
                />
                <Field
                  label={"Proposed charge · " + plan.currency}
                  value={scenario}
                  onChangeText={(v) => {
                    setScenario(v);
                    setResult("");
                  }}
                  keyboardType="decimal-pad"
                />
                <Button
                  variant="secondary"
                  disabled={!ledger.loaded || action.busy}
                  onPress={() =>
                    void action.run(async () => {
                      setResult(
                        simulateControl(
                          plan,
                          history.spentMinor,
                          parseMoney(scenario, plan.currency),
                          chosen.currency,
                          date,
                        ),
                      );
                    })
                  }
                >
                  Simulate planned control
                </Button>
                {result ? (
                  <Label accessibilityLiveRegion="polite">{result}</Label>
                ) : null}
                <Label>
                  This simulation has no pending authorizations, FX, fees or
                  unimported charges. Credits do not restore the simulated cap.
                  It is not an issuer decision.
                </Label>
                <Button
                  variant="secondary"
                  onPress={() =>
                    void action.run(() =>
                      shareText(
                        JSON.stringify(
                          { kind: "unenforced-control-plan", ...plan },
                          null,
                          2,
                        ),
                        "subloom-card-plan.json",
                        "application/json",
                      ),
                    )
                  }
                >
                  Export saved plan
                </Button>
                <Heading size={18}>Matched imported history</Heading>
                {history.history.slice(0, 30).map((t) => (
                  <Label key={t.id}>
                    {t.date} · {t.direction} ·{" "}
                    {formatMoney(t.amountMinor, t.currency)} {t.currency} ·{" "}
                    {t.reference || t.merchant}
                  </Label>
                ))}
                {!history.history.length ? (
                  <Label>
                    Import a statement and confirm its subscription matches to
                    see history.
                  </Label>
                ) : null}
              </View>
            </Card>
          ) : null}
        </View>
      ) : (
        <Label>Choose a subscription to create its card-control plan.</Label>
      )}
      <Heading size={20}>Saved plans</Heading>
      {!settings.value.length && settings.loaded ? (
        <Label>No control plans saved yet.</Label>
      ) : (
        settings.value.map((p) => (
          <View key={p.subscriptionId} style={{ gap: 8 }}>
            <Label>
              {subscriptions.find((s) => s.id === p.subscriptionId)?.name ??
                "Deleted subscription"}{" "}
              · {formatMoney(p.monthlyCapMinor, p.currency)} {p.currency} /
              month · {p.desiredState} (unenforced)
            </Label>
            <Button
              variant="ghost"
              disabled={disabled}
              onPress={() =>
                void action.run(() =>
                  settings.save(
                    settings.value.filter(
                      (row) => row.subscriptionId !== p.subscriptionId,
                    ),
                  ),
                )
              }
            >
              Remove saved plan
            </Button>
          </View>
        ))
      )}
      {guard.confirmation}
    </FeaturePage>
  );
}
