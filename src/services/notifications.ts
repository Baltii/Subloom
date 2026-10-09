import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { accountClient, supabase } from "./supabase";
import { useApp } from "../store/app";

export function safeNotificationPath(path: unknown): string | null {
  return typeof path === "string" &&
    (path === "/settings" ||
      path === "/" ||
      /^\/(subscription|detection)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        path,
      ))
    ? path
    : null;
}
export function installNotificationNavigation(
  navigate: (path: string) => void,
): () => void {
  if (Platform.OS === "web") return () => {};
  let disposed = false,
    cleanup: (() => void) | undefined;
  const handled = new Set<string>();
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
        if (disposed) return;
        const id =
          response.notification.request.identifier +
          ":" +
          response.actionIdentifier;
        if (handled.has(id)) return;
        const path = safeNotificationPath(
          response.notification.request.content.data?.path,
        );
        if (path) {
          handled.add(id);
          navigate(path);
        }
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
const installationKey = (identity: string) =>
  "subloom.installation." + identity;
const consentKey = (identity: string) => "subloom.push-consent." + identity;
function sameAccount(identity: string) {
  return useApp.getState().identity === identity && useApp.getState().hydrated;
}
async function installationId(identity: string) {
  const key = installationKey(identity);
  let id = await SecureStore.getItemAsync(key);
  if (!id) {
    id = Crypto.randomUUID();
    await SecureStore.setItemAsync(key, id);
  }
  return id;
}
function mobileOnly() {
  if (Platform.OS !== "ios" && Platform.OS !== "android")
    throw new Error(
      "Push is available in the iOS and Android apps. Mac notifications are not enabled.",
    );
}
export async function registerPush(requestPermission = true): Promise<void> {
  mobileOnly();
  const identity = useApp.getState().identity;
  const client = await accountClient(identity);
  const notifications = await import("expo-notifications");
  const projectId =
    Constants.easConfig?.projectId ||
    (Constants.expoConfig?.extra?.eas?.projectId as string | undefined);
  if (!projectId)
    throw new Error(
      "An EAS project and native build are required before push can be enabled.",
    );
  if (Platform.OS === "android")
    await notifications.setNotificationChannelAsync("renewals", {
      name: "Subscription reminders",
      importance: notifications.AndroidImportance.DEFAULT,
    });
  let permission = await notifications.getPermissionsAsync();
  if (!permission.granted && requestPermission && permission.canAskAgain)
    permission = await notifications.requestPermissionsAsync();
  if (!permission.granted) {
    await disableDevice(false, identity);
    throw new Error(
      "Notification access is off. Allow it in device settings, then enable this device again.",
    );
  }
  const token = (await notifications.getExpoPushTokenAsync({ projectId })).data;
  const id = await installationId(identity);
  if (!sameAccount(identity))
    throw new Error(
      "Your account changed. Enable push again in the current account.",
    );
  const { error } = await client.rpc("register_push_device", {
    installation_id: id,
    device_token: token,
    device_platform: Platform.OS,
  });
  if (error)
    throw new Error(
      "Could not register this device. Check your connection and retry.",
    );
  // If sign-out raced registration, revoke only the old account's installation using its bound client.
  if (!sameAccount(identity)) {
    await client.rpc("disable_push_device", { installation_id: id });
    return;
  }
  await SecureStore.setItemAsync(consentKey(identity), "enabled");
  if (!sameAccount(identity)) {
    await SecureStore.deleteItemAsync(consentKey(identity));
    await client.rpc("disable_push_device", { installation_id: id });
    return;
  }
  useApp.setState({ pushError: null, pushDeviceEnabled: true });
}
export async function disableDevice(
  forget = true,
  identity = useApp.getState().identity,
) {
  if (!supabase || Platform.OS === "web" || identity === "guest") return;
  const client = await accountClient(identity);
  const id =
    (await SecureStore.getItemAsync(installationKey(identity))) ||
    (await SecureStore.getItemAsync("subloom.installation"));
  if (id) {
    const { error } = await client.rpc("disable_push_device", {
      installation_id: id,
    });
    if (error)
      throw new Error(
        "Could not disable this device. Retry before signing out.",
      );
  }
  if (forget) await SecureStore.deleteItemAsync(consentKey(identity));
  if (sameAccount(identity))
    useApp.setState({ pushDeviceEnabled: false, pushError: null });
}
export async function devicePushEnabled() {
  if (Platform.OS === "web" || useApp.getState().identity === "guest")
    return false;
  const identity = useApp.getState().identity;
  if ((await SecureStore.getItemAsync(consentKey(identity))) !== "enabled")
    return false;
  const notifications = await import("expo-notifications");
  if (!(await notifications.getPermissionsAsync()).granted) return false;
  const id = await SecureStore.getItemAsync(installationKey(identity));
  if (!id) return false;
  const client = await accountClient(identity);
  const { data, error } = await client
    .from("push_devices")
    .select("enabled")
    .eq("user_id", identity)
    .eq("id", id)
    .maybeSingle();
  if (error)
    throw new Error("Could not check this device's push registration.");
  return Boolean(data?.enabled);
}
export function maintainPushRegistration(identity: string): () => void {
  if (Platform.OS === "web") return () => {};
  let disposed = false,
    active = false,
    queued = false;
  let removeToken: (() => void) | undefined;
  const refresh = async () => {
    if (disposed || !sameAccount(identity)) return;
    if (active) {
      queued = true;
      return;
    }
    active = true;
    try {
      const consent = await SecureStore.getItemAsync(consentKey(identity));
      if (disposed || !sameAccount(identity)) return;
      if (consent !== "enabled") {
        useApp.setState({ pushDeviceEnabled: false });
        return;
      }
      if (useApp.getState().data.preferences.pushEnabled)
        await registerPush(false);
      else await disableDevice(false, identity);
    } catch (error) {
      if (!disposed && sameAccount(identity))
        useApp.setState({
          pushError:
            error instanceof Error
              ? error.message
              : "Device registration needs attention.",
        });
    } finally {
      active = false;
      if (queued && !disposed) {
        queued = false;
        void refresh();
      }
    }
  };
  void import("expo-notifications")
    .then((notifications) => {
      if (disposed) return;
      // This listener supplies native APNs/FCM tokens; re-fetch the Expo token instead of storing them.
      const listener = notifications.addPushTokenListener(() => {
        void refresh();
      });
      removeToken = () => listener.remove();
      void refresh();
    })
    .catch(() => {});
  const foreground = AppState.addEventListener("change", (state) => {
    if (state === "active") void refresh();
  });
  return () => {
    disposed = true;
    foreground.remove();
    removeToken?.();
  };
}
export async function sendTestPush() {
  mobileOnly();
  const identity = useApp.getState().identity;
  if (!(await devicePushEnabled()))
    throw new Error("Enable push on this device first.");
  const client = await accountClient(identity);
  const installation = await SecureStore.getItemAsync(
    installationKey(identity),
  );
  if (!sameAccount(identity))
    throw new Error("Your account changed. Retry in the current account.");
  const { data, error } = await client.functions.invoke("test-push", {
    body: { installationId: installation, requestId: Crypto.randomUUID() },
  });
  if (error || !data?.queued)
    throw new Error(
      "Could not queue the test push. Check your connection and retry.",
    );
}
