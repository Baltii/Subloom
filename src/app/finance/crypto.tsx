import { FinanceError } from "../../components/finance/FinanceError";
import { financeError } from "../../components/finance/errors";
import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import { useFeatureSetting } from "../../hooks/useFeatureSetting";
import {
  cryptoSchema,
  initialCrypto,
  cryptoWalletSchema,
} from "../../domain/bitcoin";
import {
  Button,
  Confirm,
  Field,
  Heading,
  Label,
  Page,
  LinkRow,
} from "../../components/ui/Primitives";
import { removeLocalSetting } from "../../services/featureSettings";
import { FinanceState } from "../../components/finance/FinanceState";
import { Bitcoin, ArrowUpRight } from "lucide-react-native";
import { notify, useApp } from "../../store/app";
import { useTheme } from "../../theme/useTheme";
function CryptoForm() {
  const setting = useFeatureSetting(
      "crypto",
      cryptoSchema,
      initialCrypto,
      true,
    ),
    demo = useApp((s) => s.data.demo),
    identity = useApp((s) => s.identity),
    { colors } = useTheme();
  const [name, setName] = useState(""),
    [address, setAddress] = useState(""),
    [error, setError] = useState<string | null>(null);
  const [remove, setRemove] = useState<string | null>(null);
  async function add() {
    try {
      setError(null);
      const wallet = cryptoWalletSchema.parse({
        id: Crypto.randomUUID(),
        name,
        address,
      });
      await setting.save({
        ...setting.value,
        wallets: [...setting.value.wallets, wallet],
      });
      setName("");
      setAddress("");
      notify("Bitcoin watch address saved.");
    } catch (e) {
      setError(financeError(e));
    }
  }
  return (
    <Page
      title="Bitcoin wallets"
      subtitle="Watch an address and review payments in your own wallet."
      back
    >
      <View style={{ gap: 20, maxWidth: 720, width: "100%" }}>
        <FinanceState {...setting} />
        <Heading size={20}>Watch a public address</Heading>
        <Label color={colors.secondary}>
          Bitcoin mainnet SegWit and Taproot addresses (bc1…). This watches one
          address, which may show only part of a wallet’s activity. Anyone can
          watch a public address; adding one does not prove ownership.
        </Label>
        <Field
          label="Wallet name"
          value={name}
          onChangeText={setName}
          maxLength={80}
          placeholder="My Bitcoin wallet"
        />
        <Field
          label="Public Bitcoin address"
          value={address}
          onChangeText={setAddress}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={74}
          placeholder="bc1…"
          hint="Never enter a seed phrase or private key."
        />
        <FinanceError message={error} />
        <Button
          loading={setting.busy}
          disabled={!setting.loaded || demo}
          onPress={() => void add()}
        >
          Save watch address
        </Button>
        <Label size={12} color={colors.secondary}>
          Refreshing history shares only this public address with mempool.space,
          an open-source explorer. Its public API may rate-limit requests. The
          account backend can use a self-hosted explorer.
        </Label>
        <Heading size={20}>Watched addresses</Heading>
        {setting.loaded && !setting.value.wallets.length && (
          <Label>No Bitcoin addresses saved yet.</Label>
        )}
        {setting.value.wallets.map((w) => (
          <View key={w.id} style={{ gap: 8 }}>
            <LinkRow
              title={w.name}
              detail={w.address.slice(0, 12) + "…" + w.address.slice(-8)}
              icon={Bitcoin}
              onPress={() =>
                router.push({
                  pathname: "/finance/bitcoin-history",
                  params: { id: w.id },
                })
              }
            />
            <Button
              small
              variant="ghost"
              disabled={!setting.loaded || setting.busy || demo}
              onPress={() => setRemove(w.id)}
            >
              Remove watch address
            </Button>
          </View>
        ))}
        <LinkRow
          title="Pay with a Bitcoin wallet"
          detail="Review an amount and recipient, then open your wallet to authorize."
          icon={ArrowUpRight}
          onPress={() => router.push("/finance/bitcoin-payment")}
        />
      </View>
      <Confirm
        visible={remove !== null}
        title="Remove watched address?"
        body="Remove this public address and its saved observations from Subloom. This does not affect your Bitcoin wallet or funds."
        action="Remove address"
        onClose={() => setRemove(null)}
        onConfirm={async () => {
          if (!remove) return;
          await setting.save({
            ...setting.value,
            wallets: setting.value.wallets.filter((w) => w.id !== remove),
          });
          if (identity === "guest")
            await removeLocalSetting(identity, "crypto_history_" + remove);
          setRemove(null);
          notify("Watch address removed. Your wallet is unchanged.");
        }}
      />
    </Page>
  );
}
export default function CryptoRoute() {
  const identity = useApp((s) => s.identity);
  return <CryptoForm key={identity} />;
}
