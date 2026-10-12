import { useEffect } from "react";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export function ChartBar({
  fraction,
  color,
  vertical = false,
}: {
  fraction: number;
  color: string;
  vertical?: boolean;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(1);
  const bounded = Math.max(0, Math.min(1, fraction));
  useEffect(() => {
    progress.value = reduced ? 1 : 0.02;
    progress.value = withTiming(1, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
    return () => cancelAnimation(progress);
  }, [bounded, progress, reduced]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: vertical
      ? [{ scaleY: progress.value }]
      : [{ scaleX: progress.value }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          backgroundColor: color,
          borderRadius: 5,
          ...(vertical
            ? ({
                width: "100%",
                height: `${bounded * 100}%`,
                transformOrigin: "center bottom",
              } as const)
            : ({
                width: `${bounded * 100}%`,
                height: "100%",
                transformOrigin: "left center",
              } as const)),
        },
        animatedStyle,
      ]}
    />
  );
}
