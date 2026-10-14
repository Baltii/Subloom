import { FinanceError } from "../../components/finance/FinanceError";
import { financeError } from "../../components/finance/errors";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useFeatureSetting } from "../../hooks/useFeatureSetting";
import {
  cryptoSchema,
  initialCrypto,
  renewalIntentSchema,
} from "../../domain/bitcoin";
import { useApp, notify } from "../../store/app";
import { Button, Heading, Label, Page } from "../../components/ui/Primitives";
import { SelectField } from "../../components/ui/Selection";
import { DateField } from "../../components/ui/DateField";
import { FinanceState } from "../../components/finance/FinanceState";
import { today } from "../../domain/renewal";
function RenewalsForm() {
  const subscriptions = useApp((s) => s.data.subscriptions),
    demo = useApp((s) => s.data.demo),
    timezone = useApp((s) => s.data.preferences.timezone);
  const setting = useFeatureSetting(
    "crypto",
    cryptoSchema,
    initialCrypto,
    true,
  );
  const subscriptionNames = useMemo(
    () => new Map(subscriptions.map((s) => [s.id, s.name])),
    [subscriptions],
  );
  const saved = setting.value.intentions.filter((i) =>
    subscriptionNames.has(i.subscriptionId),
  );
  const [id, setId] = useState(""),
    [mode, setMode] = useState<"manual" | "renew" | "cancel">("manual"),
    [date, setDate] = useState(today(timezone)),
    [error, setError] = useState<string | null>(null);
  async function save() {
    try {
      setError(null);
      const intention = renewalIntentSchema.parse({
        subscriptionId: id,
        mode,
        reviewDate: date,
      });
      if (!subscriptions.some((s) => s.id === id))
        throw new Error("Choose an available subscription.");
      await setting.save({
        ...setting.value,
        intentions: [
          ...setting.value.intentions.filter((i) => i.subscriptionId !== id),
          intention,
        ],
      });
      notify("Renewal preference saved. Manual action is still required.");
    } catch (e) {
      setError(financeError(e));
    }
  }
  return (
    <Page
      title="Renewal controls"
      subtitle="Decide what should happen next, and see what needs your action."
      back
    >
      <View style={{ gap: 20, maxWidth: 720, width: "100%" }}>
        <FinanceState {...setting} />
        <Heading size={20}>Automatic billing is unavailable</Heading>
        <Label>
          Apple/Google wallet labels cannot manage merchant subscriptions.
          Bitcoin payments need authorization in your wallet. Automatic renewal
          or cancellation requires a compatible merchant integration and a
          payment mandate.
        </Label>
        <Label>
          BTCPay Server is an open-source option for merchants accepting
          Bitcoin. It requires a hosted store; it cannot renew or cancel
          subscriptions billed by other services.
        </Label>
        {!subscriptions.length && (
          <View style={{ gap: 12 }}>
            <Label>
              Add a subscription before saving a renewal preference.
            </Label>
            <Button onPress={() => router.push("/subscription/new")}>
              Add subscription
            </Button>
          </View>
        )}
        <SelectField
          label="Subscription"
          value={id}
          options={subscriptions.map((s) => ({ value: s.id, label: s.name }))}
          onChange={(next) => {
            setId(next);
            const saved = setting.value.intentions.find(
              (i) => i.subscriptionId === next,
            );
            setMode(saved?.mode ?? "manual");
            setDate(saved?.reviewDate ?? today(timezone));
          }}
        />
        <SelectField
          label="Renewal preference"
          value={mode}
          options={[
            { value: "manual", label: "Review manually" },
            { value: "renew", label: "I plan to renew" },
            { value: "cancel", label: "I plan to cancel" },
          ]}
          onChange={setMode}
        />
        <DateField label="Review date" value={date} onChange={setDate} />
        <Label>
          Saving a preference does not schedule a payment, a cancellation, or a
          notification. Use your subscription reminders and complete billing
          changes with the merchant.
        </Label>
        <FinanceError message={error} />
        <Button
          disabled={!setting.loaded || demo || !id}
          loading={setting.busy}
          onPress={() => void save()}
        >
          Save renewal preference
        </Button>
        <Heading size={20}>Your saved preferences</Heading>
        {setting.loaded && !saved.length && (
          <Label>No renewal preferences saved yet.</Label>
        )}
        {saved.map((i) => (
          <View key={i.subscriptionId} style={{ gap: 6 }}>
            <Label bold>{subscriptionNames.get(i.subscriptionId)}</Label>
            <Label>
              {i.mode === "renew"
                ? "Plan to renew"
                : i.mode === "cancel"
                  ? "Plan to cancel"
                  : "Review manually"}{" "}
              · review {i.reviewDate} · Manual action required
            </Label>
          </View>
        ))}
        <Button
          variant="secondary"
          onPress={() => router.push("/cancellation")}
        >
          Open cancellation checklist
        </Button>
      </View>
    </Page>
  );
}
export default function RenewalsRoute() {
  const identity = useApp((s) => s.identity);
  return <RenewalsForm key={identity} />;
}
