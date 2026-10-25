import { useState } from "react";
import { View } from "react-native";
import {
  categories,
  currencies,
  type Category,
  type Currency,
} from "../domain/models";
import { budgetsSchema, budgetProgress } from "../domain/budgets";
import { useDisplayCurrency } from "../hooks/useDisplayCurrency";
import { parseMoney } from "../domain/money";
import { useFeatureSetting } from "../hooks/useFeatureSetting";
import { useApp, readableError } from "../store/app";
import {
  Badge,
  Button,
  Card,
  Chips,
  Field,
  Heading,
  Label,
  Page,
} from "../components/ui/Primitives";
const initial: ReturnType<typeof budgetsSchema.parse> = [];
export default function Budgets() {
  const display = useDisplayCurrency();
  const subscriptions = useApp((s) => s.data.subscriptions),
    demo = useApp((s) => s.data.demo);
  const settings = useFeatureSetting("budgets", budgetsSchema, initial);
  const [category, setCategory] = useState<Category>("Music"),
    [currency, setCurrency] = useState<Currency>(display.currency),
    [amount, setAmount] = useState(""),
    [error, setError] = useState<string | null>(null);
  async function save() {
    setError(null);
    try {
      await settings.save([
        ...settings.value.filter(
          (b) => b.category !== category || b.currency !== currency,
        ),
        { category, currency, limitMinor: parseMoney(amount, currency) },
      ]);
      setAmount("");
    } catch (e) {
      setError(readableError(e));
    }
  }
  return (
    <Page
      title="Monthly budgets"
      subtitle="Set a limit for each category. Amounts are estimated in your app currency."
      back
    >
      <View style={{ gap: 20 }}>
        {settings.error ? (
          <Card>
            <Label>{settings.error}</Label>
            <Button
              onPress={() => {
                setError(null);
                void settings.reload();
              }}
            >
              Reload budgets
            </Button>
          </Card>
        ) : null}
        {budgetProgress(subscriptions, settings.value).map((b) => (
          <Card key={b.category + b.currency}>
            <View style={{ gap: 12 }}>
              <Heading size={20}>
                {b.category} · {display.currency}
              </Heading>
              <Label size={12}>Budget for {b.currency} subscriptions</Label>
              <Badge
                tone={
                  b.state === "over"
                    ? "error"
                    : b.state === "near"
                      ? "warning"
                      : "green"
                }
              >
                {b.state === "over"
                  ? "Budget reached"
                  : b.state === "near"
                    ? "80% of budget reached"
                    : "Within budget"}
              </Badge>
              <Label>
                {display.format(b.spent, b.currency)} estimated monthly /{" "}
                {display.format(b.limitMinor, b.currency)} limit
              </Label>
              <Label>
                {display.format(Math.abs(b.remaining), b.currency)}{" "}
                {b.remaining < 0 ? "over budget" : "remaining"}
              </Label>
              <Button
                variant="ghost"
                disabled={settings.busy || demo}
                onPress={() => {
                  void settings
                    .save(
                      settings.value.filter(
                        (row) =>
                          row !== b &&
                          (row.category !== b.category ||
                            row.currency !== b.currency),
                      ),
                    )
                    .catch((e) => setError(readableError(e)));
                }}
              >
                Remove budget
              </Button>
            </View>
          </Card>
        ))}
        {settings.loaded && !settings.value.length ? (
          <Label>No budgets yet. Add your first category below.</Label>
        ) : null}
        <Card>
          <View style={{ gap: 16 }}>
            <Heading size={20}>Set a category limit</Heading>
            <Chips
              values={categories}
              selected={category}
              onChange={setCategory}
            />
            <Chips
              values={currencies}
              selected={currency}
              onChange={setCurrency}
            />
            <Field
              label={"Monthly limit · " + currency}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <Button
              loading={settings.busy}
              disabled={!settings.loaded || demo}
              onPress={() => void save()}
            >
              Save budget
            </Button>
            <Label>
              Alerts appear here at 80% and 100%. These estimates include trial
              prices and do not verify charges.
            </Label>
          </View>
        </Card>
        {error ? <Label accessibilityRole="alert">{error}</Label> : null}
      </View>
    </Page>
  );
}
