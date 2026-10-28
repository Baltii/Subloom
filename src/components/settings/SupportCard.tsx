import { useState } from "react";
import { Linking } from "react-native";
import { router } from "expo-router";
import { Coffee, MessageSquare } from "lucide-react-native";
import { Card, Label, LinkRow, SectionTitle } from "../ui/Primitives";
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
      <SectionTitle title="Support & feedback" />
      <LinkRow
        icon={MessageSquare}
        title="Share feedback"
        detail="Suggest an idea or report a problem"
        onPress={() => router.push("/feedback")}
      />
      <LinkRow
        icon={Coffee}
        title="Buy me a coffee"
        detail="Support Subloom on Buy Me a Coffee"
        onPress={() => void openSupport()}
      />
      {error && (
        <Label size={13} color={colors.error} accessibilityLiveRegion="polite">
          Couldn’t open Buy Me a Coffee. Visit buymeacoffee.com/baltiiahmed in
          your browser.
        </Label>
      )}
    </Card>
  );
}
