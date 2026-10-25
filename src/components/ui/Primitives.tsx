import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
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
  Check,
  ChevronRight,
  Plus,
  X,
  Zap,
  AlertCircle,
  type LucideIcon,
} from "lucide-react-native";
import { router } from "expo-router";
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTheme, useWide } from "../../theme/useTheme";
import { bottomTabLayout } from "../../theme/navigation";
import { tokens } from "../../theme/tokens";
import { useApp } from "../../store/app";
import { useQuickActions } from "../../hooks/useQuickActions";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
          fontVariant: ["tabular-nums"],
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
        letterSpacing: -size * 0.025,
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
  accessibilityLabel,
}: {
  children: string;
  onPress: () => void;
  icon?: LucideIcon;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme(),
    reduced = useReducedMotion();
  const [focused, setFocused] = useState(false),
    [hovered, setHovered] = useState(false);
  const scale = useSharedValue(1);
  const motionStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const foreground =
    variant === "primary"
      ? colors.onPrimary
      : variant === "danger"
        ? colors.error
        : colors.text;
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      disabled={disabled || loading}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPressIn={() => {
        scale.set(reduced ? 1 : withTiming(0.985, { duration: 100 }));
      }}
      onPressOut={() => {
        scale.set(
          reduced ? 1 : withTiming(1, { duration: tokens.motion.fast }),
        );
      }}
      onPress={() => {
        if (Platform.OS !== "web")
          void Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={[
        {
          minHeight: small ? 44 : 50,
          paddingHorizontal: small ? 16 : 21,
          paddingVertical: 11,
          borderRadius: 12,
          backgroundColor:
            variant === "primary"
              ? hovered
                ? colors.pressed
                : colors.primary
              : variant === "secondary"
                ? hovered
                  ? colors.mint
                  : colors.surface
                : variant === "danger"
                  ? colors.errorBg
                  : hovered
                    ? colors.mint
                    : "transparent",
          borderWidth: variant === "secondary" ? 1 : 0,
          borderColor: focused ? colors.primary : colors.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 9,
          opacity: disabled || loading ? 0.6 : 1,
          ...(Platform.OS === "web" && focused
            ? {
                outlineStyle: "solid",
                outlineWidth: 2,
                outlineOffset: 3,
                outlineColor: colors.primary,
              }
            : {}),
        } as ViewStyle,
        motionStyle,
      ]}
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
    </AnimatedPressable>
  );
}
export function IconButton({
  icon: Icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false),
    [hovered, setHovered] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        backgroundColor: pressed || hovered ? colors.mint : colors.surface,
        borderWidth: 1,
        borderColor: focused ? colors.primary : colors.border,
        opacity: disabled ? 0.5 : 1,
        ...(Platform.OS === "web" && focused
          ? {
              outlineStyle: "solid",
              outlineWidth: 2,
              outlineOffset: 2,
              outlineColor: colors.primary,
            }
          : {}),
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
          borderRadius: tokens.radius.md,
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
  inputRef,
  ...props
}: TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  inputRef?: Ref<TextInput>;
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
          ref={inputRef}
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
              fontSize: 16,
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
  wrap = false,
}: {
  values: readonly T[];
  selected: T;
  onChange: (value: T) => void;
  labels?: Partial<Record<T, string>>;
  disabled?: boolean;
  wrap?: boolean;
}) {
  const { colors } = useTheme();
  const choices = values.map((value) => (
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
        backgroundColor: value === selected ? colors.primary : colors.surface,
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
        color={value === selected ? colors.onPrimary : colors.secondary}
      >
        {labels?.[value] || value}
      </Label>
    </Pressable>
  ));
  return wrap ? (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        paddingVertical: 3,
      }}
    >
      {choices}
    </View>
  ) : (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingVertical: 3 }}
    >
      {choices}
    </ScrollView>
  );
}
export function Empty({
  icon: Icon = Plus,
  title,
  body,
  action,
  onPress,
  actionIcon = Plus,
}: {
  icon?: LucideIcon;
  title: string;
  body: string;
  action?: string;
  onPress?: () => void;
  actionIcon?: LucideIcon;
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
          <Button onPress={onPress} icon={actionIcon}>
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
          : FadeIn.duration(tokens.motion.fast).delay(Math.min(delay, 80))
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
  footer,
  contentMaxWidth = 1280,
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
  footer?: ReactNode;
  contentMaxWidth?: number;
}) {
  const { colors } = useTheme(),
    wide = useWide(),
    demo = useApp((s) => s.data.demo);
  const quickActions = useQuickActions();
  const insets = useSafeAreaInsets();
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
          paddingBottom: footer ? 28 : 110,
          width: "100%",
          maxWidth: contentMaxWidth,
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {quickActions && !back && (
              <IconButton
                icon={Zap}
                label="Quick actions"
                onPress={quickActions}
              />
            )}
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
      {footer && (
        <View
          style={{
            borderTopWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: 22,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          {footer}
        </View>
      )}
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
  cancelLabel = "Cancel",
  confirmDisabled = false,
}: {
  visible: boolean;
  title: string;
  body: string;
  action: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  danger?: boolean;
  children?: ReactNode;
  cancelLabel?: string;
  confirmDisabled?: boolean;
}) {
  const { colors } = useTheme(),
    reduced = useReducedMotion(),
    wide = useWide();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  function close() {
    if (!busyRef.current) {
      setError(null);
      onClose();
    }
  }
  return (
    <Modal
      accessibilityLabel={title}
      transparent
      visible={visible}
      animationType={reduced ? "none" : "fade"}
      onRequestClose={close}
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
            borderRadius: 20,
            width: "90%",
            maxWidth: 460,
            maxHeight: "85%",
            marginBottom: wide ? 0 : 24,
          }}
          accessibilityViewIsModal
          accessibilityLabel={title}
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
                disabled={busy}
                onPress={close}
              />
            </View>
            <Label color={colors.secondary}>{body}</Label>
            {children}
            {error && (
              <View
                accessibilityRole="alert"
                style={{
                  flexDirection: "row",
                  gap: 10,
                  padding: 12,
                  borderRadius: 10,
                  backgroundColor: colors.errorBg,
                }}
              >
                <AlertCircle color={colors.error} size={18} />
                <Label color={colors.error} style={{ flex: 1 }}>
                  {error}
                </Label>
              </View>
            )}
            <Button
              loading={busy}
              disabled={confirmDisabled}
              variant={danger ? "danger" : "primary"}
              onPress={() => {
                if (busyRef.current || confirmDisabled) return;
                busyRef.current = true;
                setBusy(true);
                setError(null);
                void onConfirm()
                  .then(onClose)
                  .catch((e: unknown) =>
                    setError(
                      e instanceof Error ? e.message : "Please try again.",
                    ),
                  )
                  .finally(() => {
                    busyRef.current = false;
                    setBusy(false);
                  });
              }}
            >
              {action}
            </Button>
            <Button variant="ghost" disabled={busy} onPress={close}>
              {cancelLabel}
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
  badge,
  icon: Icon,
  onPress,
  disabled = false,
}: {
  title: string;
  detail?: string;
  badge?: ReactNode;
  icon: LucideIcon;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
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
          backgroundColor: disabled ? colors.background : colors.mint,
          width: 38,
          height: 38,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 12,
        }}
      >
        <Icon size={18} color={disabled ? colors.secondary : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Label bold color={disabled ? colors.secondary : colors.text}>
            {title}
          </Label>
          {badge}
        </View>
        {detail && (
          <Label size={12} color={colors.secondary}>
            {detail}
          </Label>
        )}
      </View>
      {!disabled && <ChevronRight size={17} color={colors.secondary} />}
    </Pressable>
  );
}
export function Toast() {
  const insets = useSafeAreaInsets();
  const toast = useApp((s) => s.toast),
    tone = useApp((s) => s.toastTone),
    toastId = useApp((s) => s.toastId),
    { colors } = useTheme();
  const wide = useWide(),
    reduced = useReducedMotion();
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(
      () => {
        if (useApp.getState().toastId === toastId)
          useApp.setState({ toast: null });
      },
      tone === "error" ? 8000 : 4500,
    );
    return () => clearTimeout(timer);
  }, [toast, toastId, tone]);
  if (!toast) return null;
  return (
    <Animated.View
      key={toastId}
      entering={reduced ? undefined : FadeIn.duration(tokens.motion.fast)}
      exiting={reduced ? undefined : FadeOut.duration(120)}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        position: "absolute",
        bottom: wide
          ? 24 + insets.bottom
          : 20 + bottomTabLayout(insets.bottom).height,
        alignSelf: "center",
        maxWidth: wide ? 520 : "90%",
        flexDirection: "row",
        gap: 10,
        alignItems: "center",
        backgroundColor: tone === "error" ? colors.errorBg : colors.successBg,
        borderWidth: 1,
        borderColor: tone === "error" ? colors.error : colors.success,
        borderRadius: 14,
        padding: 14,
        zIndex: 100,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tone === "error" ? colors.error : colors.success,
        }}
      >
        {tone === "error" ? (
          <AlertCircle size={20} color={colors.surface} />
        ) : (
          <Check size={20} color={colors.surface} />
        )}
      </View>
      <View style={{ flexShrink: 1, gap: 2 }}>
        <Label
          bold
          size={13}
          color={tone === "error" ? colors.error : colors.success}
        >
          {tone === "error" ? "Something needs attention" : "All set"}
        </Label>
        <Label color={colors.text} size={13}>
          {toast}
        </Label>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss notification"
        onPress={() => useApp.setState({ toast: null })}
        style={{
          minWidth: 44,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <X size={18} color={tone === "error" ? colors.error : colors.success} />
      </Pressable>
    </Animated.View>
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
