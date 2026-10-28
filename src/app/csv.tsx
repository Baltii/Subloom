import { useState } from "react";
import { Platform, View } from "react-native";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useApp, importSubscriptions, readableError } from "../store/app";
import { useDisplayCurrency } from "../hooks/useDisplayCurrency";
import type { Subscription } from "../domain/models";
import { csvExample, csvSubscriptions, uniqueCsvRows } from "../domain/csv";
import { shareText } from "../services/files";
import {
  Button,
  Card,
  Field,
  Heading,
  Label,
  Page,
} from "../components/ui/Primitives";
import { ProFeatureBadge } from "../components/pro/ProFeatureBadge";
import { useProAccess } from "../hooks/useProAccess";
import { shareSubscriptionCsv } from "../services/subscriptionCsv";
function Editor({ identity }: { identity: string }) {
  const display = useDisplayCurrency();
  const { pro, requestPro } = useProAccess();
  const subscriptions = useApp((s) => s.data.subscriptions),
    demo = useApp((s) => s.data.demo);
  const [text, setText] = useState(""),
    [preview, setPreview] = useState<Subscription[] | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  async function run(action: () => Promise<void>) {
    if (!requestPro("CSV import & export")) return;
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
  if (!pro)
    return (
      <Page
        title="CSV import & export"
        subtitle="Move your subscription list between apps with Subloom Pro."
        back
      >
        <Card style={{ gap: 16 }}>
          <ProFeatureBadge />
          <Heading size={20}>CSV tools are included in Pro</Heading>
          <Label>
            Import subscription lists and export your subscriptions as CSV with
            Pro. Your JSON data backup in Settings stays free.
          </Label>
          <Button onPress={() => requestPro("CSV import & export")}>
            Explore Pro
          </Button>
        </Card>
      </Page>
    );
  return (
    <Page
      title="CSV import & export"
      subtitle="Review subscriptions before importing."
      back
    >
      <View style={{ gap: 18 }}>
        <ProFeatureBadge />
        <Card style={{ gap: 12 }}>
          <Heading size={18}>Export subscriptions</Heading>
          <Button
            variant="secondary"
            loading={busy}
            onPress={() => void run(() => shareSubscriptionCsv(identity))}
          >
            Export subscriptions as CSV
          </Button>
        </Card>
        <Card style={{ gap: 14 }}>
          <Heading size={18}>Import subscriptions</Heading>
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
                if (!requestPro("CSV import & export")) return;
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
              <Label size={12}>
                Prices are displayed in {display.currency}. Imported billing
                currencies stay unchanged.
              </Label>
              {preview.map((s) => (
                <Label key={s.id}>
                  {s.name} · {display.format(s.amountMinor, s.currency)}{" "}
                  {display.currency} · {s.interval} · {s.status} · next renewal{" "}
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
          Up to 500 rows. Use the example CSV for column names and formatting.
        </Label>
      </View>
    </Page>
  );
}
export default function Csv() {
  const identity = useApp((s) => s.identity);
  return <Editor key={identity} identity={identity} />;
}
