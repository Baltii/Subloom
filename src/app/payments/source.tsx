import { useMemo, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Button,
  Card,
  Field,
  Chips,
  Heading,
  Label,
  Page,
} from "../../components/ui/Primitives";
import { useFeatureSetting } from "../../hooks/useFeatureSetting";
import {
  emptyPaymentProfile,
  paymentProfileSchema,
  assignPaymentSource,
  sourceSummary,
} from "../../domain/payments";
import { formatMoney } from "../../domain/money";
import { today } from "../../domain/renewal";
import { useApp, notify, readableError } from "../../store/app";
import { PaymentSettingState } from "../../components/payments/PaymentSettingState";
function Source({ id }: { id: string | undefined }) {
  const profile = useFeatureSetting(
    "payment_sources",
    paymentProfileSchema,
    emptyPaymentProfile,
  );
  const subscriptions = useApp((s) => s.data.subscriptions),
    timezone = useApp((s) => s.data.preferences.timezone),
    demo = useApp((s) => s.data.demo);
  const [filter, setFilter] = useState<"Linked" | "All subscriptions">(
      "Linked",
    ),
    [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(""),
    [visible, setVisible] = useState(30);
  const source = profile.value.sources.find((s) => s.id === id),
    date = today(timezone);
  const summary = useMemo(
    () =>
      source ? sourceSummary(profile.value, source, subscriptions, date) : null,
    [profile.value, source, subscriptions, date],
  );
  const links = new Map(profile.value.links.map((l) => [l.subscriptionId, l]));
  const rows = filter === "Linked" ? (summary?.linked ?? []) : subscriptions;
  async function updateLink(subscriptionId: string, sourceId: string | null) {
    setError(null);
    try {
      await profile.save(
        assignPaymentSource(
          profile.value,
          subscriptionId,
          sourceId,
          new Date().toISOString(),
        ),
      );
      notify(sourceId ? "Payment source linked." : "Payment source unlinked.");
    } catch (e) {
      setError(readableError(e));
    }
  }
  return (
    <Page
      title={source?.name ?? "Payment source"}
      subtitle="Link subscriptions and review their payment details after a replacement."
      back
    >
      <View style={{ gap: 20 }}>
        <PaymentSettingState
          loaded={profile.loaded}
          error={profile.error}
          reload={profile.reload}
        />
        {profile.loaded && !source ? (
          <Label>This payment source is no longer available.</Label>
        ) : source ? (
          <>
            <Chips
              values={["Linked", "All subscriptions"] as const}
              selected={filter}
              onChange={(value) => {
                setFilter(value);
                setVisible(30);
              }}
            />
            <Field
              label="Find a subscription"
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                setVisible(30);
              }}
              maxLength={80}
            />
            {!rows.length ? (
              <View style={{ gap: 12 }}>
                <Heading size={22}>No linked subscriptions yet.</Heading>
                <Label>
                  Choose All subscriptions to link your tracked services.
                </Label>
                {!subscriptions.length ? (
                  <Button onPress={() => router.push("/subscription/new")}>
                    Add a subscription
                  </Button>
                ) : null}
              </View>
            ) : null}
            {rows.slice(0, visible).map((s) => {
              const link = links.get(s.id),
                linked = link?.sourceId === id,
                needsReview = linked && link!.reviewedAt < source.updatedAt;
              const current = profile.value.sources.find(
                (p) => p.id === link?.sourceId,
              );
              return (
                <Card key={s.id}>
                  <View style={{ gap: 12 }}>
                    <Heading size={20}>{s.name}</Heading>
                    <Label>
                      {formatMoney(s.amountMinor, s.currency)} {s.currency} ·{" "}
                      {s.interval}
                    </Label>
                    <Label size={13}>
                      {needsReview
                        ? "Payment details need review after this source changed."
                        : linked
                          ? "Linked to this payment source"
                          : current
                            ? "Currently linked to " + current.name
                            : "No payment source linked"}
                    </Label>
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <Button
                        small
                        variant="secondary"
                        onPress={() =>
                          router.push({
                            pathname: "/subscription/[id]",
                            params: { id: s.id },
                          })
                        }
                      >
                        View subscription
                      </Button>
                      {needsReview ? (
                        <Button
                          small
                          loading={profile.busy}
                          disabled={demo}
                          onPress={() => void updateLink(s.id, id!)}
                        >
                          Mark billing details reviewed
                        </Button>
                      ) : null}
                      <Button
                        small
                        variant="ghost"
                        loading={profile.busy}
                        disabled={demo}
                        onPress={() =>
                          void updateLink(s.id, linked ? null : id!)
                        }
                      >
                        {linked
                          ? "Unlink payment source"
                          : current
                            ? "Move link to this source"
                            : "Link this payment source"}
                      </Button>
                    </View>
                  </View>
                </Card>
              );
            })}
            {rows.length > visible ? (
              <Button
                variant="secondary"
                onPress={() => setVisible((value) => value + 30)}
              >
                Show more subscriptions
              </Button>
            ) : null}
            <Label size={13}>
              A review records that you checked the provider’s billing details.
              Subloom does not verify or change those details.
            </Label>
          </>
        ) : null}
        {error ? <Label accessibilityRole="alert">{error}</Label> : null}
      </View>
    </Page>
  );
}
export default function PaymentSourceScreen() {
  const identity = useApp((s) => s.identity),
    params = useLocalSearchParams<{ id?: string }>();
  return (
    <Source
      key={identity + params.id}
      id={typeof params.id === "string" ? params.id : undefined}
    />
  );
}
