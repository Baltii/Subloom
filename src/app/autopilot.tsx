import { useMemo, useState } from "react";
import { Linking, Switch, View } from "react-native";
import * as Crypto from "expo-crypto";
import { useApp } from "../store/app";
import {
  autopilotSchema,
  emptyAutopilot,
  evaluateRule,
} from "../domain/autopilot";
import { emptyLedger, ledgerSchema } from "../domain/radar";
import { cancellationGuide } from "../domain/cancellation";
import { formatMoney, moneyInput, parseMoney } from "../domain/money";
import { today } from "../domain/renewal";
import { useFeatureSetting } from "../hooks/useFeatureSetting";
import { useDraftGuard } from "../hooks/useDraftGuard";
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
  return <OwnerFeature component={Autopilot} />;
}
function Autopilot() {
  const subscriptions = useApp((s) => s.data.subscriptions),
    timezone = useApp((s) => s.data.preferences.timezone),
    demo = useApp((s) => s.data.demo);
  const settings = useFeatureSetting(
      "autopilot",
      autopilotSchema,
      emptyAutopilot,
    ),
    ledger = useFeatureSetting(
      "payment_transactions",
      ledgerSchema,
      emptyLedger,
    ),
    action = useFeatureAction();
  const [id, setId] = useState(""),
    [askAnnual, setAskAnnual] = useState(true),
    [warnIncrease, setWarnIncrease] = useState(true),
    [limit, setLimit] = useState(""),
    [lead, setLead] = useState("7"),
    [reference, setReference] = useState(""),
    [selectedReview, setSelectedReview] = useState(""),
    [ruleDirty, setRuleDirty] = useState(false);
  const guard = useDraftGuard(ruleDirty || Boolean(reference), action.busy),
    date = today(timezone),
    disabled = !settings.loaded || settings.busy || action.busy || demo;
  const active = subscriptions.filter(
      (s) => s.status === "active" || s.status === "trial",
    ),
    chosen = active.find((s) => s.id === id);
  const rows = useMemo(
    () =>
      settings.value.flatMap((rule) => {
        const s = subscriptions.find((s) => s.id === rule.subscriptionId);
        const evaluation = s ? evaluateRule(s, rule, date, ledger.value) : null;
        return s && evaluation ? [{ s, rule, ...evaluation }] : [];
      }),
    [settings.value, subscriptions, date, ledger.value],
  );
  return (
    <FeaturePage
      title="Renewal Autopilot"
      subtitle="Set review rules, see why a renewal needs attention, and record what you handled at the provider."
      settings={settings}
      error={action.error}
    >
      <Badge tone="neutral">Manual provider actions</Badge>
      <Label>
        Rules are checked when this screen opens. Background rule notifications
        and automatic provider renewals are not enabled. Your existing renewal
        reminders still apply.
      </Label>
      <PaymentSettingState
        loaded={ledger.loaded}
        error={ledger.error}
        reload={ledger.reload}
      />
      <Heading size={22}>Renewal review queue</Heading>
      {!rows.length && settings.loaded ? (
        <Label>Add a rule below for an active subscription.</Label>
      ) : null}
      {rows.map((row) => {
        const url = cancellationGuide(row.s);
        return (
          <Card key={row.s.id}>
            <View style={{ gap: 12 }}>
              <Heading size={20}>{row.s.name}</Heading>
              <Label>
                {row.event.date} · expected{" "}
                {formatMoney(row.s.amountMinor, row.s.currency)}{" "}
                {row.s.currency}
              </Label>
              <Badge
                tone={
                  row.limitExceeded || row.changedCurrency
                    ? "warning"
                    : row.reviewed
                      ? "green"
                      : "neutral"
                }
              >
                {row.reviewed
                  ? "Reviewed for this date and price"
                  : row.due && row.reasons.length
                    ? "Needs review"
                    : "Rule saved"}
              </Badge>
              {row.reasons.map((reason) => (
                <Label key={reason}>{reason}</Label>
              ))}
              {row.latest ? (
                <Label>
                  Latest matched imported charge: {row.latest.date} ·{" "}
                  {formatMoney(row.latest.amountMinor, row.latest.currency)}{" "}
                  {row.latest.currency}
                </Label>
              ) : null}
              <Label>
                Baseline:{" "}
                {formatMoney(row.rule.baselineMinor, row.rule.currency)}{" "}
                {row.rule.currency}; review {row.rule.leadDays} days before
                renewal.
              </Label>
              {row.rule.decision?.key === row.key ? (
                <Label>
                  Recorded outcome:{" "}
                  {row.rule.decision.outcome === "reviewed"
                    ? "You reviewed the renewal"
                    : "You supplied provider confirmation"}{" "}
                  ·{" "}
                  {row.rule.decision.reference || "No provider action recorded"}
                </Label>
              ) : null}
              {url ? (
                <Button
                  variant="secondary"
                  onPress={() => void action.run(() => Linking.openURL(url))}
                >
                  Open provider management
                </Button>
              ) : (
                <Label>
                  Open the official account of the company that bills you. No
                  verified account link is available for this service.
                </Label>
              )}
              <Button
                variant="secondary"
                disabled={disabled || !ledger.loaded}
                onPress={() =>
                  void action.run(() =>
                    settings.save(
                      settings.value.map((r) =>
                        r.subscriptionId === row.s.id
                          ? {
                              ...r,
                              decision: {
                                key: row.key,
                                outcome: "reviewed",
                                reference: "",
                                recordedAt: new Date().toISOString(),
                              },
                            }
                          : r,
                      ),
                    ),
                  )
                }
              >
                Record renewal reviewed
              </Button>
              <Button
                variant="ghost"
                disabled={action.busy || Boolean(reference)}
                onPress={() => {
                  setSelectedReview(row.s.id);
                  setReference("");
                }}
              >
                Record provider confirmation
              </Button>
              {selectedReview === row.s.id ? (
                <View style={{ gap: 12 }}>
                  <Field
                    label="Provider confirmation reference"
                    value={reference}
                    onChangeText={(v) => {
                      setReference(v);
                    }}
                    maxLength={160}
                  />
                  <Button
                    disabled={disabled || !ledger.loaded || !reference.trim()}
                    onPress={() =>
                      void action.run(async () => {
                        await settings.save(
                          settings.value.map((r) =>
                            r.subscriptionId === row.s.id
                              ? {
                                  ...r,
                                  decision: {
                                    key: row.key,
                                    outcome: "provider_confirmed",
                                    reference,
                                    recordedAt: new Date().toISOString(),
                                  },
                                }
                              : r,
                          ),
                        );
                        setSelectedReview("");
                        setReference("");
                      })
                    }
                  >
                    Save supplied confirmation
                  </Button>
                </View>
              ) : null}
              <Button
                variant="ghost"
                disabled={disabled}
                onPress={() =>
                  void action.run(() =>
                    settings.save(
                      settings.value.filter(
                        (r) => r.subscriptionId !== row.s.id,
                      ),
                    ),
                  )
                }
              >
                Remove rule
              </Button>
            </View>
          </Card>
        );
      })}
      <Heading size={22}>Set or update a rule</Heading>
      <SelectField
        label="Subscription"
        value={id}
        disabled={action.busy || ruleDirty}
        hint="Save or discard rule edits before changing subscriptions."
        options={active.map((s) => ({ value: s.id, label: s.name }))}
        onChange={(value) => {
          setId(value);
          const rule = settings.value.find((r) => r.subscriptionId === value);
          setAskAnnual(rule?.askAnnual ?? true);
          setWarnIncrease(rule?.warnIncrease ?? true);
          setLead(String(rule?.leadDays ?? 7));
          setLimit(
            rule?.limitMinor != null &&
              rule.currency === active.find((s) => s.id === value)?.currency
              ? moneyInput(rule.limitMinor, rule.currency)
              : "",
          );
          setRuleDirty(false);
        }}
      />
      {chosen ? (
        <View style={{ gap: 16 }}>
          {[
            {
              label: "Ask me before annual renewals",
              value: askAnnual,
              change: setAskAnnual,
            },
            {
              label: "Warn me about recorded price increases",
              value: warnIncrease,
              change: setWarnIncrease,
            },
          ].map((toggle) => (
            <View
              key={toggle.label}
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <Label style={{ flex: 1 }}>{toggle.label}</Label>
              <Switch
                accessibilityLabel={toggle.label}
                value={toggle.value}
                onValueChange={(v) => {
                  toggle.change(v);
                  setRuleDirty(true);
                }}
              />
            </View>
          ))}
          <Field
            label={
              "Approved per-renewal limit · " + chosen.currency + " (optional)"
            }
            value={limit}
            onChangeText={(v) => {
              setLimit(v);
              setRuleDirty(true);
            }}
            keyboardType="decimal-pad"
          />
          <Field
            label="Review lead time (0–30 days)"
            value={lead}
            onChangeText={(v) => {
              setLead(v);
              setRuleDirty(true);
            }}
            keyboardType="number-pad"
          />
          <Label>
            Saving captures the current recorded price as the baseline. A limit
            is a review condition; it does not prevent billing or place a
            renewal order.
          </Label>
          <Button
            disabled={disabled}
            loading={action.busy}
            onPress={() =>
              void action.run(async () => {
                if (!/^\d{1,2}$/.test(lead))
                  throw new Error("Enter 0–30 days.");
                await settings.save([
                  ...settings.value.filter((r) => r.subscriptionId !== id),
                  {
                    subscriptionId: id,
                    askAnnual,
                    warnIncrease,
                    baselineMinor: chosen.amountMinor,
                    currency: chosen.currency,
                    limitMinor: limit
                      ? parseMoney(limit, chosen.currency)
                      : null,
                    leadDays: Number(lead),
                    revision: Crypto.randomUUID(),
                    baselineDate: date,
                    decision: null,
                  },
                ]);
                setRuleDirty(false);
              })
            }
          >
            Save renewal rule
          </Button>
          {ruleDirty ? (
            <Button
              variant="ghost"
              disabled={action.busy}
              onPress={() => {
                setId("");
                setLimit("");
                setLead("7");
                setRuleDirty(false);
              }}
            >
              Discard unsaved rule edits
            </Button>
          ) : null}
        </View>
      ) : null}
      {guard.confirmation}
    </FeaturePage>
  );
}
