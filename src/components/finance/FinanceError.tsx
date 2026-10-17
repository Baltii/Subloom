import { Label } from "../ui/Primitives";
import { useTheme } from "../../theme/useTheme";
export function FinanceError({ message }: { message: string | null }) {
  const { colors } = useTheme();
  return message ? (
    <Label
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      color={colors.error}
    >
      {message}
    </Label>
  ) : null;
}
