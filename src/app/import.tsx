import { useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import {
  FileText,
  ImagePlus,
  ScanText,
  ShieldCheck,
} from "lucide-react-native";
import * as Crypto from "expo-crypto";
import {
  Button,
  Card,
  Field,
  Heading,
  Label,
  Page,
} from "../components/ui/Primitives";
import { useTheme } from "../theme/useTheme";
import {
  chooseReceiptImage,
  importTextFile,
  recognizeReceipt,
  type ReceiptImage,
} from "../services/import";
import { extractReceipt } from "../domain/detection";
import { addCandidate, readableError } from "../store/app";
export default function ImportReceipt() {
  const { colors } = useTheme();
  const [text, setText] = useState(""),
    [image, setImage] = useState<ReceiptImage | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      title="Find it in a receipt."
      subtitle="A little less typing. You stay in control."
      back
    >
      <View
        style={{ maxWidth: 740, alignSelf: "center", width: "100%", gap: 20 }}
      >
        <Card style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <ScanText size={22} color={colors.primary} />
            <Heading size={19}>Choose how to import.</Heading>
          </View>
          <Label color={colors.secondary} size={13}>
            Paste confirmation text, import a text file, or choose a screenshot.
            We’ll suggest the details for you to review.
          </Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <Button
              variant="secondary"
              icon={FileText}
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  const result = await importTextFile();
                  if (result !== null) {
                    setText(result);
                    setImage(null);
                  }
                })
              }
            >
              Text receipt
            </Button>
            <Button
              variant="secondary"
              icon={ImagePlus}
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  const result = await chooseReceiptImage();
                  if (result) setImage(result);
                })
              }
            >
              Screenshot
            </Button>
          </View>
        </Card>
        {image && (
          <Card style={{ gap: 16 }}>
            <Image
              source={{ uri: image.uri }}
              style={{ height: 230, width: "100%", borderRadius: 12 }}
              contentFit="contain"
              cachePolicy="none"
            />
            <Label size={12} color={colors.secondary}>
              Reading this screenshot sends it to your Subloom backend and
              Google Cloud Vision. It is processed transiently and is not stored
              by Subloom. Google’s processing terms apply. Continue only if you
              agree.
            </Label>
            <Button
              loading={busy}
              onPress={() =>
                void run(async () => {
                  const result = await recognizeReceipt(image);
                  setText(result);
                })
              }
            >
              Read screenshot with my consent
            </Button>
          </Card>
        )}
        <Card>
          <Field
            testID="receipt-text"
            label="Receipt text"
            placeholder={
              "Paste a subscription confirmation here…\n\nInclude the service, amount, currency, billing period, and renewal date if available."
            }
            multiline
            numberOfLines={9}
            style={{ minHeight: 230, textAlignVertical: "top" }}
            value={text}
            onChangeText={setText}
            maxLength={100_000}
          />
          <Label size={11} color={colors.secondary}>
            Dates are recognized when written as YYYY-MM-DD. Ambiguous
            currencies and missing details stay open for your review.
          </Label>
          {error && (
            <Label color={colors.error} size={12} style={{ marginTop: 14 }}>
              {error}
            </Label>
          )}
          <View style={{ marginTop: 20 }}>
            <Button
              testID="review-receipt"
              icon={ScanText}
              loading={busy}
              disabled={!text.trim()}
              onPress={() =>
                void run(async () => {
                  const candidate = extractReceipt(
                    text,
                    Crypto.randomUUID(),
                    image ? "screenshot" : "receipt",
                  );
                  const id = await addCandidate(candidate);
                  router.replace({
                    pathname: "/detection/[id]",
                    params: { id },
                  });
                })
              }
            >
              Review detected details
            </Button>
          </View>
        </Card>
        <View style={{ flexDirection: "row", gap: 9 }}>
          <ShieldCheck color={colors.primary} size={17} />
          <Label size={11} color={colors.secondary} style={{ flex: 1 }}>
            Pasted text is parsed on your device. Only the extracted details
            sync after you connect an account. Nothing is added to your
            subscriptions without confirmation.
          </Label>
        </View>
      </View>
    </Page>
  );
}
