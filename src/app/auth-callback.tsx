import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { finishSignIn } from "../services/oauth";
import { readableError } from "../store/app";
import { Button, Card, Label, Page } from "../components/ui/Primitives";
export default function AuthCallback() {
  const url = Linking.useLinkingURL();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const callback = Platform.OS === "web" ? window.location.href : url;
    if (!callback) return;
    void finishSignIn(callback)
      .then(() => {
        if (alive) router.replace("/auth");
      })
      .catch((e) => {
        if (alive) setError(readableError(e));
      });
    return () => {
      alive = false;
    };
  }, [url]);
  return (
    <Page
      title="Connecting your account"
      subtitle="Your guest data stays on this device until you choose to import it."
    >
      <Card>
        <Label accessibilityRole={error ? "alert" : undefined}>
          {error || "Verifying your sign-in…"}
        </Label>
        {error ? (
          <Button onPress={() => router.replace("/auth")}>
            Back to sign-in
          </Button>
        ) : null}
      </Card>
    </Page>
  );
}
