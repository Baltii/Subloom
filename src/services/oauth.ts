import { openAuthBrowser, authBrowserRedirect } from "./authBrowser";
import { supabase } from "./supabase";
import { organizationDomain } from "../domain/sso";
import { callbackCode } from "../domain/oauth";
export function authRedirect() {
  return authBrowserRedirect("auth-callback");
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
  const callback = await openAuthBrowser(url, authRedirect());
  if (callback) await finishSignIn(callback);
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
