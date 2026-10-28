import { useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { FileText, ImagePlus, ScanText } from "lucide-react-native";
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
    <Page title="Import a receipt" back>
      <View
        style={{ maxWidth: 740, alignSelf: "center", width: "100%", gap: 20 }}
      >
        <Card style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <ScanText size={22} color={colors.primary} />
            <Heading size={19}>Choose a receipt</Heading>
          </View>
          <Label color={colors.secondary} size={13}>
            Upload a receipt or paste its text below.
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
              Choose text file
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
              Choose screenshot
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
              This image is sent to Google Cloud Vision for text recognition.
              Subloom does not store it. Continue if you agree to Google’s
              processing terms.
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
              Agree and read screenshot
            </Button>
          </Card>
        )}
        <Card>
          <Field
            testID="receipt-text"
            label="Receipt text"
            placeholder="Paste a subscription receipt…"
            multiline
            numberOfLines={9}
            style={{ minHeight: 230, textAlignVertical: "top" }}
            value={text}
            onChangeText={setText}
            maxLength={100_000}
          />
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
        <Label size={12} color={colors.secondary}>
          Pasted text stays on your device. Review details before adding a
          subscription.
        </Label>
      </View>
    </Page>
  );
}
