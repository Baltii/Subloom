import { useEffect } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Crown } from "lucide-react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Brand } from "../ui/Brand";
import { Label } from "../ui/Primitives";
import { tokens } from "../../theme/tokens";
import { useTheme, useWide } from "../../theme/useTheme";

export function ProMembershipCard({
  active,
  ending,
  interval,
  detail,
}: {
  active: boolean;
  ending: boolean;
  interval: "month" | "year";
  detail: string;
}) {
  const wide = useWide();
  const compact = useWindowDimensions().width < 380;
  const { colors } = useTheme();
  const lift = useSharedValue(0);
  const selected = useSharedValue(1);
  useEffect(() => {
    selected.set(
      withTiming(interval === "year" ? 1 : 0, {
        duration: 240,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [interval, selected]);
  const artworkStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: lift.value },
      { rotate: `${-3 + selected.value * 3}deg` },
    ],
  }));
  return (
    <View
      testID="pro-membership-card"
      onPointerEnter={() => {
        lift.set(
          withTiming(-6, {
            duration: 240,
            reduceMotion: ReduceMotion.System,
          }),
        );
      }}
      onPointerLeave={() => {
        lift.set(
          withTiming(0, {
            duration: 240,
            reduceMotion: ReduceMotion.System,
          }),
        );
      }}
      style={{
        backgroundColor: colors.hero,
        borderRadius: 24,
        padding: wide ? 32 : 24,
        gap: 24,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <Brand compact={compact} />
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          <Crown size={16} color={colors.heroText} />
          <Label bold size={13} color={colors.heroText}>
            Pro
          </Label>
        </View>
      </View>
      <View
        style={{
          flexDirection: compact ? "column" : "row",
          alignItems: compact ? "stretch" : "center",
          gap: wide ? 16 : 8,
        }}
      >
        <View style={{ flex: 1, gap: 12 }}>
          <Text
            style={{
              fontFamily: tokens.fonts.displayBold,
              color: colors.heroText,
              fontSize: wide ? 32 : 26,
              lineHeight: wide ? 39 : 32,
              letterSpacing: -0.65,
            }}
          >
            {active
              ? "A little more,\nall yours."
              : "More clarity.\nMore room."}
          </Text>
          <Label size={13} color={colors.heroSecondary}>
            {active
              ? ending
                ? "Yours until your plan ends."
                : "Your everyday, with Pro."
              : "For the way you keep life organized."}
          </Label>
        </View>
        <Animated.View
          style={[
            {
              width: wide ? 154 : compact ? 138 : 112,
              height: wide ? 154 : 138,
              alignSelf: "center",
            },
            artworkStyle,
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Image
            source={require("../../../assets/illustrations/pro-membership.webp")}
            contentFit="contain"
            style={{ width: "100%", height: "100%" }}
            accessibilityLabel=""
          />
        </Animated.View>
      </View>
      <Label size={12} color={colors.heroSecondary}>
        {detail}
      </Label>
    </View>
  );
}
