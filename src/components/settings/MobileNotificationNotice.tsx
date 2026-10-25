import { useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform, View } from "react-native";
import { useApp, updatePreferences, readableError } from "../../store/app";
import { registerPush } from "../../services/notifications";
import { useTheme } from "../../theme/useTheme";
import { Button, Label } from "../ui/Primitives";

/** Recheck OS permission on launch and after returning from device settings. */
export function MobileNotificationNotice() {
  const identity = useApp((s) => s.identity);
  return <PermissionNotice key={identity} identity={identity} />;
}

async function enableDelivery(identity: string) {
  if (identity === "guest" || useApp.getState().identity !== identity) return;
  await registerPush(false);
  if (useApp.getState().identity === identity)
    await updatePreferences({ pushEnabled: true });
}

function PermissionNotice({ identity }: { identity: string }) {
  const demo = useApp((s) => s.data.demo);
  const returningFromSettings = useRef(false);
  const { colors } = useTheme();
  const [permission, setPermission] = useState<{
    granted: boolean;
    canAskAgain: boolean;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;
    let alive = true;
    const check = async () => {
      try {
        const notifications = await import("expo-notifications");
        const result = await notifications.getPermissionsAsync();
        if (!alive) return;
        setPermission(result);
        if (result.granted && returningFromSettings.current) {
          returningFromSettings.current = false;
          setBusy(true);
          try {
            await enableDelivery(identity);
          } catch (e) {
            if (alive) setError(readableError(e));
          } finally {
            if (alive) setBusy(false);
          }
        }
      } catch {
        /* Permission can be enabled later in reminder settings. */
      }
    };
    void check();
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    return () => {
      alive = false;
      listener.remove();
    };
  }, [identity]);
  if (!permission || (permission.granted && !error) || dismissed || demo)
    return null;
  return (
    <View
      style={{
        padding: 16,
        gap: 10,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Label size={13}>
        {permission.granted
          ? "Notification registration needs attention."
          : "Turn on notifications to receive subscription reminders."}
      </Label>
      {error && (
        <Label accessibilityRole="alert" color={colors.error} size={12}>
          {error}
        </Label>
      )}
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Button
          small
          loading={busy}
          disabled={busy}
          onPress={() => {
            setBusy(true);
            setError(null);
            void (async () => {
              if (permission.granted) {
                await enableDelivery(identity);
                return;
              }
              if (!permission.canAskAgain) {
                returningFromSettings.current = true;
                await Linking.openSettings();
                return;
              }
              const notifications = await import("expo-notifications");
              if (Platform.OS === "android")
                await notifications.setNotificationChannelAsync("renewals", {
                  name: "Subscription reminders",
                  importance: notifications.AndroidImportance.DEFAULT,
                });
              const result = await notifications.requestPermissionsAsync();
              setPermission(result);
              if (result.granted) await enableDelivery(identity);
            })()
              .catch((e) => setError(readableError(e)))
              .finally(() => setBusy(false));
          }}
        >
          {permission.granted
            ? "Retry registration"
            : permission.canAskAgain
              ? "Enable notifications"
              : "Open device settings"}
        </Button>
        <Button small variant="ghost" onPress={() => setDismissed(true)}>
          Later
        </Button>
      </View>
    </View>
  );
}
