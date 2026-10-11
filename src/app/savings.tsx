import { useState } from "react";
import { View } from "react-native";
import { useApp } from "../store/app";
import { simulateSavings } from "../domain/savings";
import { formatMoney } from "../domain/money";
import {
  Button,
  Card,
  Heading,
  Label,
  Page,
} from "../components/ui/Primitives";
export default function Savings() {
  const subscriptions = useApp((s) => s.data.subscriptions);
  const [ids, setIds] = useState<string[]>([]);
  const result = simulateSavings(subscriptions, ids);
  const eligible = subscriptions.filter(
    (s) => s.status === "active" || s.status === "trial",
  );
  return (
    <Page
      title="What could you save?"
      subtitle="Choose subscriptions to compare estimated recurring costs. Your subscriptions stay as they are."
      back
    >
      <View style={{ gap: 20 }}>
        <Card>
          <View style={{ gap: 12 }}>
            <Heading size={20}>
              Potential savings · {result.count} selected
            </Heading>
            {result.savings.length ? (
              result.savings.map((t) => (
                <Label key={t.currency}>
                  {formatMoney(t.monthly, t.currency)} {t.currency} / month ·{" "}
                  {formatMoney(t.annual, t.currency)} {t.currency} / year
                </Label>
              ))
            ) : (
              <Label>Select a subscription to start.</Label>
            )}
            <Label>
              Estimates assume current prices continue. Trials use their
              recorded recurring price. Prepaid charges, refunds and
              cancellation fees are excluded.
            </Label>
            <Heading size={18}>Remaining recurring costs</Heading>
            {result.remaining.length ? (
              result.remaining.map((t) => (
                <Label key={t.currency}>
                  {t.currency}: {formatMoney(t.monthly, t.currency)} / month
                </Label>
              ))
            ) : (
              <Label>No remaining recurring costs.</Label>
            )}
          </View>
        </Card>
        {eligible.length ? (
          eligible.map((s) => (
            <View key={s.id} style={{ gap: 8 }}>
              <Label bold>
                {s.name} · {formatMoney(s.amountMinor, s.currency)} {s.currency}
              </Label>
              <Button
                variant={ids.includes(s.id) ? "primary" : "secondary"}
                onPress={() =>
                  setIds((current) =>
                    current.includes(s.id)
                      ? current.filter((id) => id !== s.id)
                      : [...current, s.id],
                  )
                }
              >
                {ids.includes(s.id)
                  ? "Remove " + s.name + " from scenario"
                  : "Include " + s.name + " in scenario"}
              </Button>
            </View>
          ))
        ) : (
          <Label>Add an active subscription or trial to explore savings.</Label>
        )}
        <Button
          variant="ghost"
          disabled={!ids.length}
          onPress={() => setIds([])}
        >
          Clear selection
        </Button>
      </View>
    </Page>
  );
}
