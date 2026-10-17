import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { macosBridge, macosRequest } from "./macosBridge";

export function usesNativeAuthBrowser() {
  return Platform.OS !== "web" || Boolean(macosBridge());
}

export function authBrowserRedirect(path: "auth-callback" | "mailboxes") {
  // Expo Linking's web implementation ignores the scheme option. A Mac
  // WebKit shell needs the custom scheme captured by ASWebAuthenticationSession.
  return usesNativeAuthBrowser()
    ? "subloom://" + path
    : window.location.origin + "/" + path;
}

// Keep PKCE exchange in the app that created the verifier. The Mac bridge
// returns the callback from ASWebAuthenticationSession to this same WebKit store.
export async function openAuthBrowser(url: string, redirect: string) {
  if (macosBridge())
    return macosRequest<string>("auth.open", { url, redirect });
  if (Platform.OS === "web") {
    window.location.assign(url);
    return null;
  }
  const result = await WebBrowser.openAuthSessionAsync(url, redirect);
  if (result.type === "success") return result.url;
  throw new Error("Sign-in canceled. You can try again whenever you’re ready.");
}
