import { useState } from "react";
import { Linking, View } from "react-native";
import { Download, RefreshCw } from "lucide-react-native";
import { useUpdates } from "../../store/updates";
import { useTheme } from "../../theme/useTheme";
import {
  checkAppUpdates,
  downloadAppUpdate,
  installAppUpdate,
  openUpdateInstallSettings,
} from "../../services/appUpdates";
import { Button, Card, Confirm, Label, SectionTitle } from "../ui/Primitives";

export function AppUpdatesCard() {
  const update = useUpdates(),
    { colors } = useTheme();
  const [confirm, setConfirm] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The update could not finish. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const working =
    busy || ["checking", "downloading", "installing"].includes(update.status);
  const web = update.kind === "web",
    bootstrap = update.kind === "bootstrap";
  const available = update.status === "available",
    ready = update.status === "ready";
  const action = web
    ? "Refresh Subloom"
    : update.kind === "mac"
      ? "Continue update"
      : update.kind === "apk"
        ? "Install update"
        : "Update and restart";
  const detail = web
    ? "Your browser loads the latest Subloom when you refresh."
    : bootstrap
      ? "Install the latest Subloom once to enable updates inside the app. Your saved workspace stays on this device."
      : update.kind === "none"
        ? "This build does not support updates inside the app. Install the latest version from your original download source."
        : update.status === "checking"
          ? "Checking for an update…"
          : update.status === "downloading"
            ? `Downloading the update${update.progress === null ? "…" : ` · ${Math.round(update.progress)}%`}`
            : update.status === "installing"
              ? "Applying the update…"
              : ready
                ? "Your update is ready. Save your changes before continuing."
                : available
                  ? `${update.availableVersion ? `Subloom ${update.availableVersion}` : "A compatible app update"} is available.`
                  : update.status === "current"
                    ? "You’re up to date."
                    : "Subloom checks on launch. You choose when to install.";
  return (
    <Card>
      <SectionTitle title="App updates" />
      <Label size={14} bold>
        Subloom{update.currentVersion ? ` ${update.currentVersion}` : ""}
      </Label>
      <Label
        size={13}
        color={colors.secondary}
        style={{ marginTop: 8, marginBottom: 20 }}
        accessibilityLiveRegion="polite"
      >
        {detail}
      </Label>
      {update.status === "downloading" && update.progress !== null && (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Update download"
          accessibilityValue={{ min: 0, max: 100, now: update.progress }}
          style={{
            height: 4,
            backgroundColor: colors.border,
            borderRadius: 2,
            marginBottom: 20,
          }}
        >
          <View
            style={{
              height: 4,
              width: `${update.progress}%`,
              backgroundColor: colors.primary,
              borderRadius: 2,
            }}
          />
        </View>
      )}
      {(error || update.error) && (
        <Label
          size={13}
          color={colors.error}
          accessibilityLiveRegion="polite"
          style={{ marginBottom: 16 }}
        >
          {error || update.error}
        </Label>
      )}
      <View style={{ alignItems: "flex-start", gap: 12 }}>
        {["checking", "downloading", "installing"].includes(update.status) ? (
          <Button small loading disabled onPress={() => {}}>
            {update.status === "downloading"
              ? `Downloading${update.progress === null ? "…" : ` · ${Math.round(update.progress)}%`}`
              : update.status === "installing"
                ? "Installing…"
                : "Checking for updates…"}
          </Button>
        ) : bootstrap ? (
          <Button
            small
            variant="secondary"
            icon={Download}
            onPress={() =>
              void run(async () => {
                await Linking.openURL(
                  "https://github.com/Baltii/Subloom/releases/latest",
                );
              })
            }
          >
            Get the latest app
          </Button>
        ) : web || ready || (available && update.kind === "mac") ? (
          <Button
            small
            icon={RefreshCw}
            disabled={working}
            onPress={() => setConfirm(true)}
          >
            {action}
          </Button>
        ) : available ? (
          <Button
            small
            icon={Download}
            disabled={working}
            onPress={() => void run(downloadAppUpdate)}
          >
            Download update
          </Button>
        ) : (
          update.supported && (
            <Button
              small
              variant="secondary"
              icon={RefreshCw}
              loading={working}
              disabled={working}
              onPress={() => void run(checkAppUpdates)}
            >
              Check for updates
            </Button>
          )
        )}
        {update.kind === "apk" && ready && (
          <Button
            small
            variant="ghost"
            onPress={() => void run(openUpdateInstallSettings)}
          >
            Allow installation on this device
          </Button>
        )}
      </View>
      {update.kind === "apk" && ready && (
        <Label size={12} color={colors.secondary} style={{ marginTop: 14 }}>
          Android will ask you to confirm installation. If installation is
          blocked, allow Subloom to install updates, then try again.
        </Label>
      )}
      <Confirm
        visible={confirm}
        title={web ? "Refresh Subloom?" : "Apply this update?"}
        body={
          update.kind === "apk"
            ? "Android will open its installation screen. Your saved subscriptions and preferences stay on this device."
            : update.kind === "mac"
              ? "Subloom will open the update window. Save any open changes before continuing; the app may need to restart."
              : "Save any open changes first. Subloom will restart with the update and keep your saved subscriptions and preferences."
        }
        action={action}
        cancelLabel="Later"
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await installAppUpdate();
          setConfirm(false);
        }}
      />
    </Card>
  );
}
