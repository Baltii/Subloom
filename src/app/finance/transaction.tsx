import { FinanceError } from "../../components/finance/FinanceError";
import { financeError } from "../../components/finance/errors";
import { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { useFeatureSetting } from "../../hooks/useFeatureSetting";
import {
  financeSchema,
  initialFinance,
  transactionSchema,
} from "../../domain/finance";
import { currencies } from "../../domain/models";
import { parseMoney, moneyInput } from "../../domain/money";
import { Temporal } from "@js-temporal/polyfill";
import {
  Button,
  Confirm,
  Field,
  Label,
  Page,
} from "../../components/ui/Primitives";
import { SelectField } from "../../components/ui/Selection";
import { DateField } from "../../components/ui/DateField";
import { FinanceState } from "../../components/finance/FinanceState";
import { useDraftGuard } from "../../hooks/useDraftGuard";
import { notify, useApp } from "../../store/app";

function TransactionRouteForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const setting = useFeatureSetting(
      "finance",
      financeSchema,
      initialFinance,
      true,
    ),
    preferences = useApp((s) => s.data.preferences),
    subscriptions = useApp((s) => s.data.subscriptions),
    demo = useApp((s) => s.data.demo);
  const existing = setting.value.transactions.find((t) => t.id === id);
  const [newId] = useState(() => Crypto.randomUUID());
  const initial = {
    merchant: existing?.merchant ?? "",
    amount: existing ? moneyInput(existing.amountMinor, existing.currency) : "",
    currency: existing?.currency ?? preferences.currency,
    date:
      existing?.date ??
      Temporal.Now.plainDateISO(preferences.timezone).toString(),
    wallet: existing?.walletId ?? "none",
    subscription: existing?.subscriptionId ?? "none",
    kind: existing?.kind ?? "charge",
    status: existing?.status ?? "settled",
  };
  const [draft, setDraft] = useState<typeof initial | null>(null);
  const value = draft ?? initial;
  const {
    merchant,
    amount,
    currency,
    date,
    wallet,
    subscription,
    kind,
    status,
  } = value;
  function change<K extends keyof typeof initial>(
    key: K,
    next: (typeof initial)[K],
  ) {
    setDraft({ ...value, [key]: next });
  }
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ready = setting.loaded && (!id || Boolean(existing));
  const guard = useDraftGuard(draft !== null, setting.busy);
  async function save() {
    try {
      setError(null);
      const transaction = transactionSchema.parse({
        id: existing?.id ?? newId,
        merchant,
        amountMinor: parseMoney(amount, currency),
        currency,
        date,
        kind,
        status,
        walletId: wallet === "none" ? null : wallet,
        subscriptionId: subscription === "none" ? null : subscription,
        source: "manual",
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      });
      await setting.save({
        ...setting.value,
        transactions: existing
          ? setting.value.transactions.map((t) =>
              t.id === existing.id ? transaction : t,
            )
          : [...setting.value.transactions, transaction],
      });
      guard.saved();
      notify(existing ? "Transaction updated." : "Transaction recorded.");
      router.back();
    } catch (e) {
      setError(financeError(e));
    }
  }
  return (
    <Page
      title={id ? "Edit transaction" : "Record transaction"}
      subtitle="Record a payment or refund you can verify from a receipt or statement."
      back
    >
      <View style={{ gap: 20, maxWidth: 720, width: "100%" }}>
        <FinanceState {...setting} />
        {setting.loaded && id && !existing && (
          <Label>
            This transaction is unavailable. Return to your finances and choose
            another entry.
          </Label>
        )}
        <Field
          label="Merchant"
          value={merchant}
          onChangeText={(next) => change("merchant", next)}
          maxLength={80}
          placeholder="Service or merchant name"
        />
        <Field
          label="Amount"
          value={amount}
          onChangeText={(next) => change("amount", next)}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <SelectField
          label="Original currency"
          value={currency}
          options={currencies.map((value) => ({ value, label: value }))}
          onChange={(next) => change("currency", next)}
        />
        <DateField
          label="Transaction date"
          value={date}
          onChange={(next) => change("date", next)}
        />
        <SelectField
          label="Type"
          value={kind}
          options={[
            { value: "charge", label: "Payment" },
            { value: "refund", label: "Refund" },
          ]}
          onChange={(next) => change("kind", next)}
        />
        <SelectField
          label="Status"
          value={status}
          options={[
            { value: "settled", label: "Settled" },
            { value: "pending", label: "Pending" },
            { value: "failed", label: "Failed" },
          ]}
          onChange={(next) => change("status", next)}
        />
        <SelectField
          label="Card or wallet"
          value={wallet}
          options={[
            { value: "none", label: "No card selected" },
            ...setting.value.wallets
              .filter((w) => !w.archived || w.id === wallet)
              .map((w) => ({ value: w.id, label: w.name })),
          ]}
          onChange={(next) => change("wallet", next)}
        />
        <SelectField
          label="Subscription (optional)"
          value={subscription}
          options={[
            { value: "none", label: "No subscription selected" },
            ...subscriptions.map((s) => ({ value: s.id, label: s.name })),
            ...(subscription !== "none" &&
            !subscriptions.some((s) => s.id === subscription)
              ? [
                  {
                    value: subscription,
                    label: "Previously linked subscription (removed)",
                  },
                ]
              : []),
          ]}
          onChange={(next) => change("subscription", next)}
        />
        <Label>
          Manually recorded entries do not confirm a bank payment. Pending and
          failed entries are excluded from recorded spending.
        </Label>
        <FinanceError message={error} />
        <Button
          disabled={!ready || demo}
          loading={setting.busy}
          onPress={() => void save()}
        >
          {existing ? "Save changes" : "Save transaction"}
        </Button>
        {existing && (
          <Button
            variant="danger"
            disabled={!ready || setting.busy || demo}
            onPress={() => setConfirmDelete(true)}
          >
            Delete recorded transaction
          </Button>
        )}
      </View>
      {guard.confirmation}
      <Confirm
        visible={confirmDelete}
        title="Delete this transaction?"
        body="Remove this manually recorded entry from your history and spending totals. This does not reverse a payment or change your subscription."
        action="Delete transaction"
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (!existing) return;
          await setting.save({
            ...setting.value,
            transactions: setting.value.transactions.filter(
              (t) => t.id !== existing.id,
            ),
          });
          guard.saved();
          notify("Recorded transaction deleted.");
          router.back();
        }}
      />
    </Page>
  );
}

export default function TransactionRoute() {
  const identity = useApp((s) => s.identity);
  return <TransactionRouteForm key={identity} />;
}
