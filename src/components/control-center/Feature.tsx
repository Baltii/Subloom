import { useRef, useState, type ComponentType, type ReactNode } from "react";
import { View } from "react-native";
import { useApp, readableError, notify } from "../../store/app";
import { Button, Label, Page } from "../ui/Primitives";
// Remount drafts on account changes, so input from one owner cannot be saved by another.
export function OwnerFeature({
  component: Component,
}: {
  component: ComponentType;
}) {
  const identity = useApp((s) => s.identity);
  return <Component key={identity} />;
}
export function useFeatureAction() {
  const [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const running = useRef(false);
  return {
    error,
    busy,
    run: async (action: () => Promise<unknown>, successMessage?: string) => {
      if (running.current) return;
      running.current = true;
      const identity = useApp.getState().identity;
      setError(null);
      setBusy(true);
      try {
        await action();
        if (successMessage && useApp.getState().identity === identity)
          notify(successMessage);
      } catch (e) {
        const message = readableError(e);
        setError(message);
        if (useApp.getState().identity === identity) notify(message, "error");
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
  };
}
export function FeaturePage({
  title,
  subtitle,
  children,
  settings,
  error,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  settings: {
    loaded: boolean;
    error: string | null;
    reload: () => Promise<void>;
  };
  error?: string | null;
}) {
  return (
    <Page title={title} subtitle={subtitle} back>
      <View style={{ gap: 20 }}>
        {!settings.loaded && !settings.error ? (
          <Label>Loading saved records…</Label>
        ) : null}
        {settings.error ? (
          <View style={{ gap: 12 }}>
            <Label accessibilityRole="alert">
              {settings.error} Your draft is still here.
            </Label>
            <Button onPress={() => void settings.reload()}>
              Reload saved records
            </Button>
          </View>
        ) : null}
        {error ? <Label accessibilityRole="alert">{error}</Label> : null}
        {children}
      </View>
    </Page>
  );
}
