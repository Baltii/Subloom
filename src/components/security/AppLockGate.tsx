import { useEffect, useState, type ReactNode } from "react";
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { LockKeyhole, KeyRound } from "lucide-react-native";
import { lockStorageKey } from "../../domain/appLock";
import { appLock, useAppLock } from "../../services/appLock";
import { passkeyAvailable } from "../../services/passkeys";
import { useTheme } from "../../theme/useTheme";
import { Brand } from "../ui/Brand";
import { Button, Heading, Label } from "../ui/Primitives";
import { LoadingSkeleton } from "../ui/LoadingSkeleton";
import { PinField } from "./PinField";

export function AppLockGate({ children }: { children: ReactNode }) {
  const ready = useAppLock((s) => s.ready),
    unlocked = useAppLock((s) => s.unlocked);
  const loadError = useAppLock((s) => s.error);
  useEffect(() => {
    void appLock.initialize();
  }, []);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (next) => {
      if (next !== "active") appLock.lock();
    });
    if (Platform.OS !== "web") return () => listener.remove();
    const hide = () => {
      if (document.visibilityState === "hidden") appLock.lock();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === lockStorageKey || event.key === null)
        void appLock.initialize();
    };
    // Native shells dispatch this when the app deactivates (including minimizing).
    const deactivate = () => appLock.lock();
    const pageHide = () => appLock.lock();
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("storage", storage);
    window.addEventListener("subloom:background", deactivate);
    window.addEventListener("pagehide", pageHide);
    return () => {
      listener.remove();
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("storage", storage);
      window.removeEventListener("subloom:background", deactivate);
      window.removeEventListener("pagehide", pageHide);
    };
  }, []);
  if (ready && unlocked) return children;
  // Protected routes and their native modals never mount before verification.
  return <LockScreen ready={ready} loadError={loadError} />;
}

function LockScreen({
  ready,
  loadError,
}: {
  ready: boolean;
  loadError: string | null;
}) {
  const { colors } = useTheme();
  const config = useAppLock((s) => s.config),
    busy = useAppLock((s) => s.busy);
  const [pin, setPin] = useState(""),
    [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false),
    [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let alive = true;
    void passkeyAvailable()
      .then((value) => {
        if (alive) setSupported(value);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (config.retryAt <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [config.retryAt]);
  const seconds = Math.max(0, Math.ceil((config.retryAt - now) / 1000));
  async function unlock(method: "pin" | "passkey") {
    setError(null);
    try {
      await appLock.unlock(method === "pin" ? { pin } : { passkey: true });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not unlock Subloom. Try again.",
      );
    } finally {
      setPin("");
      setNow(Date.now());
    }
  }
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
        <View style={{ width: "100%", maxWidth: 380, gap: 24 }}>
          <Brand />
          {!ready ? (
            <>
              {loadError ? (
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
              )}
            </>
          ) : (
            <>
              <LockKeyhole size={28} color={colors.primary} />
              <View style={{ gap: 8 }}>
                <Heading>Subloom is locked</Heading>
                <Label color={colors.secondary}>
                  Unlock to view your subscriptions and personal information.
                </Label>
              </View>
              {config.passkey && (
                <Button
                  icon={KeyRound}
                  disabled={busy || !supported}
                  loading={busy}
                  onPress={() => void unlock("passkey")}
                  testID="unlock-passkey"
                >
                  Unlock with passkey
                </Button>
              )}
              {config.passkey && !supported && (
                <Label size={12} color={colors.secondary}>
                  This app build cannot use passkeys. Open the browser where you
                  enabled protection, or use your PIN.
                </Label>
              )}
              {config.pin && (
                <View>
                  <PinField
                    label="Your 6-digit PIN"
                    value={pin}
                    onChange={setPin}
                    disabled={busy || seconds > 0}
                    onSubmit={() => {
                      if (pin.length === 6 && !busy && !seconds)
                        void unlock("pin");
                    }}
                  />
                  <Button
                    disabled={pin.length !== 6 || busy || seconds > 0}
                    loading={busy}
                    onPress={() => void unlock("pin")}
                    testID="unlock-pin"
                  >
                    {seconds > 0
                      ? `Try again in ${seconds}s`
                      : "Unlock with PIN"}
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
              <Label size={12} color={colors.secondary}>
                Forgot your PIN? Use your passkey if enabled. App protection
                stays on until you unlock and disable it in Settings.
              </Label>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
