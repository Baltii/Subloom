import { z } from "zod";
import {
  bitcoinAddressSchema,
  bitcoinHistorySchema,
} from "../domain/bitcoin.ts";
const sats = z.number().int().nonnegative().max(2_100_000_000_000_000);
const output = z.object({
  scriptpubkey_address: z.string().optional(),
  value: sats,
});
const transactions = z
  .array(
    z.object({
      txid: z.string().regex(/^[a-f0-9]{64}$/),
      vin: z
        .array(z.object({ prevout: output.nullable().optional() }))
        .max(10000),
      vout: z.array(output).max(10000),
      status: z.object({
        confirmed: z.boolean(),
        block_time: z.number().int().positive().optional(),
      }),
    }),
  )
  .max(75);
export function parseBitcoinTransactions(
  input: unknown,
  address: string,
  now = new Date(),
) {
  const parsed = transactions.parse(input);
  if (new Set(parsed.map((t) => t.txid)).size !== parsed.length)
    throw new Error("Duplicate blockchain transactions.");
  return bitcoinHistorySchema.parse({
    address,
    fetchedAt: now.toISOString(),
    provider: "mempool",
    transactions: parsed.slice(0, 25).map((t) => {
      const received = t.vout
        .filter((v) => v.scriptpubkey_address === address)
        .reduce((n, v) => n + BigInt(v.value), 0n);
      const spent = t.vin
        .filter((v) => v.prevout?.scriptpubkey_address === address)
        .reduce((n, v) => n + BigInt(v.prevout!.value), 0n);
      if (
        !t.vout.some((v) => v.scriptpubkey_address === address) &&
        !t.vin.some((v) => v.prevout?.scriptpubkey_address === address)
      )
        throw new Error("Unrelated address transaction.");
      return {
        txid: t.txid,
        netSats: Number(received - spent),
        confirmed: t.status.confirmed,
        blockTime: t.status.confirmed ? (t.status.block_time ?? null) : null,
      };
    }),
  });
}
export async function fetchBitcoinHistory(
  input: string,
  fetcher: typeof fetch = fetch,
  api = "https://mempool.space/api",
) {
  const address = bitcoinAddressSchema.parse(input);
  const response = await fetcher(
    api + "/address/" + encodeURIComponent(address) + "/txs",
    { signal: AbortSignal.timeout(15000) },
  );
  if (!response.ok)
    throw new Error("The Bitcoin explorer is unavailable or rate limited.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The Bitcoin explorer returned no data.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 750000) {
        await reader.cancel();
        throw new Error("Bitcoin history response is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return parseBitcoinTransactions(
    JSON.parse(new TextDecoder().decode(bytes)),
    address,
  );
}
