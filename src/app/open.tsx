import { useEffect, useState } from "react";
import { Linking, Platform, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowRight, Smartphone } from "lucide-react-native";
import { Brand } from "../components/ui/Brand";
import {
  Button,
  Card,
  Heading,
  Label,
  Page,
} from "../components/ui/Primitives";
import { FinancialArt } from "../components/ui/FinancialArt";
import { notificationAppUrl, notificationPath } from "../domain/appLinks";
import {
  clearNotificationPath,
  rememberNotificationPath,
} from "../services/notificationLinks";
import { macosBridge } from "../services/macosBridge";
import { windowsBridge } from "../services/windowsBridge";
import { syncNow } from "../services/sync";
import { readableError, useApp } from "../store/app";

export default function OpenNotification() {
  const params = useLocalSearchParams<{ path?: string }>();
  const path = notificationPath(params.path) ?? "/";
  const identity = useApp((s) => s.identity);
  const localSubscription = useApp((s) =>
    s.data.subscriptions.some(
      (subscription) => path === `/subscription/${subscription.id}`,
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const installed =
    Platform.OS !== "web" || Boolean(macosBridge() || windowsBridge());
  useEffect(() => {
    rememberNotificationPath(path);
    if (!installed) return;
    let alive = true;
    void (identity === "guest" ? Promise.resolve() : syncNow())
      .then(() => {
        if (
          alive &&
          (identity !== "guest" ||
            localSubscription ||
            path === "/" ||
            path === "/settings")
        ) {
          clearNotificationPath();
          router.replace(path as "/");
        }
      })
      .catch((e) => {
        if (alive) setError(readableError(e));
      });
    return () => {
      alive = false;
    };
  }, [path, installed, identity, localSubscription]);
  async function continueHere() {
    setBusy(true);
    setError(null);
    try {
      if (identity !== "guest") await syncNow();
      clearNotificationPath();
      router.replace(path as "/");
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title="Open Subloom" contentMaxWidth={680}>
      <Card style={{ gap: 22 }}>
        <Brand />
        <View style={{ alignItems: "center" }}>
          <FinancialArt kind="renewals" size={150} />
        </View>
        <Heading size={22}>Your update is ready.</Heading>
        <Label>
          Open this update in the app or continue here in your browser. Your
          link takes you to the same place.
        </Label>
        {error ? <Label accessibilityRole="alert">{error}</Label> : null}
        {!installed ? (
          <Button
            icon={Smartphone}
            onPress={() =>
              void Linking.openURL(notificationAppUrl(path)).catch(() =>
                setError(
                  "The app could not open. You can continue in your browser below.",
                ),
              )
            }
          >
            Open in the app
          </Button>
        ) : null}
        {identity === "guest" && !localSubscription && path !== "/settings" ? (
          <>
            <Label>
              Sign in with the account that received this email to see your
              synced subscriptions.
            </Label>
            <Button
              icon={ArrowRight}
              onPress={() => {
                rememberNotificationPath(path);
                router.push("/auth");
              }}
            >
              Sign in to continue
            </Button>
          </>
        ) : null}
        <Button
          variant="secondary"
          icon={ArrowRight}
          loading={busy}
          onPress={() => void continueHere()}
        >
          {installed ? "Continue in Subloom" : "Continue in browser"}
        </Button>
      </Card>
    </Page>
  );
}
