import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";
import { organizationDomain } from "../domain/sso";
import { callbackCode } from "../domain/oauth";
export function authRedirect() {
  return Platform.OS === "web"
    ? window.location.origin + "/auth-callback"
    : Linking.createURL("auth-callback", { scheme: "subloom" });
}
let finishing: { code: string; promise: Promise<void> } | null = null;
export async function finishSignIn(url: string) {
  if (!supabase)
    throw new Error("Account sign-in needs Supabase configuration.");
  const code = callbackCode(url, authRedirect());
  if (finishing?.code === code) return finishing.promise;
  const promise = (async () => {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error)
      throw new Error(
        "This sign-in link expired or could not be verified. Start sign-in again.",
      );
  })();
  finishing = { code, promise };
  try {
    await promise;
  } catch (e) {
    finishing = null;
    throw e;
  }
}
let starting = false;
export async function openSignIn(url: string) {
  if (Platform.OS === "web") {
    window.location.assign(url);
    return;
  }
  const result = await WebBrowser.openAuthSessionAsync(url, authRedirect());
  if (result.type === "success") await finishSignIn(result.url);
  else if (result.type === "cancel" || result.type === "dismiss")
    throw new Error(
      "Sign-in canceled. You can try again whenever you’re ready.",
    );
}
export async function signInSocial(provider: "google" | "apple") {
  if (!supabase)
    throw new Error("Account sign-in needs Supabase configuration.");
  if (starting) throw new Error("A sign-in is already in progress.");
  starting = true;
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: authRedirect(), skipBrowserRedirect: true },
    });
    if (error || !data.url)
      throw new Error(
        "This provider is unavailable. Check its Supabase configuration or use an email code.",
      );
    await openSignIn(data.url);
  } finally {
    starting = false;
  }
}

export async function signInOrganization(domain: string) {
  if (!supabase)
    throw new Error("Account sign-in needs Supabase configuration.");
  if (starting) throw new Error("A sign-in is already in progress.");
  const validDomain = organizationDomain(domain);
  starting = true;
  try {
    const { data, error } = await supabase.auth.signInWithSSO({
      domain: validDomain,
      options: { redirectTo: authRedirect(), skipBrowserRedirect: true },
    });
    if (error || !data.url)
      throw new Error(
        "Organization SSO is unavailable. Ask your administrator to configure this domain in Supabase.",
      );
    await openSignIn(data.url);
  } finally {
    starting = false;
  }
}
