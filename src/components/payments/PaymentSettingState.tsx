import { View } from "react-native";
import { Button, Label } from "../ui/Primitives";
export function PaymentSettingState({
  loaded,
  error,
  reload,
}: {
  loaded: boolean;
  error: string | null;
  reload: () => Promise<void>;
}) {
  return error ? (
    <View style={{ gap: 12 }}>
      <Label accessibilityRole="alert">{error}</Label>
      <Button variant="secondary" onPress={() => void reload()}>
        Reload saved data
      </Button>
    </View>
  ) : !loaded ? (
    <Label accessibilityLiveRegion="polite">Loading saved data…</Label>
  ) : null;
}
