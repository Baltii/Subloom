import { z } from "zod";
import {
  authenticated,
  endpoint,
  HttpError,
  json,
  limited,
  rateLimit,
} from "../_shared/http.ts";
import { fetchBitcoinHistory } from "../../../src/services/bitcoinExplorer.ts";
import { cryptoSchema } from "../../../src/domain/bitcoin.ts";
export const handler = endpoint(async (req) => {
  const { user, client } = await authenticated(req);
  await rateLimit(client, "bitcoin-history:" + user.id, 20, 3600, user.id);
  const { walletId } = z
    .object({ walletId: z.string().uuid() })
    .strict()
    .parse(JSON.parse(await limited(req, 1024)));
  const { data, error } = await client
    .from("crypto_journals")
    .select("data")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new HttpError(503, "Could not load your watched addresses.");
  const wallet = data
    ? cryptoSchema.parse(data.data).wallets.find((w) => w.id === walletId)
    : null;
  if (!wallet) throw new HttpError(404, "This watched address is unavailable.");
  // Operator-only override allows a self-hosted open-source explorer.
  const api =
    Deno.env.get("BITCOIN_EXPLORER_URL") ?? "https://mempool.space/api";
  const url = new URL(api);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new HttpError(503, "Invalid explorer configuration.");
  let history;
  try {
    history = await fetchBitcoinHistory(
      wallet.address,
      fetch,
      api.replace(/\/$/, ""),
    );
  } catch {
    throw new HttpError(
      502,
      "Could not refresh Bitcoin history. Existing observations were kept.",
    );
  }
  const { error: saveError } = await client
    .from("crypto_address_history")
    .upsert(
      {
        user_id: user.id,
        wallet_id: wallet.id,
        address: wallet.address,
        data: history,
      },
      { onConflict: "user_id,wallet_id" },
    );
  if (saveError)
    throw new HttpError(503, "Could not store the Bitcoin observations.");
  return json(history);
});
Deno.serve(handler);
