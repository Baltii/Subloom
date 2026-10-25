import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUpdates } from "../../store/updates";
import { useTheme } from "../../theme/useTheme";
import { downloadAppUpdate, installAppUpdate } from "../../services/appUpdates";
import { Button, Label } from "../ui/Primitives";

export function UpdateNotice() {
  const update = useUpdates();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = `${update.kind}:${update.availableVersion || "compatible"}`;
  const downloading = update.status === "downloading";
  const installing = update.status === "installing";
  if (
    !update.supported ||
    dismissed === key ||
    (!["available", "ready", "downloading", "installing"].includes(
      update.status,
    ) &&
      !error)
  )
    return null;

  async function apply() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (
        update.status === "available" &&
        !["mac", "web"].includes(update.kind)
      ) {
        await downloadAppUpdate();
        const state = useUpdates.getState();
        if (state.status !== "ready")
          throw new Error(
            state.error ||
              "The download could not finish. Try again in Settings → App updates.",
          );
      }
      await installAppUpdate();
      if (update.kind === "mac") setDismissed(key);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The update could not finish. Try again in Settings → App updates.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: Math.max(insets.bottom, 16) + 64,
        alignItems: "center",
      }}
    >
      <View
        testID="update-notice"
        style={{
          width: "100%",
          maxWidth: 440,
          padding: 20,
          gap: 12,
          borderRadius: 16,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Label bold accessibilityLiveRegion="polite">
          {downloading
            ? "Downloading your update…"
            : installing
              ? "Installing your update…"
              : `Subloom${update.availableVersion ? ` ${update.availableVersion}` : " update"} is ready`}
        </Label>
        <Label size={13} color={colors.secondary}>
          {downloading
            ? update.progress === null
              ? "You can keep using Subloom while it downloads."
              : `${Math.round(update.progress)}% downloaded`
            : "Update now or keep going and do it later."}
        </Label>
        {error && (
          <Label accessibilityRole="alert" size={13} color={colors.error}>
            {error}
          </Label>
        )}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Button
            small
            loading={busy || downloading || installing}
            disabled={busy || downloading || installing}
            onPress={() => void apply()}
          >
            {downloading
              ? "Downloading…"
              : installing
                ? "Installing…"
                : "Update now"}
          </Button>
          <Button
            small
            variant="ghost"
            onPress={() => {
              setDismissed(key);
              setError(null);
            }}
          >
            Later
          </Button>
        </View>
      </View>
    </View>
  );
}
