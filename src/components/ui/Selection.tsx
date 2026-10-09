import { useRef, useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { Check, ChevronDown, Search, X } from "lucide-react-native";
import { useTheme, useWide } from "../../theme/useTheme";
import { Field, Heading, IconButton, Label } from "./Primitives";

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
  detail?: string;
  icon?: ReactNode;
};

/** One protected focus context for choosing values, on phones and larger screens. */
export function PickerSheet({
  visible,
  title,
  description,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { colors } = useTheme(),
    wide = useWide(),
    reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduced ? "none" : "fade"}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
          justifyContent: wide ? "center" : "flex-end",
          alignItems: "center",
          paddingTop: insets.top + 20,
        }}
      >
        <Pressable
          accessible={false}
          onPress={onClose}
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(8, 22, 16, 0.46)" },
          ]}
        />
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.surface,
            width: "100%",
            maxWidth: wide ? 460 : 600,
            maxHeight: "88%",
            borderRadius: wide ? 20 : 24,
            borderBottomLeftRadius: wide ? 20 : 0,
            borderBottomRightRadius: wide ? 20 : 0,
            paddingBottom: wide ? 8 : Math.max(insets.bottom, 16),
            overflow: "hidden",
          }}
        >
          {!wide && (
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
                alignSelf: "center",
                marginTop: 10,
              }}
            />
          )}
          <View
            style={{
              padding: 20,
              paddingBottom: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View style={{ flex: 1, gap: 5 }}>
              <Heading size={22}>{title}</Heading>
              {description && (
                <Label size={12} color={colors.secondary}>
                  {description}
                </Label>
              )}
            </View>
            <IconButton icon={X} label={"Close " + title} onPress={onClose} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}
          >
            {children}
          </ScrollView>
          {footer && (
            <View
              style={{
                padding: 20,
                paddingTop: 12,
                borderTopWidth: 1,
                borderColor: colors.border,
              }}
            >
              {footer}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = "Choose an option",
  searchable = false,
  hint,
  error,
  disabled = false,
  testID,
  compact = false,
  showDetail = true,
}: {
  label: string;
  value: T | "";
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  searchable?: boolean;
  hint?: string;
  error?: string;
  disabled?: boolean;
  testID?: string;
  compact?: boolean;
  showDetail?: boolean;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [focused, setFocused] = useState(false);
  const trigger = useRef<View>(null);
  const optionRefs = useRef<Record<string, View | null>>({});
  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) =>
    `${o.label} ${o.value} ${o.detail || ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  function close() {
    setOpen(false);
    if (Platform.OS === "web")
      (trigger.current as unknown as { focus?: () => void })?.focus?.();
  }
  return (
    <View style={{ gap: 8, marginBottom: compact ? 0 : 18 }}>
      {!compact && (
        <Label size={12} bold color={colors.secondary}>
          {label}
        </Label>
      )}
      <Pressable
        ref={trigger}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label || placeholder}`}
        accessibilityHint="Opens the available choices"
        accessibilityState={{ expanded: open, disabled }}
        aria-expanded={open}
        aria-disabled={disabled}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPress={() => {
          setQuery("");
          setOpen(true);
        }}
        style={({ pressed }) => ({
          borderWidth: focused ? 2 : 1,
          borderColor: error
            ? colors.error
            : focused
              ? colors.primary
              : colors.border,
          borderRadius: 12,
          backgroundColor: pressed ? colors.mint : colors.background,
          minHeight: 52,
          paddingHorizontal: focused ? 13 : 14,
          paddingVertical: focused ? 10 : 11,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          opacity: disabled ? 0.5 : 1,
        })}
      >
        {selected?.icon}
        <View style={{ flex: 1, gap: 2 }}>
          <Label
            size={14}
            color={selected ? colors.text : colors.secondary}
            bold={Boolean(selected)}
          >
            {selected?.label || placeholder}
          </Label>
          {!compact && showDetail && selected?.detail && (
            <Label size={11} color={colors.secondary}>
              {selected.detail}
            </Label>
          )}
        </View>
        <ChevronDown size={17} color={colors.secondary} />
      </Pressable>
      {(error || hint) && (
        <Label
          size={12}
          color={error ? colors.error : colors.secondary}
          accessibilityLiveRegion={error ? "polite" : undefined}
        >
          {error || hint}
        </Label>
      )}
      <PickerSheet visible={open} title={label} onClose={close}>
        {searchable && (
          <Field
            label={"Search " + label.toLowerCase()}
            placeholder="Search by name or code…"
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCorrect={false}
            leading={<Search size={17} color={colors.secondary} />}
          />
        )}
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={label}
          style={{ gap: 4 }}
        >
          {filtered.map((option, index) => {
            const chosen = option.value === value;
            return (
              <Pressable
                key={option.value}
                ref={(ref) => {
                  optionRefs.current[option.value] = ref;
                }}
                {...(Platform.OS === "web"
                  ? {
                      onKeyDown: (event: {
                        key: string;
                        preventDefault: () => void;
                      }) => {
                        const step = ["ArrowDown", "ArrowRight"].includes(
                          event.key,
                        )
                          ? 1
                          : ["ArrowUp", "ArrowLeft"].includes(event.key)
                            ? -1
                            : 0;
                        if (!step && !["Home", "End"].includes(event.key))
                          return;
                        event.preventDefault();
                        const next =
                          event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? filtered.length - 1
                              : (index + step + filtered.length) %
                                filtered.length;
                        const target = filtered[next];
                        if (target)
                          (
                            optionRefs.current[target.value] as unknown as {
                              focus?: () => void;
                            }
                          )?.focus?.();
                      },
                    }
                  : {})}
                accessibilityRole="radio"
                accessibilityState={{ checked: chosen }}
                aria-checked={chosen}
                accessibilityLabel={option.label}
                onPress={() => {
                  onChange(option.value);
                  close();
                }}
                style={({ pressed }) => ({
                  padding: 14,
                  minHeight: 54,
                  borderRadius: 12,
                  backgroundColor:
                    chosen || pressed ? colors.mint : "transparent",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                })}
              >
                {option.icon}
                <View style={{ flex: 1, gap: 3 }}>
                  <Label bold size={14}>
                    {option.label}
                  </Label>
                  {option.detail && (
                    <Label
                      size={12}
                      color={chosen ? colors.primary : colors.secondary}
                    >
                      {option.detail}
                    </Label>
                  )}
                </View>
                {chosen && <Check size={19} color={colors.primary} />}
              </Pressable>
            );
          })}
          {filtered.length === 0 && (
            <View style={{ paddingVertical: 24, gap: 6 }}>
              <Label bold>No matching options</Label>
              <Label size={12} color={colors.secondary}>
                Try another name or code.
              </Label>
            </View>
          )}
        </View>
      </PickerSheet>
    </View>
  );
}
