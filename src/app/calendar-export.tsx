import { ThemedSwitch } from "../components/ui/ThemedSwitch";
import { useState } from "react";
import { View } from "react-native";
import { useApp, readableError } from "../store/app";
import { exportIcs } from "../domain/ics";
import { shareText } from "../services/files";
import { Button, Card, Label, Page } from "../components/ui/Primitives";
export default function CalendarExport() {
  const data = useApp((s) => s.data);
  const [privateContent, setPrivate] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  let result = { text: "", count: 0 };
  let exportError: string | null = null;
  try {
    result = exportIcs(
      data.subscriptions,
      data.preferences.timezone,
      privateContent,
    );
  } catch (e) {
    exportError = readableError(e);
  }
  return (
    <Page
      title="Renewals in your calendar"
      subtitle="Export renewal and trial dates for the next year."
      back
    >
      <Card>
        <View style={{ gap: 18 }}>
          <Label bold>{result.count} calendar events</Label>
          <Label>
            Timezone: {data.preferences.timezone}. Paused and expired
            subscriptions are excluded.
          </Label>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Label style={{ flex: 1 }}>Hide merchant names and prices</Label>
            <ThemedSwitch
              accessibilityLabel="Hide merchant names and prices"
              value={privateContent}
              onValueChange={setPrivate}
            />
          </View>
          <Button
            loading={busy}
            disabled={!result.count}
            onPress={() => {
              setBusy(true);
              setError(null);
              void shareText(
                result.text,
                "subloom-renewals.ics",
                "text/calendar",
              )
                .catch((e) => setError(readableError(e)))
                .finally(() => setBusy(false));
            }}
          >
            Export calendar file
          </Button>
          <Label>
            Open the file in your calendar app. Later changes won’t sync
            automatically; importing it again may duplicate events.
          </Label>
          {exportError || error ? (
            <Label accessibilityRole="alert">{exportError || error}</Label>
          ) : null}
        </View>
      </Card>
    </Page>
  );
}
