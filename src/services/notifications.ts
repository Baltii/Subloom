import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { supabase } from "./supabase";
export function safeNotificationPath(path: unknown): string | null {
  return typeof path === "string" &&
    /^\/(subscription|detection)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      path,
    )
    ? path
    : null;
}
export function installNotificationNavigation(
  navigate: (path: string) => void,
): () => void {
  let disposed = false,
    cleanup: (() => void) | undefined;
  void import("expo-notifications")
    .then(async (notifications) => {
      if (disposed) return;
      notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      const handle = (
        response: import("expo-notifications").NotificationResponse,
      ) => {
        const path = safeNotificationPath(
          response.notification.request.content.data?.path,
        );
        if (path) navigate(path);
      };
      const listener =
        notifications.addNotificationResponseReceivedListener(handle);
      cleanup = () => listener.remove();
      const last = await notifications.getLastNotificationResponseAsync();
      if (last && !disposed) {
        handle(last);
        await notifications.clearLastNotificationResponseAsync();
      }
    })
    .catch(() => {});
  return () => {
    disposed = true;
    cleanup?.();
  };
}
export async function registerPush(): Promise<void> {
  if (Platform.OS === "web")
    throw new Error(
      "Native push reminders are available in the iOS and Android apps. You can enable email reminders here.",
    );
  if (!supabase)
    throw new Error(
      "Connect the Supabase backend and sign in to enable reminders.",
    );
  const { data } = await supabase.auth.getUser();
  if (!data.user)
    throw new Error(
      "Sign in first so reminders can run even when the app is closed.",
    );
  const projectId =
    Constants.easConfig?.projectId ||
    (Constants.expoConfig?.extra?.eas?.projectId as string | undefined);
  if (!projectId)
    throw new Error(
      "An EAS project and development build are required before push can be enabled.",
    );
  const notifications = await import("expo-notifications");
  if (Platform.OS === "android")
    await notifications.setNotificationChannelAsync("renewals", {
      name: "Subscription reminders",
      importance: notifications.AndroidImportance.DEFAULT,
    });
  let permission = await notifications.getPermissionsAsync();
  if (!permission.granted)
    permission = await notifications.requestPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "Notification access is off. You can allow it in your device settings or use email reminders.",
    );
  const token = (await notifications.getExpoPushTokenAsync({ projectId })).data;
  let installation = await SecureStore.getItemAsync("subloom.installation");
  if (!installation) {
    installation = Crypto.randomUUID();
    await SecureStore.setItemAsync("subloom.installation", installation);
  }
  const { error } = await supabase.from("push_devices").upsert({
    id: installation,
    user_id: data.user.id,
    token,
    platform: Platform.OS,
    enabled: true,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}
export async function disableDevice() {
  if (!supabase || Platform.OS === "web") return;
  const id = await SecureStore.getItemAsync("subloom.installation");
  if (id) {
    const { error } = await supabase
      .from("push_devices")
      .update({ enabled: false })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }
}
