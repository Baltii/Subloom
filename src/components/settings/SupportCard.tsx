import { useState } from "react";
import { Linking, View } from "react-native";
import { Coffee } from "lucide-react-native";
import { Button, Card, Label, SectionTitle } from "../ui/Primitives";
import { useTheme } from "../../theme/useTheme";

// Public creator page confirmed in the account's official button generator.
const supportUrl = "https://buymeacoffee.com/baltiiahmed";

export function SupportCard() {
  const { colors } = useTheme();
  const [error, setError] = useState(false);

  async function openSupport() {
    setError(false);
    try {
      await Linking.openURL(supportUrl);
    } catch {
      setError(true);
    }
  }

  return (
    <Card style={{ gap: 14 }}>
      <SectionTitle title="Support Subloom" />
      <Label color={colors.secondary}>
        Enjoying Subloom? You can support my work with a coffee.
      </Label>
      <View style={{ alignItems: "flex-start", gap: 10 }}>
        <Button
          icon={Coffee}
          variant="secondary"
          testID="support-subloom"
          accessibilityLabel="Buy me a coffee — opens Buy Me a Coffee in your browser"
          onPress={() => void openSupport()}
        >
          Buy me a coffee
        </Button>
        <Label size={12} color={colors.secondary}>
          Optional support through Buy Me a Coffee. No Subloom account or
          upgrade is required.
        </Label>
      </View>
      {error && (
        <Label size={13} color={colors.error} accessibilityLiveRegion="polite">
          Couldn’t open Buy Me a Coffee. Visit buymeacoffee.com/baltiiahmed in
          your browser.
        </Label>
      )}
    </Card>
  );
}
