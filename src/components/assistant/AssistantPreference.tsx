import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { router } from "expo-router";
import { View } from "react-native";
import { localSetting } from "../../services/featureSettings";
import { supabase } from "../../services/supabase";
import { useApp } from "../../store/app";
import { useTheme } from "../../theme/useTheme";
import { Button, Card, Label, SectionTitle } from "../ui/Primitives";
import { ThemedSwitch } from "../ui/ThemedSwitch";

const settingKey = "assistant-chat";
const AssistantPreference = createContext<{
  enabled: boolean;
  busy: boolean;
  available: boolean;
  error: string | null;
  change: (enabled: boolean) => Promise<void>;
}>({
  enabled: false,
  busy: true,
  available: false,
  error: null,
  change: async () => {},
});

export const useAssistantPreference = () => useContext(AssistantPreference);

export function AssistantPreferenceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const identity = useApp((state) => state.identity);
  return (
    <AssistantWorkspace key={identity} identity={identity}>
      {children}
    </AssistantWorkspace>
  );
}

function AssistantWorkspace({
  identity,
  children,
}: {
  identity: string;
  children: ReactNode;
}) {
  const demo = useApp((state) => state.data.demo);
  const hydrated = useApp((state) => state.hydrated);
  const available =
    hydrated && !demo && (identity === "guest" || Boolean(supabase));
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const busy = available && (!loaded || saving);
  const [error, setError] = useState<string | null>(null);
  const writing = useRef(false);

  useEffect(() => {
    if (!available) return;
    let active = true;
    void localSetting(identity, settingKey)
      .then((stored) => {
        if (active) setEnabled(stored === null || stored === "true");
      })
      .catch(() => {
        if (active) setError("Couldn’t load this setting.");
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [available, identity]);

  async function change(value: boolean) {
    if (!available || busy || writing.current) return;
    writing.current = true;
    setSaving(true);
    setError(null);
    try {
      await localSetting(identity, settingKey, JSON.stringify(value));
      setEnabled(value);
    } catch {
      setError("Couldn’t save this setting. Try again.");
    } finally {
      writing.current = false;
      setSaving(false);
    }
  }
  return (
    <AssistantPreference.Provider
      value={{
        enabled: available && loaded && enabled,
        available,
        busy,
        error,
        change,
      }}
    >
      {children}
    </AssistantPreference.Provider>
  );
}

export function AssistantSettings() {
  const { colors } = useTheme();
  const identity = useApp((state) => state.identity);
  const demo = useApp((state) => state.data.demo);
  const { enabled, available, busy, error, change } = useAssistantPreference();
  return (
    <Card style={{ gap: 15 }}>
      <SectionTitle title="AI assistant" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Label bold>Show chat bubble</Label>
          <Label size={13} color={colors.secondary}>
            Ask about subscriptions or make quick changes. This setting applies
            on this device.
          </Label>
        </View>
        <ThemedSwitch
          testID="preference-ai-assistant"
          accessibilityLabel="Show AI chat bubble"
          disabled={!available || busy}
          value={enabled}
          onValueChange={(value) => void change(value)}
        />
      </View>
      <Label size={12} color={colors.secondary}>
        {demo
          ? "Leave the sample workspace to use AI chat."
          : identity === "guest"
            ? "Quick actions run on this device and use this local workspace."
            : !supabase
              ? "Cloud chat is unavailable in this build."
              : "Groq interprets your typed messages and may retain them for reliability or abuse monitoring. Subloom looks up saved records in your current workspace."}
      </Label>
      {identity === "guest" && !demo && supabase && (
        <Button variant="secondary" small onPress={() => router.push("/auth")}>
          Connect an account
        </Button>
      )}
      {error && (
        <Label size={12} color={colors.error} accessibilityRole="alert">
          {error}
        </Label>
      )}
    </Card>
  );
}
