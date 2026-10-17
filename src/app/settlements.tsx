import { useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useApp } from "../store/app";
import { workspaceData } from "../services/workspaces";
import {
  settlementHistory,
  recordSettlementEntry,
  setLedgerVoided,
} from "../services/settlements";
import {
  settlementBalances,
  requestDraft,
  type LedgerDraft,
  type LedgerEntry,
} from "../domain/settlements";
import { currencies, dateSchema, type Currency } from "../domain/models";
import { formatMoney, parseMoney } from "../domain/money";
import { today } from "../domain/renewal";
import { shareText } from "../services/files";
import { useDraftGuard } from "../hooks/useDraftGuard";
import {
  OwnerFeature,
  useFeatureAction,
} from "../components/control-center/Feature";
import {
  Badge,
  Button,
  Card,
  Confirm,
  Field,
  Heading,
  Label,
  Page,
} from "../components/ui/Primitives";
import { SelectField } from "../components/ui/Selection";
const emptyEntries: LedgerEntry[] = [];
export default function Route() {
  return <OwnerFeature component={Settlements} />;
}
function Settlements() {
  const identity = useApp((s) => s.identity),
    demo = useApp((s) => s.data.demo),
    timezone = useApp((s) => s.data.preferences.timezone),
    action = useFeatureAction(),
    date = today(timezone);
  const [scope, setScope] = useState(""),
    [subscriptionId, setSubscriptionId] = useState(""),
    [kind, setKind] = useState<"settlement" | "request">("settlement"),
    [payer, setPayer] = useState(""),
    [payee, setPayee] = useState(identity),
    [currency, setCurrency] = useState<Currency>("EUR"),
    [amount, setAmount] = useState(""),
    [eventDate, setEventDate] = useState(date),
    [due, setDue] = useState(""),
    [note, setNote] = useState(""),
    [confirmation, setConfirmation] = useState<LedgerDraft | null>(null),
    [visible, setVisible] = useState(20);
  const pending = useRef<Record<string, string>>({}),
    guard = useDraftGuard(Boolean(amount || note || due), action.busy),
    account = identity !== "guest" && !demo;
  const spaces = useQuery({
    queryKey: ["settlement-spaces", identity],
    enabled: account,
    queryFn: () => workspaceData(identity),
  });
  const history = useQuery({
    queryKey: ["settlement-history", identity, scope],
    enabled: account && Boolean(scope),
    queryFn: () => settlementHistory(identity, scope),
  });
  const space = spaces.data?.workspaces.find((w) => w.id === scope),
    owner = space?.owner_id === identity,
    members =
      spaces.data?.members.filter((m) => m.workspace_id === scope) ?? [],
    items =
      spaces.data?.subscriptions.filter((s) => s.workspace_id === scope) ?? [],
    selected = items.find((s) => s.id === subscriptionId),
    records = history.error ? emptyEntries : (history.data ?? emptyEntries);
  const completeHistory = Boolean(history.data && !history.error);
  const balances = useMemo(() => settlementBalances(records), [records]);
  const name = (id: string) =>
    members.find((m) => m.user_id === id)?.display_name ?? "Former participant";
  const disabled =
    action.busy || history.isFetching || !completeHistory || !account;
  function entryId(type: string) {
    return (pending.current[type] ??= Crypto.randomUUID());
  }
  return (
    <Page
      title="Family Settlement Center"
      subtitle="Record shared charges and received settlements, review balances, and prepare payment requests."
      back
    >
      <View style={{ gap: 20 }}>
        <Badge tone="neutral">Recorded settlements · no money transfers</Badge>
        <Label>
          Balances come from recorded paid charges, using the cost split
          captured at recording time. Requests are reminders; they do not change
          balances or send messages.
        </Label>
        {!account ? (
          <View style={{ gap: 12 }}>
            <Label>
              Sign in to use shared family records. Guest tracking and sample
              data do not create shared balances.
            </Label>
            <Button onPress={() => router.push("/auth")}>
              Sign in for family settlements
            </Button>
          </View>
        ) : (
          <>
            <Button
              variant="secondary"
              loading={spaces.isFetching || history.isFetching}
              onPress={() =>
                void action.run(async () => {
                  await spaces.refetch();
                  if (scope) await history.refetch();
                })
              }
            >
              Reload shared records
            </Button>
            {spaces.error ? (
              <Label accessibilityRole="alert">{spaces.error.message}</Label>
            ) : null}
            {history.error ? (
              <Label accessibilityRole="alert">
                {history.error.message} Balances are unavailable until the
                complete history loads.
              </Label>
            ) : null}
            <SelectField
              label="Family workspace"
              value={scope}
              options={(spaces.data?.workspaces ?? [])
                .filter((w) => w.kind === "family")
                .map((w) => ({ value: w.id, label: w.name }))}
              onChange={(value) => {
                setScope(value);
                setSubscriptionId("");
                setPayer("");
                setPayee(identity);
                setVisible(20);
              }}
              disabled={Boolean(amount || note || due) || action.busy}
              hint="Save or clear draft fields before switching workspaces."
            />
            {spaces.data &&
            !spaces.data.workspaces.some((w) => w.kind === "family") ? (
              <Button
                variant="secondary"
                onPress={() => router.push("/workspaces")}
              >
                Create or join a family workspace
              </Button>
            ) : null}
            {space ? (
              <>
                <Heading size={22}>Balances owed</Heading>
                {history.isLoading ? (
                  <Label>Loading complete history…</Label>
                ) : null}
                {completeHistory && !balances.length ? (
                  <Label>
                    No balances owed in the current recorded history.
                  </Label>
                ) : null}
                {history.data
                  ? balances.map((b) => (
                      <Label key={b.debtor + b.creditor + b.currency}>
                        {name(b.debtor)} owes {name(b.creditor)}{" "}
                        {formatMoney(b.amountMinor, b.currency)} {b.currency}{" "}
                        from recorded charges and settlements.
                      </Label>
                    ))
                  : null}
                <Heading size={22}>Record a paid shared charge</Heading>
                <Label>
                  The billing owner or workspace owner can confirm a charge paid
                  at the current recorded price. Edit the shared subscription
                  first if the actual price or split differs.
                </Label>
                <SelectField
                  label="Shared subscription"
                  value={subscriptionId}
                  options={items
                    .filter((s) => owner || s.managed_by === identity)
                    .map((s) => ({
                      value: s.id,
                      label:
                        s.data.name +
                        " · " +
                        formatMoney(s.data.amountMinor, s.data.currency) +
                        " " +
                        s.data.currency,
                    }))}
                  onChange={setSubscriptionId}
                />
                <Field
                  label="Recorded date (YYYY-MM-DD)"
                  value={eventDate}
                  onChangeText={setEventDate}
                />
                <Field
                  label="Receipt or settlement reference"
                  value={note}
                  onChangeText={setNote}
                  maxLength={160}
                />
                <Button
                  disabled={disabled || !selected || !note.trim()}
                  onPress={() =>
                    void action.run(async () => {
                      if (!selected) return;
                      dateSchema.parse(eventDate);
                      if (eventDate > date)
                        throw new Error(
                          "Use today or an earlier date for a recorded payment.",
                        );
                      setConfirmation({
                        id: entryId("charge"),
                        workspace_id: scope,
                        kind: "charge",
                        payer: selected.managed_by,
                        payee: null,
                        currency: selected.data.currency,
                        amount_minor: selected.data.amountMinor,
                        event_date: eventDate,
                        subscription_id: selected.id,
                        shares: selected.shares,
                        note,
                        due_date: null,
                      });
                    })
                  }
                >
                  Review paid charge
                </Button>
                <Heading size={22}>Record a receipt or request</Heading>
                <SelectField
                  label="Record type"
                  value={kind}
                  options={[
                    { value: "settlement", label: "Settlement received" },
                    { value: "request", label: "Payment request draft" },
                  ]}
                  onChange={setKind}
                />
                <SelectField
                  label="From participant"
                  value={payer}
                  options={members.map((m) => ({
                    value: m.user_id,
                    label: m.display_name,
                  }))}
                  onChange={setPayer}
                />
                <SelectField
                  label="Recipient"
                  value={payee}
                  options={members
                    .filter((m) => owner || m.user_id === identity)
                    .map((m) => ({ value: m.user_id, label: m.display_name }))}
                  onChange={setPayee}
                />
                <SelectField
                  label="Currency"
                  value={currency}
                  options={currencies.map((value) => ({ value, label: value }))}
                  onChange={setCurrency}
                />
                <Field
                  label="Amount received or requested"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
                {kind === "request" ? (
                  <Field
                    label="Request due date (optional YYYY-MM-DD)"
                    value={due}
                    onChangeText={setDue}
                  />
                ) : null}
                <Label>
                  Use the recorded date and reference above. Only the recipient
                  or workspace owner can confirm receipt; a sender cannot mark
                  another person’s payment received.
                </Label>
                <Button
                  disabled={
                    disabled ||
                    !payer ||
                    !payee ||
                    payer === payee ||
                    !amount ||
                    !note.trim()
                  }
                  onPress={() =>
                    void action.run(async () => {
                      dateSchema.parse(eventDate);
                      if (kind === "settlement" && eventDate > date)
                        throw new Error(
                          "Use today or an earlier date for a received payment.",
                        );
                      if (due) dateSchema.parse(due);
                      setConfirmation({
                        id: entryId(kind),
                        workspace_id: scope,
                        kind,
                        payer,
                        payee,
                        currency,
                        amount_minor: parseMoney(amount, currency),
                        event_date: eventDate,
                        subscription_id: null,
                        shares: [],
                        note,
                        due_date: kind === "request" ? due || null : null,
                      });
                    })
                  }
                >
                  {kind === "settlement"
                    ? "Review received settlement"
                    : "Review request draft"}
                </Button>
                <Button
                  variant="ghost"
                  onPress={() => {
                    setAmount("");
                    setNote("");
                    setDue("");
                    pending.current = {};
                  }}
                >
                  Clear draft fields
                </Button>
                <Heading size={22}>Requests and settlement history</Heading>
                {records.slice(0, visible).map((e) => (
                  <Card key={e.id}>
                    <View style={{ gap: 10 }}>
                      <Heading size={18}>
                        {e.kind === "charge"
                          ? "Recorded paid charge"
                          : e.kind === "request"
                            ? "Payment request draft"
                            : "Recorded settlement received"}
                      </Heading>
                      <Label>
                        {e.event_date} ·{" "}
                        {formatMoney(e.amount_minor, e.currency)} {e.currency} ·{" "}
                        {e.voided ? "Voided" : "Recorded"}
                      </Label>
                      <Label>
                        {name(e.payer)}
                        {e.payee
                          ? " → " + name(e.payee)
                          : " paid shared charge"}{" "}
                        · {e.note}
                      </Label>
                      {e.kind === "request" && !e.voided && e.due_date ? (
                        <Badge
                          tone={e.due_date <= date ? "warning" : "neutral"}
                        >
                          {e.due_date <= date
                            ? "Request due for review"
                            : "Request due " + e.due_date}
                        </Badge>
                      ) : null}
                      {e.kind === "request" ? (
                        <Button
                          variant="secondary"
                          onPress={() =>
                            void action.run(() =>
                              shareText(
                                requestDraft(e, name(e.payer), name(e.payee!)),
                                "subloom-request.txt",
                                "text/plain",
                              ),
                            )
                          }
                        >
                          Export request text
                        </Button>
                      ) : null}
                      {owner || e.recorded_by === identity ? (
                        <Button
                          variant="ghost"
                          disabled={disabled}
                          onPress={() =>
                            void action.run(async () => {
                              await setLedgerVoided(
                                identity,
                                e.id,
                                e.version,
                                !e.voided,
                              );
                              await history.refetch();
                            })
                          }
                        >
                          {e.voided
                            ? "Restore recorded entry"
                            : "Void recorded entry"}
                        </Button>
                      ) : null}
                    </View>
                  </Card>
                ))}
                {records.length > visible ? (
                  <Button
                    variant="secondary"
                    onPress={() => setVisible((v) => v + 20)}
                  >
                    Show more records
                  </Button>
                ) : null}
                {completeHistory ? (
                  <Button
                    variant="secondary"
                    onPress={() =>
                      void action.run(() =>
                        shareText(
                          JSON.stringify(records, null, 2),
                          "subloom-family-ledger.json",
                          "application/json",
                        ),
                      )
                    }
                  >
                    Export complete workspace ledger
                  </Button>
                ) : null}
              </>
            ) : null}
          </>
        )}
        {action.error ? (
          <Label accessibilityRole="alert">{action.error}</Label>
        ) : null}
        {guard.confirmation}
        <Confirm
          visible={confirmation !== null}
          title={
            confirmation?.kind === "charge"
              ? "Record this paid charge?"
              : confirmation?.kind === "settlement"
                ? "Record this settlement received?"
                : "Save this request draft?"
          }
          body="Confirm your own record and its reference. Subloom does not verify a bank payment, transfer money or send a request."
          action="Save confirmed record"
          onClose={() => setConfirmation(null)}
          onConfirm={async () => {
            if (!confirmation) return;
            await recordSettlementEntry(identity, confirmation);
            delete pending.current[confirmation.kind];
            setAmount("");
            setNote("");
            setDue("");
            await history.refetch();
          }}
        >
          {confirmation ? (
            <View style={{ gap: 12 }}>
              <Heading size={18}>
                {formatMoney(confirmation.amount_minor, confirmation.currency)}{" "}
                {confirmation.currency}
              </Heading>
              {confirmation.kind === "charge" ? (
                <>
                  <Label>
                    Subscription:{" "}
                    {items.find(
                      (item) => item.id === confirmation.subscription_id,
                    )?.data.name ?? "Shared subscription"}
                  </Label>
                  <Label>
                    Billing owner who paid: {name(confirmation.payer)}
                  </Label>
                  <Label bold>Captured split for this charge</Label>
                  {confirmation.shares.map((share) => (
                    <Label key={share.userId}>
                      {name(share.userId)} ·{" "}
                      {formatMoney(share.amountMinor, confirmation.currency)}{" "}
                      {confirmation.currency}
                      {share.userId === confirmation.payer
                        ? " (billing owner’s own share)"
                        : " owed to billing owner"}
                    </Label>
                  ))}
                </>
              ) : (
                <Label>
                  From {name(confirmation.payer)} to {name(confirmation.payee!)}
                  .
                </Label>
              )}
              <Label>Recorded date: {confirmation.event_date}</Label>
              {confirmation.due_date ? (
                <Label>Request due: {confirmation.due_date}</Label>
              ) : null}
              <Label>Reference: {confirmation.note}</Label>
            </View>
          ) : null}
        </Confirm>
      </View>
    </Page>
  );
}
