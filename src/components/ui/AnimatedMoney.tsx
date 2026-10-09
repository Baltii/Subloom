import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { Label } from "./Primitives";
import { formatMoney } from "../../domain/money";
import type { Currency } from "../../domain/models";
import { tokens } from "../../theme/tokens";

export function AnimatedMoney({
  amountMinor,
  currency,
  size,
  color,
}: {
  amountMinor: number;
  currency: Currency;
  size: number;
  color: string;
}) {
  const reduced = useReducedMotion();
  // Animate the presentation; exact integer/rational calculations stay outside animation worklets.
  return (
    <Animated.View
      key={currency + ":" + amountMinor}
      entering={reduced ? undefined : FadeIn.duration(tokens.motion.fast)}
    >
      <Label
        size={size}
        bold
        color={color}
        style={{ fontFamily: tokens.fonts.display, letterSpacing: -2 }}
      >
        {formatMoney(amountMinor, currency)}
      </Label>
    </Animated.View>
  );
}
