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
  walletKinds,
  walletLabels,
  walletSchema,
} from "../../domain/finance";
import { Button, Field, Label, Page } from "../../components/ui/Primitives";
import { SelectField } from "../../components/ui/Selection";
import { FinanceState } from "../../components/finance/FinanceState";
import { notify, useApp } from "../../store/app";

function CardRouteForm() {
  const { id } = useLocalSearchParams<{ id?: string }>(),
    setting = useFeatureSetting("finance", financeSchema, initialFinance, true);
  const existing = setting.value.wallets.find((w) => w.id === id);
  const [draft, setDraft] = useState<{
    name: string;
    lastFour: string;
    kind: (typeof walletKinds)[number];
    archived: boolean;
  } | null>(null);
  const value = draft ??
    existing ?? {
      name: "",
      lastFour: "",
      kind: "card" as const,
      archived: false,
    };
  const [error, setError] = useState<string | null>(null),
    demo = useApp((s) => s.data.demo);
  const ready = setting.loaded && (!id || Boolean(existing));
  async function save() {
    try {
      setError(null);
      const wallet = walletSchema.parse({
        ...value,
        id: existing?.id ?? Crypto.randomUUID(),
      });
      await setting.save({
        ...setting.value,
        wallets: existing
          ? setting.value.wallets.map((w) => (w.id === wallet.id ? wallet : w))
          : [...setting.value.wallets, wallet],
      });
      notify("Card or wallet saved for tracking.");
      router.back();
    } catch (e) {
      setError(financeError(e));
    }
  }
  return (
    <Page
      title={id ? "Edit card or wallet" : "Add card or wallet"}
      subtitle="Keep your payment records organized."
      back
    >
      <View style={{ gap: 20, maxWidth: 720, width: "100%" }}>
        <FinanceState {...setting} />
        {setting.loaded && id && !existing && (
          <Label>
            This card is unavailable. Return to your finances and choose another
            card.
          </Label>
        )}
        <SelectField
          label="Type"
          value={value.kind}
          options={walletKinds.map((kind) => ({
            value: kind,
            label: walletLabels[kind],
          }))}
          onChange={(kind) => setDraft({ ...value, kind })}
        />
        <Field
          label="Name"
          value={value.name}
          maxLength={80}
          onChangeText={(name) => setDraft({ ...value, name })}
          placeholder="Everyday debit"
        />
        <Field
          label="Last four digits (optional)"
          hint="Only the last four digits. Never enter a full card number or security code."
          value={value.lastFour}
          keyboardType="number-pad"
          maxLength={4}
          onChangeText={(lastFour) => setDraft({ ...value, lastFour })}
        />
        {existing && (
          <SelectField
            label="Availability"
            value={value.archived ? "archived" : "active"}
            options={[
              { value: "active", label: "Active" },
              {
                value: "archived",
                label: "Archived · keep transaction history",
              },
            ]}
            onChange={(status) =>
              setDraft({ ...value, archived: status === "archived" })
            }
          />
        )}
        <Label>
          {value.kind === "card"
            ? "This records a card label. It does not authorize payments or connect your card to a bank."
            : "This saves a wallet label. A payment provider is required to connect Apple Pay or Google Pay; wallet contents and bank history are not imported."}
        </Label>
        <FinanceError message={error} />
        <Button
          disabled={!ready || demo}
          loading={setting.busy}
          onPress={() => void save()}
        >
          Save card or wallet
        </Button>
      </View>
    </Page>
  );
}

export default function CardRoute() {
  const identity = useApp((s) => s.identity);
  return <CardRouteForm key={identity} />;
}
