import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import {
  ArrowLeft,
  ChevronRight,
  KeyRound,
  LockKeyhole,
  type LucideIcon,
} from "lucide-react-native";
import { normalizeRecoveryCode, pinBlockedMessage } from "../../domain/appLock";
import { appLock, useAppLock } from "../../services/appLock";
import { passkeyAvailable } from "../../services/passkeys";
import { useTheme } from "../../theme/useTheme";
import { Brand } from "../ui/Brand";
import { Button, Field, Heading, Label } from "../ui/Primitives";
import { LoadingSkeleton } from "../ui/LoadingSkeleton";
import { PinCodeInput } from "./PinCodeInput";
import { RecoveryCodeNotice } from "./RecoveryCodeNotice";

type Screen = "choice" | "pin" | "passkey" | "help" | "recovery" | "recovered";
function remaining(deadline: number, now: number) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
function duration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function MethodChoice({
  title,
  detail,
  icon: Icon,
  onPress,
  disabled,
  testID,
}: {
  title: string;
  detail: string;
  icon: LucideIcon;
  onPress: () => void;
  disabled?: boolean;
  testID: string;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false),
    [hovered, setHovered] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={detail}
      accessibilityState={{ disabled }}
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        padding: 20,
        minHeight: 88,
        borderRadius: 16,
        backgroundColor: pressed || hovered ? colors.mint : colors.surface,
        borderWidth: 1,
        borderColor: focused ? colors.primary : colors.border,
        opacity: disabled ? 0.6 : 1,
      })}
    >
      <Icon size={23} color={colors.primary} />
      <View style={{ flex: 1, gap: 4 }}>
        <Label bold size={16}>
          {title}
        </Label>
        <Label size={12} color={colors.secondary}>
          {detail}
        </Label>
      </View>
      <ChevronRight size={18} color={colors.secondary} />
    </Pressable>
  );
}

