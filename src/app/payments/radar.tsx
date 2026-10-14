import { useMemo, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import {
  Button,
  Card,
  Chips,
  Confirm,
  Field,
  Heading,
  Label,
  Page,
} from "../../components/ui/Primitives";
import { SelectField } from "../../components/ui/Selection";
import { useFeatureSetting } from "../../hooks/useFeatureSetting";
import {
  useApp,
  saveSubscription,
  notify,
  readableError,
} from "../../store/app";
import {
  emptyLedger,
  ledgerSchema,
  recurringStreams,
  suggestSubscriptions,
  matchedDifference,
  type PaymentTransaction,
} from "../../domain/radar";
import {
  emptyPaymentProfile,
  paymentProfileSchema,
} from "../../domain/payments";
import { subscriptionSchema, type Subscription } from "../../domain/models";
import { formatMoney } from "../../domain/money";
import { advanceRenewal, nextEvent, today } from "../../domain/renewal";
import { PaymentSettingState } from "../../components/payments/PaymentSettingState";
function Radar() {
  const ledger = useFeatureSetting(
      "payment_transactions",
      ledgerSchema,
      emptyLedger,
    ),
    profile = useFeatureSetting(
      "payment_sources",
      paymentProfileSchema,
      emptyPaymentProfile,
    );
  const subscriptions = useApp((s) => s.data.subscriptions),
    identity = useApp((s) => s.identity),
    timezone = useApp((s) => s.data.preferences.timezone),
    demo = useApp((s) => s.data.demo);
  const [filter, setFilter] = useState<
      "All" | "Unmatched" | "Matched" | "Ignored"
    >("Unmatched"),
    [query, setQuery] = useState(""),
    [visible, setVisible] = useState(30),
    [selected, setSelected] = useState<PaymentTransaction | null>(null),
    [match, setMatch] = useState(""),
    [track, setTrack] = useState<Subscription | null>(null),
    [error, setError] = useState<string | null>(null);
  const streams = useMemo(() => recurringStreams(ledger.value), [ledger.value]);
  const rows = useMemo(
    () =>
      ledger.value.filter(
        (t) =>
          (filter === "All" || filter === "Ignored"
            ? filter === "All" || t.ignored
            : !t.ignored &&
              (filter === "Matched"
                ? Boolean(t.subscriptionId)
                : !t.subscriptionId)) &&
          t.merchant.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [ledger.value, query, filter],
  );
  async function update(id: string, changes: Partial<PaymentTransaction>) {
    setError(null);
    try {
      await ledger.save(
        ledger.value.map((t) => (t.id === id ? { ...t, ...changes } : t)),
      );
      notify("Transaction review saved.");
    } catch (e) {
      setError(readableError(e));
      throw e;
    }
  }
  function prepare(stream: ReturnType<typeof recurringStreams>[number]) {
    const now = new Date().toISOString(),
      last = stream.latest;
    const s = subscriptionSchema.parse({
      id: Crypto.randomUUID(),
      userId: identity,
      serviceId: null,
      name: stream.merchant,
      category: "Other",
      amountMinor: last.amountMinor,
      currency: stream.currency,
      interval: stream.interval,
      intervalCount: 1,
      customUnit: "month",
      startDate: last.date,
      nextRenewal: advanceRenewal(last.date, {
        interval: stream.interval,
        intervalCount: 1,
        customUnit: "month",
        anchorDay: Number(last.date.slice(-2)),
      }),
      anchorDay: Number(last.date.slice(-2)),
      trialEnd: null,
      canceledAt: null,
      paidThrough: null,
      status: "active",
      paymentMethod:
        profile.value.sources.find((s) => s.id === last.sourceId)?.name ?? "",
      notes:
        "Created after reviewing recurring transactions imported into Subscription Radar.",
      source: "manual",
      reminders: null,
      createdAt: now,
      updatedAt: now,
      version: 0,
    });
    s.nextRenewal = nextEvent(s, today(timezone))!.date;
    setTrack(s);
  }
  return (
    <Page
      title="Subscription Radar"
      subtitle="Discover recurring payments and compare imported charges with your tracked subscriptions."
      back
    >
      <View style={{ gap: 24 }}>
        <PaymentSettingState
          loaded={ledger.loaded}
          error={ledger.error}
          reload={ledger.reload}
        />
        <PaymentSettingState
          loaded={profile.loaded}
          error={profile.error}
          reload={profile.reload}
        />
        <Button
          disabled={demo}
          onPress={() => router.push("/payments/statement")}
        >
          Import a statement
        </Button>
        {streams.length ? (
          <View style={{ gap: 16 }}>
            <Heading size={23}>Recurring patterns to review</Heading>
            <Label size={13}>
              Three or more charge dates with a consistent weekly, monthly, or
              yearly cadence. These patterns may include payments that are not
              subscriptions.
            </Label>
            {streams.map((stream) => (
              <View key={stream.key} style={{ gap: 8, paddingVertical: 14 }}>
                <Heading size={20}>{stream.merchant}</Heading>
                <Label>
                  {stream.count} charge dates · possible {stream.interval}{" "}
                  payment · latest{" "}
                  {formatMoney(stream.latest.amountMinor, stream.currency)}{" "}
                  {stream.currency}
                </Label>
                {stream.changeMinor ? (
                  <Label>
                    Latest charge{" "}
                    {stream.changeMinor > 0 ? "increased" : "decreased"} by{" "}
                    {formatMoney(Math.abs(stream.changeMinor), stream.currency)}{" "}
                    {stream.currency}.
                  </Label>
                ) : null}
                {!stream.confirmed &&
                !suggestSubscriptions(stream.latest, subscriptions).length ? (
                  <Button
                    small
                    variant="secondary"
                    disabled={demo || !profile.loaded}
                    onPress={() => prepare(stream)}
                  >
                    Review as a new subscription
                  </Button>
                ) : (
                  <Label size={13}>Review its transaction matches below.</Label>
                )}
              </View>
            ))}
          </View>
        ) : null}
        <Heading size={23}>Imported transactions</Heading>
        <Field
          label="Find a merchant"
          value={query}
          maxLength={80}
          onChangeText={(value) => {
            setQuery(value);
            setVisible(30);
          }}
        />
        <Chips
          values={["All", "Unmatched", "Matched", "Ignored"] as const}
          selected={filter}
          onChange={(value) => {
            setFilter(value);
            setVisible(30);
          }}
        />
        {ledger.loaded && !rows.length ? (
          <Label>
            {ledger.value.length
              ? "No transactions match this view."
              : "Import a statement to start reviewing actual charge records."}
          </Label>
        ) : null}
        {rows.slice(0, visible).map((t) => {
          const difference = matchedDifference(t, subscriptions),
            suggestions = suggestSubscriptions(t, subscriptions);
          return (
            <Card key={t.id}>
              <View style={{ gap: 10 }}>
                <Heading size={20}>{t.merchant}</Heading>
                <Label>
                  {t.date} ·{" "}
                  {t.direction === "debit" ? "Charge" : "Refund / credit"} ·{" "}
                  {formatMoney(t.amountMinor, t.currency)} {t.currency}
                </Label>
                <Label size={12}>
                  Imported statement ·{" "}
                  {profile.value.sources.find((s) => s.id === t.sourceId)
                    ?.name ?? "Unassigned source"}
                  {t.reference ? " · " + t.reference : ""}
                </Label>
                <Label>
                  {t.subscriptionId
                    ? (subscriptions.find((s) => s.id === t.subscriptionId)
                        ?.name ?? "Linked subscription was removed")
                    : suggestions.length
                      ? "Suggested match: " +
                        suggestions.map((s) => s.name).join(", ")
                      : "Unmatched"}
                </Label>
                {difference?.difference ? (
                  <Label>
                    Imported charge is{" "}
                    {formatMoney(Math.abs(difference.difference), t.currency)}{" "}
                    {t.currency} {difference.difference > 0 ? "above" : "below"}{" "}
                    the current recorded subscription price. Review fees, taxes,
                    and billing period before editing the price.
                  </Label>
                ) : null}
                <View
                  style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}
                >
                  <Button
                    small
                    variant="secondary"
                    disabled={ledger.busy || demo}
                    onPress={() => {
                      setSelected(t);
                      setMatch(
                        t.subscriptionId ??
                          (suggestions.length === 1 ? suggestions[0]!.id : ""),
                      );
                    }}
                  >
                    Review match
                  </Button>
                  <Button
                    small
                    variant="ghost"
                    loading={ledger.busy}
                    disabled={demo}
                    onPress={() =>
                      void update(t.id, { ignored: !t.ignored }).catch(() => {})
                    }
                  >
                    {t.ignored
                      ? "Restore to review"
                      : "Ignore this transaction"}
                  </Button>
                </View>
              </View>
            </Card>
          );
        })}
        {rows.length > visible ? (
          <Button variant="secondary" onPress={() => setVisible((v) => v + 30)}>
            Show more transactions
          </Button>
        ) : null}
        <Label size={13}>
          Imports are user-supplied records. A missing charge does not prove
          payment failed. Matching never changes subscription prices, renewal
          dates, or cancellation status automatically.
        </Label>
        {error ? <Label accessibilityRole="alert">{error}</Label> : null}
      </View>
      <Confirm
        visible={selected !== null}
        title="Match this transaction"
        body={
          selected
            ? `${selected.merchant} · ${selected.date} · ${formatMoney(selected.amountMinor, selected.currency)} ${selected.currency}. Choose the subscription this record belongs to.`
            : ""
        }
        action="Save reviewed match"
        onClose={() => setSelected(null)}
        onConfirm={async () => {
          if (selected)
            await update(selected.id, { subscriptionId: match || null });
        }}
      >
        <SelectField
          label="Subscription match"
          value={match || "none"}
          options={[
            { value: "none", label: "Keep unmatched" },
            ...subscriptions
              .filter((s) => s.currency === selected?.currency)
              .map((s) => ({ value: s.id, label: s.name })),
          ]}
          searchable
          onChange={(value) => setMatch(value === "none" ? "" : value)}
        />
      </Confirm>
      <Confirm
        visible={track !== null}
        title="Track this recurring payment?"
        body={
          track
            ? `${track.name} · ${formatMoney(track.amountMinor, track.currency)} ${track.currency} · ${track.interval}. Estimated next renewal: ${track.nextRenewal}. You can edit all details after saving.`
            : ""
        }
        action="Add reviewed subscription"
        onClose={() => setTrack(null)}
        onConfirm={async () => {
          if (!track) return;
          if (useApp.getState().identity !== identity)
            throw new Error("Your account changed. Reopen Radar.");
          await saveSubscription(track);
          notify(
            "Reviewed subscription added. Match its transactions when ready.",
          );
          router.push({
            pathname: "/subscription/[id]",
            params: { id: track.id },
          });
        }}
      />
    </Page>
  );
}
export default function SubscriptionRadar() {
  const identity = useApp((s) => s.identity);
  return <Radar key={identity} />;
}
