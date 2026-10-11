export function callbackCode(url: string, redirect: string): string {
  const actual = new URL(url),
    expected = new URL(redirect);
  if (
    actual.protocol !== expected.protocol ||
    actual.host !== expected.host ||
    actual.pathname !== expected.pathname ||
    actual.username ||
    actual.password
  )
    throw new Error("Unexpected sign-in callback.");
  if (actual.searchParams.has("error") || actual.hash)
    throw new Error(
      "Sign-in could not finish. Try again from the sign-in screen.",
    );
  const code = actual.searchParams.get("code");
  if (!code || code.length > 2048)
    throw new Error(
      "This sign-in link has no valid authorization code. Start sign-in again.",
    );
  return code;
}
