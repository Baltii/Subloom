import { describe, it, expect } from "vitest";
import {
  bitcoinPaymentUri,
  validBitcoinAddress,
  parseSats,
  formatBtc,
  cryptoSchema,
} from "../../src/domain/bitcoin";
import {
  parseBitcoinTransactions,
  fetchBitcoinHistory,
} from "../../src/services/bitcoinExplorer";
const address = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
const txid = "a".repeat(64);
describe("noncustodial Bitcoin controls", () => {
  it("validates official mainnet SegWit vectors, checksums and casing", () => {
    expect(validBitcoinAddress(address)).toBe(true);
    expect(
      validBitcoinAddress(
        "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0",
      ),
    ).toBe(true);
    expect(
      validBitcoinAddress(
        "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqh2y7hd",
      ),
    ).toBe(false);
    expect(validBitcoinAddress(address.toUpperCase())).toBe(true);
    expect(
      validBitcoinAddress(
        "bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3",
      ),
    ).toBe(true);
    for (const bad of [
      address.slice(0, -1) + "q",
      address.replace("bc1", "bC1"),
      "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
      "private key",
      address + "?amount=1",
    ])
      expect(validBitcoinAddress(bad)).toBe(false);
  });
  it("uses integer satoshis and explicit, injection-safe payment URIs", () => {
    expect(parseSats("0.00000001")).toBe(1);
    expect(formatBtc(1)).toBe("0.00000001");
    expect(bitcoinPaymentUri(address, "0.00000001")).toBe(
      "bitcoin:" + address + "?amount=0.00000001",
    );
    for (const amount of [
      "0",
      "-1",
      "1e-8",
      "1.000000001",
      "21000001",
      "1&label=bad",
    ])
      expect(() => parseSats(amount)).toThrow();
  });
  it("rejects credentials and duplicate watched addresses", () => {
    const wallet = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Bitcoin",
      address,
    };
    expect(
      cryptoSchema.safeParse({
        wallets: [{ ...wallet, seed: "secret" }],
        intentions: [],
      }).success,
    ).toBe(false);
    expect(
      cryptoSchema.safeParse({
        wallets: [
          wallet,
          { ...wallet, id: "22222222-2222-4222-8222-222222222222" },
        ],
        intentions: [],
      }).success,
    ).toBe(false);
  });
  it("calculates address net movement with change, distinguishing pending/confirmed", () => {
    const tx = {
      txid,
      vin: [{ prevout: { scriptpubkey_address: address, value: 10000 } }],
      vout: [
        { scriptpubkey_address: address, value: 3000 },
        { scriptpubkey_address: "other", value: 6500 },
      ],
      status: { confirmed: true, block_time: 1780000000 },
    };
    expect(
      parseBitcoinTransactions([tx], address).transactions[0],
    ).toMatchObject({ netSats: -7000, confirmed: true });
    expect(
      parseBitcoinTransactions(
        [{ ...tx, status: { confirmed: false } }],
        address,
      ).transactions[0],
    ).toMatchObject({ confirmed: false, blockTime: null });
    expect(() =>
      parseBitcoinTransactions(
        [{ ...tx, status: { confirmed: true } }],
        address,
      ),
    ).toThrow();
    expect(() =>
      parseBitcoinTransactions(
        [
          {
            ...tx,
            vin: [],
            vout: [{ scriptpubkey_address: "other", value: 100 }],
          },
        ],
        address,
      ),
    ).toThrow();
  });
  it("does not simulate success on explorer errors or oversize streams", async () => {
    const failed = (async () =>
      new Response("rate limited", { status: 429 })) as typeof fetch;
    await expect(fetchBitcoinHistory(address, failed)).rejects.toThrow(
      /unavailable/,
    );
    const huge = (async () => new Response(" ".repeat(750001))) as typeof fetch;
    await expect(fetchBitcoinHistory(address, huge)).rejects.toThrow(
      /too large/,
    );
  });
});
