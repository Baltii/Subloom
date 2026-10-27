import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import { useTheme } from "../../theme/useTheme";
import { Label } from "../ui/Primitives";

/** One accessible input preserves paste, deletion and keyboard behavior across all six cells. */
export function PinCodeInput({
  label = "6-digit PIN",
  value,
  onChange,
  onComplete,
  disabled = false,
  invalid = false,
  autoFocus = false,
  testID,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const input = useRef<TextInput>(null),
    submitted = useRef<string | null>(null);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (value.length < 6) submitted.current = null;
  }, [value]);
  function change(text: string) {
    if (disabled) return;
    const next = text.replace(/\D/g, "").slice(0, 6);
    onChange(next);
    if (next.length < 6) submitted.current = null;
    else if (next !== submitted.current) {
      submitted.current = next;
      onComplete?.(next);
    }
  }
  return (
    <View style={{ gap: 10 }}>
      <Label size={12} bold color={colors.secondary}>
        {label}
      </Label>
      <Pressable
        accessible={false}
        onPress={() => input.current?.focus()}
        disabled={disabled}
        style={{ position: "relative", opacity: disabled ? 0.6 : 1 }}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flexDirection: "row", gap: 8 }}
        >
          {Array.from({ length: 6 }, (_, index) => {
            const active = focused && index === Math.min(value.length, 5);
            return (
              <View
                key={index}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: 60,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  backgroundColor: colors.surface,
                  borderWidth: active ? 2 : 1,
                  borderColor: invalid
                    ? colors.error
                    : active
                      ? colors.primary
                      : colors.border,
                }}
              >
                <Label size={26} bold>
                  {index < value.length ? "•" : ""}
                </Label>
              </View>
            );
          })}
        </View>
        <TextInput
          ref={input}
          testID={testID}
          accessibilityLabel={label}
          accessibilityHint={
            onComplete
              ? "Six digits. Verified automatically after the last digit."
              : "Enter six digits."
          }
          value={value}
          onChangeText={change}
          secureTextEntry
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={6}
          autoComplete="off"
          textContentType="none"
          autoCorrect={false}
          autoCapitalize="none"
          caretHidden
          editable={!disabled}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            color: "transparent",
            backgroundColor: "transparent",
            fontSize: 1,
            ...(Platform.OS === "web"
              ? ({ outlineStyle: "none" } as object)
              : {}),
          }}
        />
      </Pressable>
    </View>
  );
}
