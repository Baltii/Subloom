import { FinanceError } from "../../components/finance/FinanceError";
import { financeError } from "../../components/finance/errors";
import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useFeatureSetting } from "../../hooks/useFeatureSetting";
import { cryptoSchema, initialCrypto, formatBtc } from "../../domain/bitcoin";
import {
  readBitcoinHistory,
  refreshBitcoinHistory,
} from "../../services/bitcoin";
import { useApp } from "../../store/app";
import { Button, Heading, Label, Page } from "../../components/ui/Primitives";
import { FinanceState } from "../../components/finance/FinanceState";
import { useTheme } from "../../theme/useTheme";
export default function BitcoinHistoryRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>(),
    identity = useApp((s) => s.identity),
    demo = useApp((s) => s.data.demo),
    timezone = useApp((s) => s.data.preferences.timezone),
    { colors } = useTheme();
  const setting = useFeatureSetting(
      "crypto",
      cryptoSchema,
      initialCrypto,
      true,
    ),
    wallet = setting.value.wallets.find((w) => w.id === id);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["bitcoin-history", identity, id, wallet?.address],
    enabled: Boolean(wallet) && !demo,
    queryFn: () => readBitcoinHistory(identity, wallet!.id, wallet!.address),
  });
  async function refresh() {
    if (!wallet || demo) return;
    setBusy(true);
    setError(null);
    try {
      await refreshBitcoinHistory(identity, wallet.id, wallet.address);
      if (useApp.getState().identity === identity) await query.refetch();
    } catch (e) {
      if (useApp.getState().identity === identity) setError(financeError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      title={wallet?.name ?? "Bitcoin history"}
      subtitle="Blockchain observations for a single watched address."
      back
    >
      <View style={{ gap: 20, maxWidth: 720, width: "100%" }}>
        <FinanceState {...setting} />
        {wallet && <Label selectable>{wallet.address}</Label>}
        {setting.loaded && !wallet && (
          <Label>
            Address unavailable. Return to Bitcoin wallets to select a saved
            address.
          </Label>
        )}
        <Label color={colors.secondary}>
          Refresh shares this address with the explorer and saves the latest 25
          transactions. Confirmed means included in a block; transactions can
          change after a chain reorganization. Movements are not matched to
          merchant subscriptions.
        </Label>
        <Button
          disabled={!wallet || demo}
          loading={busy}
          onPress={() => void refresh()}
        >
          Refresh from Bitcoin network
        </Button>
        <FinanceError
          message={error ?? (query.error ? financeError(query.error) : null)}
        />
        {query.isFetching && <Label>Loading saved observations…</Label>}
        {query.data ? (
          <>
            <Label size={12} color={colors.secondary}>
              mempool · last checked{" "}
              {new Date(query.data.fetchedAt).toLocaleString("en", {
                timeZone: timezone,
              })}
            </Label>
            {!query.data.transactions.length && (
              <Label>No transactions found for this address.</Label>
            )}
            {query.data.transactions.map((t) => (
              <View
                key={t.txid}
                style={{
                  gap: 8,
                  paddingVertical: 16,
                  borderBottomWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Heading size={18}>
                  {t.netSats > 0 ? "+" : ""}
                  {formatBtc(t.netSats)} BTC
                </Heading>
                <Label>
                  {t.confirmed
                    ? "Confirmed in a block"
                    : "Pending · unconfirmed"}
                  {t.blockTime
                    ? " · " +
                      new Date(t.blockTime * 1000).toLocaleString("en", {
                        timeZone: timezone,
                      })
                    : ""}
                </Label>
                <Label size={12} selectable>
                  {t.txid}
                </Label>
              </View>
            ))}
            <Label size={12}>
              Showing up to 25 recent transactions. Net address movement
              includes change and network fees; this is not the complete wallet
              balance.
            </Label>
          </>
        ) : (
          !query.isFetching && (
            <Label>
              No saved network observations. Refresh to fetch real Bitcoin
              transactions.
            </Label>
          )
        )}
      </View>
    </Page>
  );
}
