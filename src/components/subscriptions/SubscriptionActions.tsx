import { useRef, useState } from "react";
import { Platform, View } from "react-native";
import { router, type Href } from "expo-router";
import {
  Ellipsis,
  CircleHelp,
  History,
  Pause,
  Pencil,
  Play,
  ShieldCheck,
  Trash2,
} from "lucide-react-native";
import type { Subscription } from "../../domain/models";
import { today } from "../../domain/renewal";
import {
  changeStatus,
  deleteSubscription,
  readableError,
  useApp,
} from "../../store/app";
import { Button, IconButton, Label, LinkRow } from "../ui/Primitives";
import { PickerSheet } from "../ui/Selection";
import { useTheme } from "../../theme/useTheme";

export function SubscriptionActions({
  subscription: s,
}: {
  subscription: Subscription;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false),
    [confirmation, setConfirmation] = useState<"status" | "delete" | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const running = useRef(false),
    pendingRoute = useRef<Href | null>(null);
  const resume = ["paused", "canceled", "expired"].includes(s.status);
  function navigate(route: Href) {
    setOpen(false);
    if (Platform.OS === "ios") pendingRoute.current = route;
    else router.push(route);
  }
  function close() {
    if (!running.current) {
      setOpen(false);
      setConfirmation(null);
      setError(null);
    }
  }
  async function confirm() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!useApp.getState().data.subscriptions.some((row) => row.id === s.id))
        throw new Error("This record was removed. Reopen your subscriptions.");
      if (confirmation === "delete") await deleteSubscription(s.id);
      else
        await changeStatus(
          s.id,
          resume
            ? s.trialEnd &&
              s.trialEnd >= today(useApp.getState().data.preferences.timezone)
              ? "trial"
              : "active"
            : "paused",
        );
      setOpen(false);
      setConfirmation(null);
    } catch (e) {
      setError(readableError(e));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <IconButton
        icon={Ellipsis}
        label={"Actions for " + s.name}
        onPress={() => {
          setConfirmation(null);
          setError(null);
          setOpen(true);
        }}
      />
      <PickerSheet
        visible={open}
        busy={busy}
        title={
          confirmation === "delete"
            ? "Delete " + s.name + "?"
            : confirmation === "status"
              ? (resume ? "Resume " : "Pause ") + s.name + "?"
              : s.name
        }
        description={
          confirmation ? undefined : "Manage this subscription record."
        }
        onClose={close}
        onDismiss={() => {
          if (pendingRoute.current) {
            const route = pendingRoute.current;
            pendingRoute.current = null;
            router.push(route);
          }
        }}
        footer={
          confirmation ? (
            <View style={{ gap: 10 }}>
              <Button
                loading={busy}
                variant={confirmation === "delete" ? "danger" : "primary"}
                onPress={() => void confirm()}
              >
                {confirmation === "delete"
                  ? "Delete subscription"
                  : resume
                    ? "Resume tracking"
                    : "Pause tracking"}
              </Button>
              <Button disabled={busy} variant="ghost" onPress={close}>
                {confirmation === "delete"
                  ? "Keep subscription"
                  : "Keep current status"}
              </Button>
            </View>
          ) : undefined
        }
      >
        {confirmation ? (
          <View style={{ paddingBottom: 12, gap: 14 }}>
            <Label color={colors.secondary}>
              {confirmation === "delete"
                ? "This removes the record, its recorded price history and future Subloom reminders. It does not cancel billing with your provider."
                : resume
                  ? "This restores the record to recurring estimates and its Subloom reminder schedule."
                  : "This pauses tracking and Subloom reminders. It does not pause or cancel billing with your provider."}
            </Label>
            {error && (
              <Label accessibilityRole="alert" color={colors.error}>
                {error}
              </Label>
            )}
          </View>
        ) : (
          <>
            <LinkRow
              icon={Pencil}
              title="Edit subscription"
              detail="Price, renewal date and details"
              onPress={() =>
                navigate({
                  pathname: "/subscription/edit",
                  params: { id: s.id },
                })
              }
            />
            <LinkRow
              icon={resume ? Play : Pause}
              title={resume ? "Resume tracking" : "Pause tracking"}
              detail={
                resume
                  ? "Restore estimates and reminders"
                  : "Pause Subloom tracking; provider billing continues"
              }
              onPress={() => setConfirmation("status")}
            />
            <LinkRow
              icon={History}
              title="Price history"
              detail="Recorded changes for this subscription"
              onPress={() =>
                navigate({
                  pathname: "/price-history",
                  params: { subscriptionId: s.id },
                })
              }
            />
            <LinkRow
              icon={CircleHelp}
              title="How to cancel"
              detail="Instructions and the service’s official website"
              onPress={() =>
                navigate({
                  pathname: "/subscription/cancel",
                  params: { id: s.id },
                })
              }
            />
            <LinkRow
              icon={ShieldCheck}
              title="Cancellation assistant"
              detail="Provider steps and your confirmation"
              onPress={() =>
                navigate({
                  pathname: "/cancellation",
                  params: { subscriptionId: s.id },
                })
              }
            />
            <View
              style={{
                borderTopWidth: 1,
                borderColor: colors.border,
                marginTop: 8,
                paddingTop: 8,
              }}
            >
              <LinkRow
                icon={Trash2}
                title="Delete subscription"
                detail="Remove this record and future Subloom reminders"
                onPress={() => setConfirmation("delete")}
              />
              <Label color={colors.secondary} size={12}>
                Tracking actions do not change your provider’s billing.
              </Label>
            </View>
          </>
        )}
      </PickerSheet>
    </>
  );
}
