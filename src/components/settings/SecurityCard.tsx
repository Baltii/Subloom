import { useEffect, useState } from "react";
import { View } from "react-native";
import { KeyRound, LockKeyhole } from "lucide-react-native";
import { appLock, useAppLock } from "../../services/appLock";
import { hasAppLock } from "../../domain/appLock";
import { type LockProof } from "../../domain/appLockController";
import { passkeyAvailable } from "../../services/passkeys";
import { useTheme } from "../../theme/useTheme";
import { useApp } from "../../store/app";
import { Button, Card, Label, SectionTitle } from "../ui/Primitives";
import { ThemedSwitch } from "../ui/ThemedSwitch";
import { PinCodeInput } from "../security/PinCodeInput";
import { RecoveryCodeNotice } from "../security/RecoveryCodeNotice";

type Action =
  | "enable-pin"
  | "change-pin"
  | "disable-pin"
  | "enable-passkey"
  | "disable-passkey"
  | "recovery-code";
const titles: Record<Action, string> = {
  "enable-pin": "Set up your PIN",
  "change-pin": "Change your PIN",
  "disable-pin": "Disable PIN protection",
  "enable-passkey": "Enable passkey protection",
  "disable-passkey": "Disable passkey protection",
  "recovery-code": "Save a new recovery code",
};
export function SecurityCard() {
  const { colors } = useTheme();
  const config = useAppLock((s) => s.config),
    busy = useAppLock((s) => s.busy);
  const demo = useApp((s) => s.data.demo);
  const [supported, setSupported] = useState(false),
    [checking, setChecking] = useState(true);
  const [action, setAction] = useState<Action | null>(null);
  const [current, setCurrent] = useState(""),
    [pin, setPin] = useState(""),
    [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null),
    [success, setSuccess] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void passkeyAvailable()
      .then((value) => {
        if (alive) setSupported(value);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setChecking(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  function begin(next: Action | null) {
    setAction(next);
    setCurrent("");
    setPin("");
    setConfirm("");
    setError(null);
    setSuccess(null);
  }
  const settingPin = action === "enable-pin" || action === "change-pin";
  const protectedApp = hasAppLock(config);
  const formValid = !settingPin || (pin.length === 6 && pin === confirm);
  async function submit(method: "pin" | "passkey") {
    if (!action || busy) return;
    setError(null);
    setSuccess(null);
    if (settingPin && (pin.length !== 6 || pin !== confirm)) {
      setError("Enter the same 6-digit PIN in both fields.");
      return;
    }
    const proof: LockProof | undefined = !protectedApp
      ? undefined
      : method === "passkey"
        ? { passkey: true }
        : { pin: current };
    try {
      let code: string | null;
      if (action === "recovery-code")
        code = await appLock.replaceRecoveryCode(proof!);
      else if (settingPin) code = await appLock.setPin(pin, proof);
      else if (action === "disable-pin")
        code = await appLock.setPin(null, proof);
      else code = await appLock.setPasskey(action === "enable-passkey", proof);
      begin(null);
      setRecoveryCode(code);
      setSuccess(
        action === "disable-pin"
          ? "PIN protection disabled."
          : action === "disable-passkey"
            ? "Passkey protection disabled. You can also remove the saved passkey from your password manager."
            : "App protection saved for this device.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not update app protection. Try again.",
      );
      setCurrent("");
    }
  }
  return (
    <Card style={{ marginTop: 24 }}>
      <SectionTitle title="App protection" />
      <Label color={colors.secondary} size={13}>
        Lock Subloom when it opens or returns from the background. Applies to
        this device.
      </Label>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 15,
          paddingVertical: 18,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Label bold>PIN code</Label>
          <Label size={12} color={colors.secondary}>
            Use a private 6-digit code to unlock the app.
          </Label>
        </View>
        <ThemedSwitch
          accessibilityLabel="PIN code protection"
          testID="security-pin-toggle"
          value={Boolean(config.pin)}
          disabled={busy || demo || Boolean(action) || Boolean(recoveryCode)}
          onValueChange={(enabled) =>
            begin(enabled ? "enable-pin" : "disable-pin")
          }
        />
      </View>
      {config.pin && !action && !recoveryCode && (
        <Button
          variant="ghost"
          small
          disabled={busy || demo}
          onPress={() => begin("change-pin")}
        >
          Change PIN
        </Button>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 15,
          paddingVertical: 18,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Label bold>Passkey</Label>
          <Label size={12} color={colors.secondary}>
            {checking
              ? "Checking passkey support…"
              : supported
                ? "Unlock with your device or password manager."
                : "Not available on this device. Use a PIN instead."}
          </Label>
        </View>
        <ThemedSwitch
          accessibilityLabel="Passkey protection"
          testID="security-passkey-toggle"
          value={Boolean(config.passkey)}
          disabled={
            busy ||
            demo ||
            checking ||
            (!supported && !config.passkey) ||
            Boolean(action) ||
            Boolean(recoveryCode)
          }
          onValueChange={(enabled) =>
            begin(enabled ? "enable-passkey" : "disable-passkey")
          }
        />
      </View>
      {action && (
        <View
          style={{
            gap: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: 20,
          }}
        >
          <Label bold>{titles[action]}</Label>
          {action.startsWith("disable") && (
            <Label size={13} color={colors.secondary}>
              {(action === "disable-pin" && !config.passkey) ||
              (action === "disable-passkey" && !config.pin)
                ? "This turns off app protection. Subloom will open without verification."
                : "Your other enabled method will continue protecting the app."}
            </Label>
          )}
          {settingPin && (
            <>
              <PinCodeInput
                label="New 6-digit PIN"
                value={pin}
                onChange={setPin}
                disabled={busy}
              />
              <PinCodeInput
                label="Confirm new PIN"
                invalid={confirm.length === 6 && pin !== confirm}
                value={confirm}
                onChange={setConfirm}
                disabled={busy}
              />
              {confirm.length === 6 && pin !== confirm && (
                <Label size={12} color={colors.error}>
                  PINs do not match.
                </Label>
              )}
              <Label size={12} color={colors.secondary}>
                Keep this PIN somewhere safe. Your recovery code can help if you
                forget it.
              </Label>
            </>
          )}
          {action === "enable-passkey" && (
            <Label size={13} color={colors.secondary}>
              Your device will create a passkey and ask you to verify it. Keep
              PIN protection enabled as a backup.
            </Label>
          )}
          {(settingPin || action === "enable-passkey") &&
            !config.recoveryHash && (
              <Label size={12} color={colors.secondary}>
                We’ll give you a recovery code after setup. Save it so you can
                reset protection if you lose your unlock methods. Without any
                working method or your recovery code, local data can’t be
                recovered.
              </Label>
            )}
          {action === "recovery-code" && (
            <Label size={13} color={colors.secondary}>
              {config.recoveryHash
                ? "Your current recovery code will stop working. Verify your PIN or passkey, then save the new code somewhere safe."
                : "Verify your PIN or passkey to create a recovery code. It lets you set a new PIN if you ever lose access."}
            </Label>
          )}
          {protectedApp && config.pin && (
            <PinCodeInput
              label="Current PIN"
              value={current}
              onChange={setCurrent}
              disabled={busy}
            />
          )}
          {(!protectedApp || config.pin) && (
            <Button
              loading={busy}
              disabled={
                busy || !formValid || (protectedApp && current.length !== 6)
              }
              onPress={() => void submit("pin")}
              testID="security-save"
            >
              {protectedApp ? "Verify PIN and save" : "Enable protection"}
            </Button>
          )}
          {protectedApp && config.passkey && supported && (
            <Button
              icon={KeyRound}
              variant="secondary"
              loading={busy}
              disabled={busy || !formValid}
              onPress={() => void submit("passkey")}
            >
              Verify passkey and save
            </Button>
          )}
          <Button variant="ghost" disabled={busy} onPress={() => begin(null)}>
            Cancel
          </Button>
        </View>
      )}
      {error && (
        <Label
          color={colors.error}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Label>
      )}
      {success && (
        <Label color={colors.primary} accessibilityLiveRegion="polite">
          {success}
        </Label>
      )}
      {recoveryCode && (
        <View style={{ marginTop: 20 }}>
          <RecoveryCodeNotice
            code={recoveryCode}
            onDone={() => setRecoveryCode(null)}
          />
        </View>
      )}
      {!action && protectedApp && !recoveryCode && (
        <View style={{ gap: 12, marginTop: 12 }}>
          <View
            style={{
              gap: 6,
              paddingTop: 16,
              marginBottom: 8,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Label bold>Recovery code</Label>
            <Label size={12} color={colors.secondary}>
              {config.recoveryHash
                ? "Your backup is ready. If you lose your PIN and passkey, use your saved code to set a new PIN."
                : "Set up a way back in. Save a recovery code before you need it."}
            </Label>
            <Button
              variant="secondary"
              disabled={busy || demo}
              onPress={() => begin("recovery-code")}
              testID="security-recovery-code"
            >
              {config.recoveryHash
                ? "Replace recovery code"
                : "Set up recovery code"}
            </Button>
          </View>
          <Label size={12} color={colors.secondary}>
            {config.pin && config.passkey
              ? "Either your PIN or passkey can unlock Subloom."
              : "Protection is enabled. You’ll be asked to unlock when you reopen the app."}
          </Label>
          <Label size={12} color={colors.secondary}>
            Locking closes open forms. Save any changes before leaving the app.
          </Label>
          <Button
            variant="secondary"
            icon={LockKeyhole}
            disabled={busy}
            onPress={() => appLock.lock()}
            testID="security-lock-now"
          >
            Lock now
          </Button>
        </View>
      )}
      {demo && (
        <Label size={12} color={colors.secondary}>
          Leave demo mode to manage app protection.
        </Label>
      )}
    </Card>
  );
}
