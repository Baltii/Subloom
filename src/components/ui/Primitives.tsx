import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { router } from "expo-router";
import Animated, {
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTheme, useWide } from "../../theme/useTheme";
import { tokens } from "../../theme/tokens";
import { useApp } from "../../store/app";

export function Label({
  children,
  size = 14,
  color,
  bold = false,
  style,
  ...props
}: {
  children: ReactNode;
  size?: number;
  color?: string;
  bold?: boolean;
  style?: import("react-native").TextStyle;
} & Omit<import("react-native").TextProps, "style">) {
  const { colors } = useTheme();
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: bold ? tokens.fonts.bold : tokens.fonts.body,
          color: color || colors.text,
          fontSize: size,
          lineHeight: size * 1.45,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Heading({
  children,
  size = 26,
}: {
  children: ReactNode;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{
        fontFamily: tokens.fonts.displayBold,
        fontSize: size,
        lineHeight: size * 1.25,
        color: colors.text,
        letterSpacing: -0.9,
        flexShrink: 1,
      }}
    >
      {children}
    </Text>
  );
}
export function Button({
  children,
  onPress,
  icon: Icon,
  variant = "primary",
  loading = false,
  disabled = false,
  small = false,
  testID,
}: {
  children: string;
  onPress: () => void;
  icon?: LucideIcon;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  testID?: string;
}) {
  const { colors, isDark } = useTheme(),
    reduced = useReducedMotion();
  const foreground =
    variant === "primary"
      ? isDark
        ? "#102219"
        : "#FFFFFF"
      : variant === "danger"
        ? colors.error
        : colors.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={children}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      disabled={disabled || loading}
      onPress={() => {
        if (Platform.OS !== "web")
          void Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: small ? 44 : 50,
        paddingHorizontal: small ? 16 : 21,
        paddingVertical: 11,
        borderRadius: 12,
        backgroundColor:
          variant === "primary"
            ? colors.primary
            : variant === "secondary"
              ? colors.surface
              : variant === "danger"
                ? colors.errorBg
                : "transparent",
        borderWidth: variant === "secondary" ? 1 : 0,
        borderColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        opacity: disabled || loading ? 0.55 : pressed ? 0.8 : 1,
        transform: [{ scale: pressed && !reduced ? 0.985 : 1 }],
      })}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : Icon ? (
        <Icon size={18} color={foreground} />
      ) : null}
      <Label
        bold
        color={foreground}
        style={{ flexShrink: 1, textAlign: "center" }}
      >
        {children}
      </Label>
    </Pressable>
  );
}
export function IconButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        backgroundColor: pressed ? colors.mint : colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      })}
    >
      <Icon size={19} color={colors.text} />
    </Pressable>
  );
}
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 20,
          padding: 24,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "green" | "neutral" | "warning" | "error";
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingVertical: 4,
        paddingHorizontal: 9,
        borderRadius: 7,
        backgroundColor:
          tone === "green"
            ? colors.mint
            : tone === "warning"
              ? colors.warningBg
              : tone === "error"
                ? colors.errorBg
                : colors.background,
      }}
    >
      <Label
        size={11}
        bold
        color={
          tone === "green"
            ? colors.primary
            : tone === "warning"
              ? colors.warning
              : tone === "error"
                ? colors.error
                : colors.secondary
        }
      >
        {children}
      </Label>
    </View>
  );
}
export function SectionTitle({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 18,
      }}
    >
      <Heading size={19}>{title}</Heading>
      {action && (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={{
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Label color={colors.primary} bold size={12}>
            {action}
          </Label>
          <ChevronRight size={15} color={colors.primary} />
        </Pressable>
      )}
    </View>
  );
}
export function Field({
  label,
  error,
  hint,
  leading,
  trailing,
  ...props
}: TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8, marginBottom: 18 }}>
      <Label size={12} bold color={colors.secondary}>
        {label}
      </Label>
      <View
        style={{
          flexDirection: "row",
          alignItems: props.multiline ? "flex-start" : "center",
          gap: 10,
          backgroundColor: colors.background,
          borderWidth: focused ? 2 : 1,
          borderColor: error
            ? colors.error
            : focused
              ? colors.primary
              : colors.border,
          borderRadius: 12,
          paddingHorizontal: focused ? 13 : 14,
          minHeight: 52,
          opacity: props.editable === false ? 0.6 : 1,
        }}
      >
        {leading}
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error || hint}
          {...(Platform.OS === "web" ? { "aria-invalid": Boolean(error) } : {})}
          placeholderTextColor={colors.secondary}
          selectionColor={colors.primary}
          {...props}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          style={[
            {
              flex: 1,
              minWidth: 0,
              minHeight: 50,
              paddingVertical: focused ? 11 : 12,
              fontFamily: tokens.fonts.body,
              fontSize: 15,
              color: colors.text,
              ...(Platform.OS === "web"
                ? ({ outlineStyle: "none" } as object)
                : {}),
            },
            props.style,
          ]}
        />
        {trailing}
      </View>
      {(error || hint) && (
        <Label
          size={12}
          color={error ? colors.error : colors.secondary}
          accessibilityLiveRegion={error ? "polite" : undefined}
        >
          {error || hint}
        </Label>
      )}
    </View>
  );
}
export function Chips<T extends string>({
  values,
  selected,
  onChange,
  labels,
  disabled = false,
}: {
  values: readonly T[];
  selected: T;
  onChange: (value: T) => void;
  labels?: Partial<Record<T, string>>;
  disabled?: boolean;
}) {
  const { colors, isDark } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingVertical: 3 }}
    >
      {values.map((value) => (
        <Pressable
          key={value}
          accessibilityRole="button"
          accessibilityState={{ selected: value === selected, disabled }}
          aria-pressed={value === selected}
          aria-disabled={disabled}
          disabled={disabled}
          onPress={() => onChange(value)}
          style={{
            borderWidth: 1,
            borderColor: value === selected ? colors.primary : colors.border,
            backgroundColor:
              value === selected ? colors.primary : colors.surface,
            borderRadius: 12,
            opacity: disabled ? 0.5 : 1,
            minHeight: 44,
            paddingVertical: 11,
            paddingHorizontal: 15,
          }}
        >
          <Label
            size={12}
            bold
            color={
              value === selected
                ? isDark
                  ? "#102219"
                  : "#FFFFFF"
                : colors.secondary
            }
          >
            {labels?.[value] || value}
          </Label>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function Empty({
  icon: Icon = Plus,
  title,
  body,
  action,
  onPress,
}: {
  icon?: LucideIcon;
  title: string;
  body: string;
  action?: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        alignItems: "center",
        paddingVertical: 42,
        paddingHorizontal: 22,
        gap: 12,
      }}
    >
      <View
        style={{
          backgroundColor: colors.mint,
          width: 56,
          height: 56,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 5,
        }}
      >
        <Icon size={25} color={colors.primary} />
      </View>
      <Heading size={20}>{title}</Heading>
      <Label
        color={colors.secondary}
        style={{ textAlign: "center", maxWidth: 320 }}
      >
        {body}
      </Label>
      {action && onPress && (
        <View style={{ marginTop: 8 }}>
          <Button onPress={onPress} icon={Plus}>
            {action}
          </Button>
        </View>
      )}
    </View>
  );
}
export function AnimatedIn({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={
        reduced
          ? undefined
          : FadeInDown.duration(250)
              .delay(Math.min(delay, 200))
              .springify()
              .damping(22)
      }
    >
      {children}
    </Animated.View>
  );
}
export function Page({
  title,
  subtitle,
  eyebrow,
  children,
  add = false,
  back = false,
  right,
  onRefresh,
  refreshing = false,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children: ReactNode;
  add?: boolean;
  back?: boolean;
  right?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const { colors } = useTheme(),
    wide = useWide(),
    demo = useApp((s) => s.data.demo);
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          ) : undefined
        }
        contentContainerStyle={{
          padding: wide ? 38 : 22,
          paddingBottom: 110,
          width: "100%",
          maxWidth: 1280,
          alignSelf: "center",
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 30,
          }}
        >
          <View style={{ flex: 1, gap: 7 }}>
            {back && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                onPress={() =>
                  router.canGoBack() ? router.back() : router.replace("/")
                }
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  minHeight: 44,
                }}
              >
                <ArrowLeft size={17} color={colors.secondary} />
                <Label color={colors.secondary} size={12}>
                  Back
                </Label>
              </Pressable>
            )}
            {eyebrow && (
              <Label
                size={10}
                bold
                color={colors.secondary}
                style={{ letterSpacing: 1.8 }}
              >
                {eyebrow.toUpperCase()}
              </Label>
            )}
            <Heading size={wide ? 30 : 27}>{title}</Heading>
            {subtitle && (
              <Label size={13} color={colors.secondary}>
                {subtitle}
              </Label>
            )}
          </View>
          {right ||
            (add ? (
              <Button
                small
                icon={Plus}
                onPress={() => router.push("/subscription/new")}
              >
                {wide ? "Add subscription" : "Add"}
              </Button>
            ) : null)}
        </View>
        {demo && (
          <View
            style={{
              marginBottom: 20,
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
            }}
          >
            <Badge tone="warning">Sample workspace</Badge>
            <Label size={11} color={colors.secondary}>
              Illustrative data • no reminders sent
            </Label>
          </View>
        )}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function Confirm({
  visible,
  title,
  body,
  action,
  onConfirm,
  onClose,
  danger = false,
  children,
}: {
  visible: boolean;
  title: string;
  body: string;
  action: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  danger?: boolean;
  children?: ReactNode;
}) {
  const { colors } = useTheme(),
    reduced = useReducedMotion(),
    wide = useWide();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      transparent
      visible={visible}
      animationType={reduced ? "none" : "fade"}
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[
          styles.overlay,
          { justifyContent: wide ? "center" : "flex-end" },
        ]}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 24,
            width: "90%",
            maxWidth: 420,
            maxHeight: "85%",
            marginBottom: wide ? 0 : 24,
          }}
          accessibilityViewIsModal
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 26, gap: 18 }}
          >
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Heading size={20}>{title}</Heading>
              <IconButton
                icon={X}
                label="Close dialog"
                onPress={() => {
                  if (!busy) onClose();
                }}
              />
            </View>
            <Label color={colors.secondary}>{body}</Label>
            {children}
            {error && <Label color={colors.error}>{error}</Label>}
            <Button
              loading={busy}
              variant={danger ? "danger" : "primary"}
              onPress={() => {
                setBusy(true);
                setError(null);
                void onConfirm()
                  .then(onClose)
                  .catch((e: unknown) =>
                    setError(
                      e instanceof Error ? e.message : "Please try again.",
                    ),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              {action}
            </Button>
            <Button variant="ghost" disabled={busy} onPress={onClose}>
              Keep it
            </Button>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export function LinkRow({
  title,
  detail,
  icon: Icon,
  onPress,
}: {
  title: string;
  detail?: string;
  icon: LucideIcon;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        minHeight: 64,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 14,
      }}
    >
      <View
        style={{
          backgroundColor: colors.mint,
          width: 38,
          height: 38,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 12,
        }}
      >
        <Icon size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Label bold>{title}</Label>
        {detail && (
          <Label size={12} color={colors.secondary}>
            {detail}
          </Label>
        )}
      </View>
      <ArrowUpRight size={17} color={colors.secondary} />
    </Pressable>
  );
}
export function Toast() {
  const toast = useApp((s) => s.toast),
    { colors } = useTheme();
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      if (useApp.getState().toast === toast) useApp.setState({ toast: null });
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  if (!toast) return null;
  return (
    <Pressable
      accessibilityRole="alert"
      onPress={() => useApp.setState({ toast: null })}
      style={{
        position: "absolute",
        bottom: 90,
        alignSelf: "center",
        maxWidth: "90%",
        flexDirection: "row",
        gap: 10,
        alignItems: "center",
        backgroundColor: colors.text,
        borderRadius: 14,
        padding: 16,
        zIndex: 100,
      }}
    >
      <Check size={18} color={colors.surface} />
      <Label color={colors.surface} size={13}>
        {toast}
      </Label>
      <X size={15} color={colors.surface} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(10,25,18,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
});
