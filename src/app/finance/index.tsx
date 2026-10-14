import { useMemo, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { CreditCard, Plus, ReceiptText } from "lucide-react-native";
import { useFeatureSetting } from "../../hooks/useFeatureSetting";
import {
  financeSchema,
  initialFinance,
  transactionTotals,
  walletLabels,
} from "../../domain/finance";
import { formatMoney } from "../../domain/money";
import { useTheme, useWide } from "../../theme/useTheme";
import {
  Button,
  Card,
  Heading,
  Label,
  Page,
  SectionTitle,
  Field,
} from "../../components/ui/Primitives";
import { FinanceState } from "../../components/finance/FinanceState";
import { useApp } from "../../store/app";

export default function FinanceHome() {
  const setting = useFeatureSetting(
      "finance",
      financeSchema,
      initialFinance,
      true,
    ),
    { colors } = useTheme(),
    wide = useWide();
  const demo = useApp((s) => s.data.demo);
  const [query, setQuery] = useState("");
  const totals = useMemo(
    () => transactionTotals(setting.value.transactions),
    [setting.value.transactions],
  );
  const transactions = useMemo(
    () =>
      [...setting.value.transactions]
        .filter((t) => t.merchant.toLowerCase().includes(query.toLowerCase()))
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            b.createdAt.localeCompare(a.createdAt),
        ),
    [query, setting.value.transactions],
  );
  return (
    <Page
      title="Your finances"
      subtitle="Cards, wallets and a clear record of what you paid."
      back
    >
      <View style={{ gap: 24, maxWidth: 960, width: "100%" }}>
        <FinanceState {...setting} />
        <View style={{ flexDirection: wide ? "row" : "column", gap: 12 }}>
          <Button
            icon={CreditCard}
            disabled={!setting.loaded || demo}
            onPress={() => router.push("/finance/card")}
          >
            Add card or wallet
          </Button>
          <Button
            icon={Plus}
            variant="secondary"
            disabled={!setting.loaded || demo}
            onPress={() => router.push("/finance/transaction")}
          >
            Record transaction
          </Button>
        </View>
        {demo && <Label>Leave sample mode to record your own finances.</Label>}
        <SectionTitle title="Cards & wallets" />
        {setting.loaded && !setting.value.wallets.length && (
          <Label color={colors.secondary}>
            Add a card name and its last four digits to organize payments. Apple
            and Google wallet entries are labels until a payment provider is
            connected.
          </Label>
        )}
        <View
          style={{
            flexDirection: wide ? "row" : "column",
            flexWrap: wide ? "wrap" : "nowrap",
            gap: 12,
          }}
        >
          {setting.value.wallets.map((wallet) => (
            <Card
              key={wallet.id}
              style={{
                width: wide ? undefined : "100%",
                flexGrow: 1,
                flexBasis: wide ? 260 : undefined,
              }}
            >
              <View style={{ gap: 12 }}>
                <CreditCard color={colors.primary} size={24} />
                <Heading size={18}>{wallet.name}</Heading>
                <Label color={colors.secondary}>
                  {walletLabels[wallet.kind]}
                  {wallet.lastFour ? " · •••• " + wallet.lastFour : ""}
                </Label>
                <Label size={12}>
                  {wallet.archived
                    ? "Archived"
                    : "Tracking only · no bank connection"}
                </Label>
                <Button
                  small
                  variant="ghost"
                  disabled={!setting.loaded || setting.busy || demo}
                  onPress={() =>
                    router.push({
                      pathname: "/finance/card",
                      params: { id: wallet.id },
                    })
                  }
                >
                  Edit card or wallet
                </Button>
              </View>
            </Card>
          ))}
        </View>
        <SectionTitle title="Recorded spending" />
        <Label color={colors.secondary}>
          Settled entries you recorded, grouped by their original currency.
          Upcoming renewals are forecasts and do not appear as transactions.
        </Label>
        {totals.map((t) => (
          <View key={t.currency} style={{ gap: 6 }}>
            <Heading size={20}>
              {t.currency} · {formatMoney(t.net, t.currency)}
            </Heading>
            <Label size={12}>
              Charges {formatMoney(t.charges, t.currency)} · Refunds{" "}
              {formatMoney(t.refunds, t.currency)}
            </Label>
          </View>
        ))}
        <SectionTitle title="Transaction history" />
        <Field
          label="Search transactions"
          value={query}
          onChangeText={setQuery}
          placeholder="Merchant name"
        />
        {setting.loaded && !transactions.length && (
          <View style={{ gap: 12 }}>
            <ReceiptText color={colors.secondary} size={24} />
            <Label>
              {query
                ? "No transactions match this search."
                : "No transactions recorded yet. Add a payment or refund from your receipt or bank statement."}
            </Label>
          </View>
        )}
        {transactions.slice(0, 50).map((t) => (
          <View
            key={t.id}
            style={{
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderColor: colors.border,
              gap: 6,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <Label bold>{t.merchant}</Label>
              <Label bold>
                {t.kind === "refund" ? "+ " : ""}
                {formatMoney(t.amountMinor, t.currency)} {t.currency}
              </Label>
            </View>
            <Label size={12} color={colors.secondary}>
              {t.date} · {t.kind} · {t.status} · Manually recorded
              {t.walletId
                ? " · " +
                  setting.value.wallets.find((w) => w.id === t.walletId)?.name
                : ""}
            </Label>
          </View>
        ))}
        {transactions.length > 50 && (
          <Label>
            Showing the latest 50 matches. Search to find older entries; your
            export contains all records.
          </Label>
        )}
        <Label size={12} color={colors.secondary}>
          Apple Pay and Google Pay require a supported payment provider. Adding
          a wallet here does not import cards, charge money, or retrieve bank
          transactions.
        </Label>
      </View>
    </Page>
  );
}
