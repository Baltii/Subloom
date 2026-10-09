import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../../theme/useTheme";

export function LoadingSkeleton() {
  const { colors } = useTheme(),
    reduced = useReducedMotion(),
    opacity = useSharedValue(0.65);
  useEffect(() => {
    if (!reduced)
      opacity.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity, reduced]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading your saved subscriptions"
      style={[{ width: "100%", maxWidth: 360, gap: 15 }, animated]}
    >
      {[100, 70, 85].map((width, index) => (
        <View
          key={width}
          style={{
            height: index === 0 ? 110 : 54,
            borderRadius: 16,
            backgroundColor: colors.border,
            width: `${width}%`,
          }}
        />
      ))}
    </Animated.View>
  );
}
