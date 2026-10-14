import { FinanceError } from "../../components/finance/FinanceError";
import { financeError } from "../../components/finance/errors";
import { useState } from "react";
import { View } from "react-native";
import * as Linking from "expo-linking";
import {
  bitcoinPaymentUri,
  parseSats,
  formatBtc,
  bitcoinAddressSchema,
} from "../../domain/bitcoin";
import {
  Button,
  Confirm,
  Field,
  Heading,
  Label,
  Page,
} from "../../components/ui/Primitives";
import { useApp } from "../../store/app";
export default function BitcoinPaymentRoute() {
  const [address, setAddress] = useState(""),
    [amount, setAmount] = useState(""),
    [error, setError] = useState<string | null>(null),
    [review, setReview] = useState<{
      address: string;
      amount: string;
      uri: string;
    } | null>(null);
  const demo = useApp((s) => s.data.demo);
  function prepare() {
    try {
      setError(null);
      const uri = bitcoinPaymentUri(address, amount);
      setReview({
        address: bitcoinAddressSchema.parse(address),
        amount: formatBtc(parseSats(amount)),
        uri,
      });
    } catch (e) {
      setError(financeError(e));
    }
  }
  return (
    <Page
      title="Pay with Bitcoin"
      subtitle="Review a payment request before opening your wallet."
      back
    >
      <View style={{ gap: 20, maxWidth: 720, width: "100%" }}>
        <Heading size={20}>Recipient and amount</Heading>
        <Field
          label="Recipient’s Bitcoin address"
          value={address}
          onChangeText={setAddress}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={74}
          placeholder="bc1…"
        />
        <Field
          label="Amount in BTC"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00000000"
        />
        <Label>
          The merchant must accept Bitcoin. Your wallet calculates network fees
          and asks you to authorize the payment. Opening it does not create a
          transaction or mark a subscription paid.
        </Label>
        <FinanceError message={error} />
        <Button disabled={demo} onPress={prepare}>
          Review payment request
        </Button>
        <Confirm
          visible={Boolean(review)}
          title="Review in your Bitcoin wallet"
          body={
            review
              ? "Send " +
                review.amount +
                " BTC to " +
                review.address +
                ". Your wallet will show fees and ask for authorization. Confirm the recipient with the merchant."
              : ""
          }
          action="Open Bitcoin wallet"
          onClose={() => setReview(null)}
          onConfirm={async () => {
            if (!review) return;
            try {
              await Linking.openURL(review.uri);
              setReview(null);
            } catch {
              setReview(null);
              setError(
                "Could not open a Bitcoin wallet. Install a wallet that supports bitcoin: payment links, then retry.",
              );
            }
          }}
        />
      </View>
    </Page>
  );
}
