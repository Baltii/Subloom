import { useState } from "react";
import { Platform, View } from "react-native";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useApp, importSubscriptions, readableError } from "../store/app";
import { formatMoney } from "../domain/money";
import type { Subscription } from "../domain/models";
import {
  csvExample,
  csvSubscriptions,
  exportCsv,
  uniqueCsvRows,
} from "../domain/csv";
import { shareText } from "../services/files";
import { Button, Card, Field, Label, Page } from "../components/ui/Primitives";
function Editor({ identity }: { identity: string }) {
  const subscriptions = useApp((s) => s.data.subscriptions),
    demo = useApp((s) => s.data.demo);
  const [text, setText] = useState(""),
    [preview, setPreview] = useState<Subscription[] | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
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
      title="CSV import & export"
      subtitle="Review every row before importing. Existing subscriptions are never overwritten."
      back
    >
      <View style={{ gap: 18 }}>
        <Button
          variant="secondary"
          loading={busy}
          onPress={() =>
            void run(() =>
              shareText(
                exportCsv(subscriptions),
                "subloom-subscriptions.csv",
                "text/csv",
              ),
            )
          }
        >
          Export subscriptions as CSV
        </Button>
        <Button
          variant="ghost"
          loading={busy}
          onPress={() =>
            void run(() =>
              shareText(csvExample, "subloom-example.csv", "text/csv"),
            )
          }
        >
          Download example CSV
        </Button>
        <Card>
          <Field
            label="CSV content"
            multiline
            numberOfLines={8}
            value={text}
            editable={!busy}
            onChangeText={(v) => {
              setText(v);
              setPreview(null);
            }}
          />
          <View style={{ gap: 12 }}>
            <Button
              variant="secondary"
              loading={busy}
              onPress={() =>
                void run(async () => {
                  const result = await DocumentPicker.getDocumentAsync({
                    type: [
                      "text/csv",
                      "text/plain",
                      "application/vnd.ms-excel",
                    ],
                    copyToCacheDirectory: true,
                  });
                  if (result.canceled) return;
                  const asset = result.assets[0]!;
                  const file =
                    Platform.OS === "web" ? null : new File(asset.uri);
                  if ((asset.size ?? file?.size ?? 0) > 2_000_000)
                    throw new Error("Choose a CSV smaller than 2 MB.");
                  const content = file
                    ? await file.text()
                    : await (await fetch(asset.uri)).text();
                  if (content.length > 2_000_000)
                    throw new Error("Choose a CSV smaller than 2 MB.");
                  setText(content);
                  setPreview(null);
                })
              }
            >
              Choose CSV file
            </Button>
            <Button
              disabled={demo || !text.trim() || busy}
              onPress={() => {
                setError(null);
                try {
                  setPreview(
                    uniqueCsvRows(
                      csvSubscriptions(text, identity, Crypto.randomUUID),
                      subscriptions,
                    ),
                  );
                } catch (e) {
                  setError(readableError(e));
                  setPreview(null);
                }
              }}
            >
              Review import
            </Button>
          </View>
        </Card>
        {preview ? (
          <Card>
            <View style={{ gap: 12 }}>
              <Label bold>
                {preview.length} new subscriptions · matching rows skipped
              </Label>
              {preview.map((s) => (
                <Label key={s.id}>
                  {s.name} · {formatMoney(s.amountMinor, s.currency)}{" "}
                  {s.currency} · {s.interval} · {s.status} · next renewal{" "}
                  {s.nextRenewal}
                </Label>
              ))}
              <Button
                loading={busy}
                disabled={!preview.length || demo}
                onPress={() =>
                  void run(async () => {
                    await importSubscriptions(preview, identity);
                    setPreview(null);
                    setText("");
                  })
                }
              >
                Import reviewed subscriptions
              </Button>
            </View>
          </Card>
        ) : null}
        {error ? <Label accessibilityRole="alert">{error}</Label> : null}
        <Label>
          Maximum 500 rows. Currency amounts use decimal points. Download the
          example for supported headers. Spreadsheet formulas are escaped on
          export.
        </Label>
      </View>
    </Page>
  );
}
export default function Csv() {
  const identity = useApp((s) => s.identity);
  return <Editor key={identity} identity={identity} />;
}
