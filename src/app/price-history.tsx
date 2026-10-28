import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useApp } from "../store/app";
import { accountClient } from "../services/supabase";
import { pricePointSchema } from "../domain/models";
import { pricePoint, priceDifference } from "../domain/priceHistory";
import { useDisplayCurrency } from "../hooks/useDisplayCurrency";
import {
  Button,
  Card,
  Heading,
  Label,
  Page,
} from "../components/ui/Primitives";
export default function PriceHistory() {
  const display = useDisplayCurrency();
  const { subscriptionId } = useLocalSearchParams<{
    subscriptionId?: string;
  }>();
  const identity = useApp((s) => s.identity),
    data = useApp((s) => s.data);
  const query = useQuery({
    queryKey: ["price-history", identity, data.lastSyncedAt],
    enabled: identity !== "guest" && !data.demo,
    queryFn: async () => {
      const client = await accountClient(identity);
      const points = [];
      for (let start = 0; ; start += 500) {
        const result = await client
          .from("subscription_price_history")
          .select("data")
          .eq("user_id", identity)
          .order("id")
          .range(start, start + 499);
        if (result.error)
          throw new Error(
            "Couldn’t load price history. Check your connection and try again.",
          );
        points.push(
          ...(result.data || []).map((row) => pricePointSchema.parse(row.data)),
        );
        if (!result.data || result.data.length < 500) break;
      }
      return points;
    },
  });
  const subscriptions = data.subscriptions.filter(
    (s) => !subscriptionId || s.id === subscriptionId,
  );
  return (
    <Page
      title="Price history"
      subtitle={`Recorded prices, estimated in ${display.currency} using current rates.`}
      back
    >
      <View style={{ gap: 18 }}>
        {query.error ? (
          <Card>
            <Label>{query.error.message}</Label>
            <Button
              onPress={() => {
                void query.refetch();
              }}
            >
              Reload cloud history
            </Button>
          </Card>
        ) : null}
        {data.outbox.length ? (
          <Label>Some price changes are waiting to sync.</Label>
        ) : null}
        {subscriptions.length ? (
          subscriptions.map((s) => {
            const points = new Map<number, ReturnType<typeof pricePoint>>();
            for (const p of [...(query.data || []), ...data.priceHistory])
              if (p.subscriptionId === s.id) points.set(p.version, p);
            if (!points.size) points.set(s.version, pricePoint(s, "baseline"));
            const rows = [...points.values()].sort(
              (a, b) => a.version - b.version,
            );
            return (
              <Card key={s.id}>
                <View style={{ gap: 12 }}>
                  <Heading size={20}>{s.name}</Heading>
                  {rows.map((p, index) => {
                    const previous = rows[index - 1],
                      delta = previous ? priceDifference(previous, p) : null;
                    return (
                      <View key={p.version} style={{ gap: 4 }}>
                        <Label bold>
                          {display.format(p.amountMinor, p.currency)}{" "}
                          {display.currency} · {p.intervalCount}{" "}
                          {p.interval === "custom" ? p.customUnit : p.interval}
                        </Label>
                        <Label>
                          {new Date(p.capturedAt).toLocaleDateString()} ·{" "}
                          {p.source === "baseline"
                            ? "Starting price"
                            : "Price change"}
                        </Label>
                        {previous ? (
                          <Label>
                            {delta === null
                              ? "Currency or billing period changed"
                              : delta === 0
                                ? "Same recorded price"
                                : (delta > 0
                                    ? "Increase of "
                                    : "Decrease of ") +
                                  display.format(Math.abs(delta), p.currency) +
                                  " " +
                                  display.currency}
                          </Label>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </Card>
            );
          })
        ) : (
          <Label>Add a subscription to begin recording price changes.</Label>
        )}
      </View>
    </Page>
  );
}
