import { useState } from "react";
import {
  Pressable,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from "react-native";

// React Native's style callback has no hover state; track it explicitly for web.
export function InteractiveSurface({
  style,
  ...props
}: Omit<PressableProps, "style"> & {
  style: (
    state: PressableStateCallbackType & { hovered: boolean },
  ) => StyleProp<ViewStyle>;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      {...props}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={(state) => style({ ...state, hovered })}
    />
  );
}
