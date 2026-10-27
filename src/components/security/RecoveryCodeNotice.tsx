import { useState } from "react";
import { View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Copy, Check } from "lucide-react-native";
import { useTheme } from "../../theme/useTheme";
import { Button, Label } from "../ui/Primitives";

export function RecoveryCodeNotice({
  code,
  onDone,
}: {
  code: string;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function copy() {
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setError(null);
    } catch {
      setError(
        "Couldn’t copy the code. Save it somewhere safe before continuing.",
      );
    }
  }
  return (
    <View style={{ gap: 16 }} testID="recovery-code-notice">
      <View style={{ gap: 6 }}>
        <Label size={17} bold>
          Keep a way back in.
        </Label>
        <Label size={13} color={colors.secondary}>
          Save this recovery code in your password manager or another safe
          place. It can reset your PIN and passkey if you lose access. We’ll
          only show it once.
        </Label>
      </View>
      <View
        style={{
          padding: 18,
          borderRadius: 12,
          backgroundColor: colors.background,
        }}
      >
        <Label
          selectable
          bold
          size={17}
          style={{ textAlign: "center", lineHeight: 28, letterSpacing: 1 }}
        >
          {code}
        </Label>
      </View>
      <Button
        variant="secondary"
        icon={copied ? Check : Copy}
        onPress={() => void copy()}
      >
        {copied ? "Recovery code copied" : "Copy recovery code"}
      </Button>
      <Label size={12} color={colors.secondary}>
        A new code replaces your previous code. Never share it with anyone,
        including support.
      </Label>
      {error && (
        <Label accessibilityRole="alert" color={colors.error}>
          {error}
        </Label>
      )}
      <Button onPress={onDone}>I’ve saved my code</Button>
    </View>
  );
}
