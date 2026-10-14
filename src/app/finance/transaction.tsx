import { FinanceError } from "../../components/finance/FinanceError";
import { financeError } from "../../components/finance/errors";
import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import { useFeatureSetting } from "../../hooks/useFeatureSetting";
import {
  financeSchema,
  initialFinance,
  transactionSchema,
  type Transaction,
} from "../../domain/finance";
import { currencies, type Currency } from "../../domain/models";
import { parseMoney } from "../../domain/money";
import { Temporal } from "@js-temporal/polyfill";
import { Button, Field, Label, Page } from "../../components/ui/Primitives";
import { SelectField } from "../../components/ui/Selection";
import { DateField } from "../../components/ui/DateField";
import { FinanceState } from "../../components/finance/FinanceState";
import { notify, useApp } from "../../store/app";

function TransactionRouteForm() {
  const setting = useFeatureSetting(
      "finance",
      financeSchema,
      initialFinance,
      true,
    ),
    preferences = useApp((s) => s.data.preferences),
    subscriptions = useApp((s) => s.data.subscriptions),
    demo = useApp((s) => s.data.demo);
  const [merchant, setMerchant] = useState(""),
    [amount, setAmount] = useState(""),
    [currency, setCurrency] = useState<Currency>(preferences.currency),
    [date, setDate] = useState(
      Temporal.Now.plainDateISO(preferences.timezone).toString(),
    );
  const [wallet, setWallet] = useState("none"),
    [subscription, setSubscription] = useState("none"),
    [kind, setKind] = useState<Transaction["kind"]>("charge"),
    [status, setStatus] = useState<Transaction["status"]>("settled"),
    [error, setError] = useState<string | null>(null);
  async function save() {
    try {
      setError(null);
      const transaction = transactionSchema.parse({
        id: Crypto.randomUUID(),
        merchant,
        amountMinor: parseMoney(amount, currency),
        currency,
        date,
        kind,
        status,
        walletId: wallet === "none" ? null : wallet,
        subscriptionId: subscription === "none" ? null : subscription,
        source: "manual",
        createdAt: new Date().toISOString(),
      });
      await setting.save({
        ...setting.value,
        transactions: [...setting.value.transactions, transaction],
      });
      notify("Transaction recorded.");
      router.back();
    } catch (e) {
      setError(financeError(e));
    }
  }
  return (
    <Page
      title="Record transaction"
      subtitle="Record a payment or refund you can verify from a receipt or statement."
      back
    >
      <View style={{ gap: 20, maxWidth: 720, width: "100%" }}>
        <FinanceState {...setting} />
        <Field
          label="Merchant"
          value={merchant}
          onChangeText={setMerchant}
          maxLength={80}
          placeholder="Service or merchant name"
        />
        <Field
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <SelectField
          label="Original currency"
          value={currency}
          options={currencies.map((value) => ({ value, label: value }))}
          onChange={setCurrency}
        />
        <DateField label="Transaction date" value={date} onChange={setDate} />
        <SelectField
          label="Type"
          value={kind}
          options={[
            { value: "charge", label: "Payment" },
            { value: "refund", label: "Refund" },
          ]}
          onChange={setKind}
        />
        <SelectField
          label="Status"
          value={status}
          options={[
            { value: "settled", label: "Settled" },
            { value: "pending", label: "Pending" },
            { value: "failed", label: "Failed" },
          ]}
          onChange={setStatus}
        />
        <SelectField
          label="Card or wallet"
          value={wallet}
          options={[
            { value: "none", label: "No card selected" },
            ...setting.value.wallets
              .filter((w) => !w.archived)
              .map((w) => ({ value: w.id, label: w.name })),
          ]}
          onChange={setWallet}
        />
        <SelectField
          label="Subscription (optional)"
          value={subscription}
          options={[
            { value: "none", label: "No subscription selected" },
            ...subscriptions.map((s) => ({ value: s.id, label: s.name })),
          ]}
          onChange={setSubscription}
        />
        <Label>
          Manually recorded entries do not confirm a bank payment. Pending and
          failed entries are excluded from recorded spending.
        </Label>
        <FinanceError message={error} />
        <Button
          disabled={!setting.loaded || demo}
          loading={setting.busy}
          onPress={() => void save()}
        >
          Save transaction
        </Button>
      </View>
    </Page>
  );
}

export default function TransactionRoute() {
  const identity = useApp((s) => s.identity);
  return <TransactionRouteForm key={identity} />;
}
