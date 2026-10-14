import { useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { router } from "expo-router";
import {
  CreditCard,
  Landmark,
  Wallet,
  Plus,
  ArrowUpRight,
} from "lucide-react-native";
import {
  Button,
  Card,
  Heading,
  Label,
  Page,
  Badge,
  Confirm,
} from "../../components/ui/Primitives";
import { useTheme, useWide } from "../../theme/useTheme";
import { useApp, notify } from "../../store/app";
import { useFeatureSetting } from "../../hooks/useFeatureSetting";
import {
  emptyPaymentProfile,
  paymentProfileSchema,
  sourceSummary,
  removePaymentSource,
} from "../../domain/payments";
import { formatMoney } from "../../domain/money";
import { today } from "../../domain/renewal";
import { PaymentSettingState } from "../../components/payments/PaymentSettingState";
function Hub() {
  const { colors } = useTheme(),
    wide = useWide();
  const subscriptions = useApp((s) => s.data.subscriptions),
    preferences = useApp((s) => s.data.preferences),
    demo = useApp((s) => s.data.demo);
  const profile = useFeatureSetting(
    "payment_sources",
    paymentProfileSchema,
    emptyPaymentProfile,
  );
  const date = today(preferences.timezone);
  const rows = useMemo(
    () =>
      profile.value.sources.map((source) => ({
        source,
        ...sourceSummary(profile.value, source, subscriptions, date),
      })),
    [profile.value, subscriptions, date],
  );
  const [remove, setRemove] = useState<string | null>(null);
  return (
    <Page
      title="Cards & wallets"
      subtitle="See which payment source covers each subscription, and what comes next."
      back
    >
      <View style={{ gap: 24 }}>
        <PaymentSettingState
          loaded={profile.loaded}
          error={profile.error}
          reload={profile.reload}
        />
        <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
          <Button
            icon={Plus}
            disabled={!profile.loaded || demo}
            onPress={() => router.push("/payments/edit")}
          >
            Add payment source
          </Button>
          <Button
            variant="secondary"
            onPress={() => router.push("/payments/radar")}
          >
            Open Subscription Radar
          </Button>
        </View>
        {profile.loaded && !rows.length ? (
          <View style={{ paddingVertical: 24, gap: 12 }}>
            <Wallet color={colors.primary} size={36} />
            <Heading size={24}>Give your renewals a home.</Heading>
            <Label color={colors.secondary}>
              Add a card nickname, bank account, or wallet, then link the
              services it pays for.
            </Label>
          </View>
        ) : null}
        {rows.map(({ source, linked, due, totals, expires, review }) => {
          const Icon =
            source.kind === "card"
              ? CreditCard
              : source.kind === "bank"
                ? Landmark
                : Wallet;
          return (
            <View
              key={source.id}
              style={{
                borderBottomWidth: 1,
                borderColor: colors.border,
                paddingBottom: 28,
                gap: 16,
              }}
            >
              <View style={{ flexDirection: wide ? "row" : "column", gap: 24 }}>
                <View
                  style={{
                    width: wide ? 280 : "100%",
                    backgroundColor: colors.mint,
                    borderRadius: 16,
                    padding: 24,
                    gap: 20,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Icon color={colors.primary} size={26} />
                    <Label size={12} color={colors.secondary}>
                      {source.kind === "card"
                        ? "Card"
                        : source.kind === "bank"
                          ? "Bank account"
                          : "Wallet"}
                    </Label>
                  </View>
                  <Heading size={22}>{source.name}</Heading>
                  <Label size={18}>
                    {source.last4 ? "•••• " + source.last4 : "Manually tracked"}
                  </Label>
                  {source.expiryMonth !== null ? (
                    <Label size={12} color={colors.secondary}>
                      Expires {String(source.expiryMonth).padStart(2, "0")}/
                      {source.expiryYear}
                    </Label>
                  ) : null}
                </View>
                <View style={{ flex: 1, gap: 12 }}>
                  <Label bold>
                    {linked.length} linked{" "}
                    {linked.length === 1 ? "subscription" : "subscriptions"}
                  </Label>
                  {totals.map((total) => (
                    <Label key={total.currency}>
                      {formatMoney(total.monthly, total.currency)}{" "}
                      {total.currency} estimated per month
                    </Label>
                  ))}
                  {expires === "expired" || expires === "soon" ? (
                    <Badge tone="warning">
                      {expires === "expired"
                        ? "Card expiry has passed"
                        : "Card expires within two months"}
                    </Badge>
                  ) : null}
                  {review.length ? (
                    <Label color={colors.warning}>
                      {review.length}{" "}
                      {review.length === 1 ? "service needs" : "services need"}{" "}
                      a payment-details review after this source changed.
                    </Label>
                  ) : null}
                  <Button
                    small
                    variant="secondary"
                    onPress={() =>
                      router.push({
                        pathname: "/payments/source",
                        params: { id: source.id },
                      })
                    }
                  >
                    Manage linked subscriptions
                  </Button>
                  <View
                    style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}
                  >
                    <Button
                      small
                      variant="ghost"
                      disabled={demo}
                      onPress={() =>
                        router.push({
                          pathname: "/payments/edit",
                          params: { id: source.id },
                        })
                      }
                    >
                      Edit payment source
                    </Button>
                    <Button
                      small
                      variant="ghost"
                      disabled={profile.busy || demo}
                      onPress={() => setRemove(source.id)}
                    >
                      Remove payment source
                    </Button>
                  </View>
                </View>
              </View>
              {due.length ? (
                <View style={{ gap: 10 }}>
                  <Label bold size={13}>
                    Next scheduled charges
                  </Label>
                  {due
                    .slice(0, 3)
                    .map(({ subscription, date: chargeDate, type }) => (
                      <Pressable
                        key={subscription.id}
                        accessibilityRole="button"
                        accessibilityLabel={"View " + subscription.name}
                        onPress={() =>
                          router.push({
                            pathname: "/subscription/[id]",
                            params: { id: subscription.id },
                          })
                        }
                        style={{
                          minHeight: 48,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Label bold>{subscription.name}</Label>
                          <Label size={12} color={colors.secondary}>
                            {chargeDate}
                            {type === "trial" ? " · trial conversion" : ""}
                          </Label>
                        </View>
                        <Label>
                          {formatMoney(
                            subscription.amountMinor,
                            subscription.currency,
                          )}{" "}
                          {subscription.currency}
                        </Label>
                        <ArrowUpRight size={16} color={colors.secondary} />
                      </Pressable>
                    ))}
                </View>
              ) : (
                <Label size={13} color={colors.secondary}>
                  No upcoming tracked charges for this source.
                </Label>
              )}
            </View>
          );
        })}
        <Card>
          <Label size={13} color={colors.secondary}>
            These are payment-source records and scheduled estimates. Linking a
            source here does not update a merchant’s billing details, connect a
            bank, or move money.
          </Label>
        </Card>
      </View>
      <Confirm
        visible={remove !== null}
        title="Remove this payment source?"
        body="Its subscription links will be removed from Subloom. Merchant billing and the subscriptions themselves stay as they are."
        action="Remove payment source"
        onClose={() => setRemove(null)}
        onConfirm={async () => {
          await profile.save(removePaymentSource(profile.value, remove!));
          notify("Payment source removed.");
        }}
      />
    </Page>
  );
}
export default function Payments() {
  const identity = useApp((s) => s.identity);
  return <Hub key={identity} />;
}
