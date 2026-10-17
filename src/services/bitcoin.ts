import {
  cryptoSchema,
  bitcoinAddressSchema,
  bitcoinHistorySchema,
  type BitcoinHistory,
} from "../domain/bitcoin";
import { fetchBitcoinHistory } from "./bitcoinExplorer";
import { localSetting } from "./featureSettings";
import { accountClient } from "./supabase";
export async function readBitcoinHistory(
  identity: string,
  walletId: string,
  address: string,
) {
  if (identity === "guest") {
    const raw = await localSetting(identity, "crypto_history_" + walletId);
    const history = raw ? bitcoinHistorySchema.parse(JSON.parse(raw)) : null;
    return history?.address === address ? history : null;
  }
  const client = await accountClient(identity);
  const { data, error } = await client
    .from("crypto_address_history")
    .select("data")
    .eq("user_id", identity)
    .eq("wallet_id", walletId)
    .eq("address", address)
    .maybeSingle();
  if (error)
    throw new Error("Could not load Bitcoin history. Connect and retry.");
  return data ? bitcoinHistorySchema.parse(data.data) : null;
}
export async function refreshBitcoinHistory(
  identity: string,
  walletId: string,
  address: string,
): Promise<BitcoinHistory> {
  bitcoinAddressSchema.parse(address);
  if (identity === "guest") {
    const data = await fetchBitcoinHistory(address);
    await localSetting(
      identity,
      "crypto_history_" + walletId,
      JSON.stringify(data),
    );
    return data;
  }
  const client = await accountClient(identity);
  const { data, error } = await client.functions.invoke("bitcoin-history", {
    body: { walletId },
  });
  if (error || data?.error)
    throw new Error(
      "Could not refresh Bitcoin history. Check the address and connection, then retry.",
    );
  const history = bitcoinHistorySchema.parse(data);
  if (history.address !== address)
    throw new Error("Your wallet address changed. Reload before refreshing.");
  return history;
}

export async function exportGuestBitcoinHistory() {
  const raw = await localSetting("guest", "crypto");
  if (!raw) return [];
  const settings = cryptoSchema.parse(JSON.parse(raw));
  return Promise.all(
    settings.wallets.map((w) => readBitcoinHistory("guest", w.id, w.address)),
  );
}