export function LockScreen({
  ready,
  loadError,
}: {
  ready: boolean;
  loadError: string | null;
}) {
  const { colors } = useTheme();
  const config = useAppLock((s) => s.config),
    busy = useAppLock((s) => s.busy);
  const both = Boolean(config.pin && config.passkey);
  const [screen, setScreen] = useState<Screen>(() =>
    both ? "choice" : config.pin ? "pin" : "passkey",
  );
  const [pin, setPin] = useState(""),
    [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null),
    [now, setNow] = useState(() => Date.now());
  const [recovery, setRecovery] = useState(""),
    [newPin, setNewPin] = useState(""),
    [confirmPin, setConfirmPin] = useState("");
  const [newRecovery, setNewRecovery] = useState<string | null>(null);
  const running = useRef(false);
  const pinSeconds = remaining(config.retryAt, now),
    recoverySeconds = remaining(config.recoveryRetryAt, now);
  // Configuration arrives after the initial loading screen. Keying the ready
  // screen in the gate ensures its initial method matches the enabled methods.
  useEffect(() => {
    let alive = true;
    void passkeyAvailable()
      .then((value) => {
        if (alive) setSupported(value);
      })
      .catch(() => {
        if (alive) setSupported(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (config.retryAt <= Date.now() && config.recoveryRetryAt <= Date.now())
      return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [config.retryAt, config.recoveryRetryAt]);

  function choose(next: Screen) {
    setScreen(next);
    setError(null);
    setPin("");
    setRecovery("");
    setNewPin("");
    setConfirmPin("");
  }
  function back() {
    choose(both ? "choice" : config.pin ? "pin" : "passkey");
  }
  async function unlock(method: "pin" | "passkey", code = pin) {
    if (running.current || busy || (method === "pin" && pinSeconds > 0)) return;
    running.current = true;
    setError(null);
    try {
      await appLock.unlock(
        method === "pin" ? { pin: code } : { passkey: true },
      );
    } catch (e) {
      setError(
        method === "passkey" &&
          e instanceof Error &&
          ["NotAllowedError", "AbortError"].includes(e.name)
          ? "Passkey verification couldn’t finish. Try again, or choose another way to unlock."
          : e instanceof Error
            ? e.message
            : "We couldn’t unlock your space. Please try again.",
      );
    } finally {
      running.current = false;
      setPin("");
      setNow(Date.now());
    }
  }
  function usePasskey() {
    choose("passkey");
    void unlock("passkey");
  }
  async function resetProtection() {
    if (running.current || busy || recoverySeconds > 0) return;
    if (newPin.length !== 6 || newPin !== confirmPin) {
      setError("Enter the same new PIN in both fields.");
      return;
    }
    running.current = true;
    setError(null);
    try {
      const code = await appLock.recover(recovery, newPin);
      setNewRecovery(code);
      setRecovery("");
      setNewPin("");
      setConfirmPin("");
      setScreen("recovered");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "App protection couldn’t be reset. Please retry.",
      );
    } finally {
      running.current = false;
      setNow(Date.now());
    }
  }

  const title =
    screen === "choice"
      ? "Welcome back."
      : screen === "pin"
        ? pinSeconds > 0
          ? "Let’s pause for a moment."
          : "Your PIN, and you’re in."
        : screen === "passkey"
          ? "Make yourself at home."
          : screen === "help"
            ? "Let’s find a way back."
            : screen === "recovered"
              ? "You’re back in control."
              : "A fresh start, safely.";
  const subtitle =
    screen === "choice"
      ? "Your space is ready. Choose how you’d like to unlock it."
      : screen === "pin"
        ? pinSeconds > 0
          ? both
            ? "You can still unlock your space with your passkey."
            : "A short break helps keep your space safe."
          : "Enter your 6-digit PIN. We’ll unlock automatically."
        : screen === "passkey"
          ? "Use your passkey to unlock your space."
          : screen === "help"
            ? "Try another method, or use the recovery code you saved when setting up protection."
            : screen === "recovered"
              ? "Your new PIN is ready. Your previous PIN, passkey and recovery code have been replaced."
              : "Enter your saved recovery code and choose a new PIN. Your data stays locked until the reset is complete.";
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width: "100%", maxWidth: 410, gap: 32 }}>
          <Brand />
          {!ready ? (
            loadError ? (
              <>
                <Label color={colors.error} accessibilityRole="alert">
                  {loadError}
                </Label>
                <Button onPress={() => void appLock.initialize()}>
                  Retry loading protection
                </Button>
              </>
            ) : (
              <LoadingSkeleton />
            )
          ) : (
            <>
              <View style={{ gap: 10 }}>
                <Heading>{title}</Heading>
                <Label color={colors.secondary}>{subtitle}</Label>
              </View>
              <View style={{ gap: 16 }}>
                {screen === "choice" && (
                  <>
                    <MethodChoice
                      title="Passkey"
                      detail={
                        supported === null
                          ? "Checking your device…"
                          : supported
                            ? "Use your device or password manager"
                            : "Unavailable here. Try your PIN instead."
                      }
                      icon={KeyRound}
                      onPress={usePasskey}
                      disabled={busy || supported !== true}
                      testID="choose-passkey"
                    />
                    <MethodChoice
                      title="PIN code"
                      detail={
                        pinSeconds
                          ? `Available in ${duration(pinSeconds)}`
                          : "Enter your private 6-digit code"
                      }
                      icon={LockKeyhole}
                      onPress={() => choose("pin")}
                      disabled={busy}
                      testID="choose-pin"
                    />
                  </>
                )}
                {screen === "pin" && (
                  <>
                    {pinSeconds > 0 ? (
                      <View
                        style={{
                          gap: 10,
                          padding: 20,
                          borderRadius: 16,
                          backgroundColor: colors.surface,
                        }}
                      >
                        <Label bold accessibilityRole="alert">
                          {pinBlockedMessage(both)}
                        </Label>
                        <Label
                          color={colors.secondary}
                          size={13}
                          accessibilityLiveRegion="none"
                        >
                          PIN will be available in {duration(pinSeconds)}.
                        </Label>
                        {both && (
                          <Button
                            icon={KeyRound}
                            disabled={busy || supported !== true}
                            onPress={usePasskey}
                            testID="pin-blocked-passkey"
                          >
                            Use passkey instead
                          </Button>
                        )}
                      </View>
                    ) : (
                      <>
                        <PinCodeInput
                          value={pin}
                          onChange={(value) => {
                            setPin(value);
                            setError(null);
                          }}
                          onComplete={(value) => void unlock("pin", value)}
                          disabled={busy}
                          invalid={Boolean(error)}
                          autoFocus
                          testID="unlock-pin-input"
                        />
                        {busy && (
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 10,
                              alignItems: "center",
                            }}
                          >
                            <ActivityIndicator color={colors.primary} />
                            <Label color={colors.secondary} size={13}>
                              Checking your PIN…
                            </Label>
                          </View>
                        )}
                      </>
                    )}
                  </>
                )}
                {screen === "passkey" && (
                  <>
                    <Button
                      icon={KeyRound}
                      disabled={busy || supported !== true}
                      loading={busy}
                      onPress={() => void unlock("passkey")}
                      testID="unlock-passkey"
                    >
                      Continue with passkey
                    </Button>
                    {supported === false && (
                      <Label size={13} color={colors.secondary}>
                        Passkeys aren’t supported here. Use your PIN or saved
                        recovery code, or return to a supported browser.
                      </Label>
                    )}
                  </>
                )}
                {screen === "help" && (
                  <>
                    {both && (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onPress={() => choose("choice")}
                      >
                        Try another unlock method
                      </Button>
                    )}
                    {config.recoveryHash ? (
                      <Button
                        disabled={busy}
                        onPress={() => choose("recovery")}
                        testID="use-recovery-code"
                      >
                        Use recovery code
                      </Button>
                    ) : (
                      <Label size={13} color={colors.secondary}>
                        A recovery code wasn’t set up on this device. If you can
                        still unlock with another method, create one in Settings
                        → Security.
                      </Label>
                    )}
                    <View style={{ gap: 8 }}>
                      <Label bold size={13}>
                        Lost every method and your recovery code?
                      </Label>
                      <Label size={13} color={colors.secondary}>
                        For your privacy, support can’t bypass this lock. You
                        can access synced account data by signing in on another
                        device. Unsynced data on this device stays protected.
                      </Label>
                    </View>
                  </>
                )}
                {screen === "recovery" && (
                  <>
                    <Field
                      label="Your saved recovery code"
                      value={recovery}
                      onChangeText={(value) => {
                        setRecovery(value);
                        setError(null);
                      }}
                      autoCapitalize="characters"
                      autoComplete="off"
                      autoCorrect={false}
                      secureTextEntry
                      maxLength={64}
                      editable={!busy && !recoverySeconds}
                      hint="32 characters. You can paste the code with or without dashes."
                    />
                    <PinCodeInput
                      label="New 6-digit PIN"
                      value={newPin}
                      onChange={setNewPin}
                      disabled={busy || recoverySeconds > 0}
                    />
                    <PinCodeInput
                      label="Confirm new PIN"
                      value={confirmPin}
                      onChange={setConfirmPin}
                      disabled={busy || recoverySeconds > 0}
                      invalid={confirmPin.length === 6 && newPin !== confirmPin}
                    />
                    {confirmPin.length === 6 && newPin !== confirmPin && (
                      <Label size={12} color={colors.error}>
                        PINs do not match.
                      </Label>
                    )}
                    <Label size={12} color={colors.secondary}>
                      This replaces your previous PIN and passkey. You’ll
                      receive a new recovery code, then unlock with your new
                      PIN.
                    </Label>
                    {recoverySeconds > 0 && (
                      <Label accessibilityRole="alert" color={colors.error}>
                        Recovery is paused. Try again in{" "}
                        {duration(recoverySeconds)}.
                      </Label>
                    )}
                    <Button
                      loading={busy}
                      disabled={
                        busy ||
                        recoverySeconds > 0 ||
                        normalizeRecoveryCode(recovery).length !== 32 ||
                        newPin.length !== 6 ||
                        newPin !== confirmPin
                      }
                      onPress={() => void resetProtection()}
                      testID="recover-app-lock"
                    >
                      Reset app protection
                    </Button>
                  </>
                )}
                {screen === "recovered" && newRecovery && (
                  <RecoveryCodeNotice
                    code={newRecovery}
                    onDone={() => {
                      setNewRecovery(null);
                      choose("pin");
                    }}
                  />
                )}
                {error && !(screen === "pin" && pinSeconds > 0) && (
                  <Label
                    color={colors.error}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                  >
                    {error}
                  </Label>
                )}
              </View>
              <View style={{ gap: 10 }}>
                {(screen === "pin" || screen === "passkey") && both && (
                  <Button
                    variant="ghost"
                    icon={ArrowLeft}
                    disabled={busy}
                    onPress={() => choose("choice")}
                  >
                    Choose another method
                  </Button>
                )}
                {["help", "recovery"].includes(screen) ? (
                  <Button
                    variant="ghost"
                    icon={ArrowLeft}
                    disabled={busy}
                    onPress={back}
                  >
                    Back to unlocking
                  </Button>
                ) : (
                  screen !== "recovered" && (
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onPress={() => choose("help")}
                      testID="lock-recovery-help"
                    >
                      Can’t unlock?
                    </Button>
                  )
                )}
                {screen === "choice" && (
                  <Label
                    size={12}
                    color={colors.secondary}
                    style={{ textAlign: "center" }}
                  >
                    A little privacy for your recurring world.
                  </Label>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
