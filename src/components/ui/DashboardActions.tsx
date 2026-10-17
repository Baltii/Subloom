import { View } from "react-native";
import { router } from "expo-router";
import { ReceiptText } from "lucide-react-native";
import { Button, Label } from "./Primitives";
import { useTheme, useWide } from "../../theme/useTheme";

export function DashboardActions() {
  const { colors } = useTheme();
  const wide = useWide();
  return (
    <View
      style={{
        flexDirection: wide ? "row" : "column",
        gap: 16,
        alignItems: wide ? "center" : "flex-start",
        marginBottom: 28,
      }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Label bold>Check what you actually paid</Label>
        <Label size={13} color={colors.secondary}>
          Import a bank statement to find recurring charges and compare them
          with your subscriptions.
        </Label>
      </View>
      <Button
        variant="secondary"
        icon={ReceiptText}
        onPress={() => router.push("/transactions")}
      >
        Review transactions
      </Button>
    </View>
  );
}
