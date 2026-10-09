import { useState } from "react";
import { Switch, View } from "react-native";
import { router } from "expo-router";
import {
  Download,
  HelpCircle,
  Mail,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
  LogOut,
  ReceiptText,
} from "lucide-react-native";
import {
  useApp,
  updatePreferences,
  readableError,
  leaveDemo,
  hydrate,
  notify,
} from "../../store/app";
import { currencies } from "../../domain/models";
import { moneyInput, parseMoney } from "../../domain/money";
import { supabase } from "../../services/supabase";
import { disableDevice, registerPush } from "../../services/notifications";
import { exportData } from "../../services/export";
import { removeSnapshot } from "../../services/storage";
import { syncNow, resolveConflict } from "../../services/sync";
import { useTheme, useWide } from "../../theme/useTheme";
import {
  Badge,
  Button,
  Card,
  Chips,
  Confirm,
  Field,
  Label,
  LinkRow,
  Page,
  SectionTitle,
} from "../../components/ui/Primitives";
export default function Settings() {
  const { colors } = useTheme(),
    wide = useWide(),
    state = useApp(),
    p = state.data.preferences;
  const [timezone, setTimezone] = useState(p.timezone),
    [hour, setHour] = useState(String(p.reminderHour)),
    [quietStart, setQuietStart] = useState(String(p.quietStart)),
    [quietEnd, setQuietEnd] = useState(String(p.quietEnd)),
    [threshold, setThreshold] = useState(
      p.highRenewalThresholdMinor === null
        ? ""
        : moneyInput(p.highRenewalThresholdMinor, p.currency),
    ),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false),
    [confirmReset, setConfirmReset] = useState(false);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  function toggle(
    label: string,
    detail: string,
    value: boolean,
    change: (value: boolean) => Promise<void>,
  ) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 15,
          paddingVertical: 13,
        }}
      >
        <View style={{ flex: 1 }}>
          <Label size={13} bold>
            {label}
          </Label>
          <Label size={11} color={colors.secondary}>
            {detail}
          </Label>
        </View>
        <Switch
          testID={
            "preference-" + label.toLowerCase().replace(/[^a-z0-9]/g, "-")
          }
          accessibilityLabel={label}
          value={value}
          onValueChange={(v) => void run(() => change(v))}
          disabled={busy || state.data.demo}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>
    );
  }
  return (
    <Page
      title="Make yourself at home."
      subtitle="Your preferences. Your privacy. Your control."
    >
      <View style={{ flexDirection: wide ? "row" : "column", gap: 24 }}>
        <View style={{ flex: 1 }}>
          <Card>
            <SectionTitle title="Your account" />
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                alignItems: "center",
                marginBottom: 18,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 15,
                  backgroundColor: colors.mint,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <UserRound size={21} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Label bold>{state.email || "Your personal space"}</Label>
                <Label size={11} color={colors.secondary}>
                  {state.identity === "guest"
                    ? "Everything is saved on this device."
                    : "Connected to your Subloom account."}
                </Label>
              </View>
            </View>
            {state.data.demo ? (
              <Button onPress={() => void run(leaveDemo)}>
                Start with my own subscriptions
              </Button>
            ) : state.identity === "guest" ? (
              <Button icon={Mail} onPress={() => router.push("/auth")}>
                Connect an account
              </Button>
            ) : (
              <View style={{ gap: 12 }}>
                <Button
                  variant="secondary"
                  loading={busy}
                  icon={RefreshCw}
                  onPress={() => void run(syncNow)}
                >
                  Sync now
                </Button>
                <Button
                  variant="secondary"
                  onPress={() => router.push("/auth")}
                >
                  Import guest subscriptions
                </Button>
                <Button
                  variant="ghost"
                  icon={LogOut}
                  onPress={() =>
                    void run(async () => {
                      await disableDevice();
                      const { error } = await supabase!.auth.signOut();
                      if (error) throw error;
                      notify(
                        "Signed out. Pending account changes remain saved for your next sign-in.",
                      );
                    })
                  }
                >
                  Sign out
                </Button>
              </View>
            )}
            <Label size={11} color={colors.secondary} style={{ marginTop: 15 }}>
              {state.syncing
                ? "Syncing your changes…"
                : state.data.outbox.length
                  ? state.data.outbox.length +
                    " changes saved locally and waiting to sync."
                  : state.data.lastSyncedAt
                    ? "Last synced " +
                      new Date(state.data.lastSyncedAt).toLocaleString()
                    : "Your data is stored locally."}
            </Label>
            {state.syncError && (
              <View style={{ marginTop: 16, gap: 11 }}>
                <Label color={colors.error} size={12}>
                  {state.syncError}
                </Label>
                {state.syncError.includes("conflict") && (
                  <>
                    <Button
                      variant="secondary"
                      onPress={() => void run(() => resolveConflict("remote"))}
                    >
                      Use cloud version for this subscription
                    </Button>
                    <Button
                      variant="secondary"
                      onPress={() => void run(() => resolveConflict("local"))}
                    >
                      Keep my local version
                    </Button>
                  </>
                )}
              </View>
            )}
          </Card>
          <Card style={{ marginTop: 24 }}>
            <SectionTitle title="A space that feels like you" />
            <Label
              size={12}
              bold
              color={colors.secondary}
              style={{ marginBottom: 12 }}
            >
              Appearance
            </Label>
            <Chips
              values={["system", "light", "dark"] as const}
              selected={p.appearance}
              onChange={(appearance) =>
                void run(() => updatePreferences({ appearance }))
              }
            />
            <Label
              size={12}
              bold
              color={colors.secondary}
              style={{ marginTop: 25, marginBottom: 12 }}
            >
              Preferred currency
            </Label>
            <Chips
              values={currencies}
              selected={p.currency}
              onChange={(currency) =>
                void run(async () => {
                  await updatePreferences({
                    currency,
                    highRenewalThresholdMinor: null,
                  });
                  setThreshold("");
                })
              }
            />
            <Label size={11} color={colors.secondary} style={{ marginTop: 12 }}>
              Original currencies are always preserved. Different currencies are
              shown as separate totals.
            </Label>
            <View style={{ marginTop: 24 }}>
              <Field
                label="Timezone · IANA name"
                value={timezone}
                onChangeText={setTimezone}
                autoCapitalize="none"
              />
              <Button
                variant="secondary"
                small
                loading={busy}
                onPress={() =>
                  void run(async () => {
                    await updatePreferences({ timezone });
                    notify("Timezone saved.");
                  })
                }
              >
                Save timezone
              </Button>
            </View>
          </Card>
          <Card style={{ marginTop: 24 }}>
            <SectionTitle title="Receipts & discovery" />
            <LinkRow
              icon={ReceiptText}
              title="Import a receipt"
              detail="Text receipts and screenshots"
              onPress={() => router.push("/import")}
            />
            <LinkRow
              icon={Mail}
              title="Receipt forwarding"
              detail="Your private address and connected sources"
              onPress={() => router.push("/sources")}
            />
          </Card>
        </View>
        <View style={{ flex: 1 }}>
          <Card>
            <SectionTitle title="A heads-up, your way" />
            {state.identity === "guest" && (
              <Badge tone="neutral">Connect an account for delivery</Badge>
            )}
            {toggle(
              "Push reminders",
              "A timely nudge on your iOS or Android device.",
              p.pushEnabled,
              async (enabled) => {
                if (enabled) await registerPush();
                else await disableDevice();
                await updatePreferences({ pushEnabled: enabled });
              },
            )}
            {toggle(
              "Email reminders",
              "Sent only to your verified account email.",
              p.emailEnabled,
              async (emailEnabled) => {
                if (emailEnabled && state.identity === "guest")
                  throw new Error(
                    "Connect and verify your account email first.",
                  );
                await updatePreferences({ emailEnabled });
              },
            )}
            {toggle(
              "Trial ending reminders",
              "A reminder before a trial turns into a charge.",
              p.trialReminders,
              async (trialReminders) => updatePreferences({ trialReminders }),
            )}
            {toggle(
              "Weekly digest",
              "An optional Monday overview of the week ahead.",
              p.weeklyDigest,
              async (weeklyDigest) => {
                if (
                  weeklyDigest &&
                  (!p.emailEnabled || state.identity === "guest")
                )
                  throw new Error(
                    "Enable verified email reminders before opting into the digest.",
                  );
                await updatePreferences({ weeklyDigest });
              },
            )}
            {toggle(
              "Private lock-screen content",
              "Hide merchant names and prices from push alerts.",
              p.privacyMode,
              async (privacyMode) => updatePreferences({ privacyMode }),
            )}
            <Label
              size={12}
              bold
              color={colors.secondary}
              style={{ marginTop: 18, marginBottom: 11 }}
            >
              Remind me before renewal
            </Label>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {[7, 3, 1, 0].map((day) => (
                <Button
                  key={day}
                  small
                  variant={
                    p.reminderDays.includes(day) ? "primary" : "secondary"
                  }
                  onPress={() =>
                    void run(() =>
                      updatePreferences({
                        reminderDays: p.reminderDays.includes(day)
                          ? p.reminderDays.filter((d) => d !== day)
                          : [...p.reminderDays, day].sort((a, b) => b - a),
                      }),
                    )
                  }
                >
                  {day === 0
                    ? "On the day"
                    : day + (day === 1 ? " day" : " days")}
                </Button>
              ))}
            </View>
            <View style={{ marginTop: 24 }}>
              {
                <Field
                  label="Reminder hour · 0–23, in your timezone"
                  value={hour}
                  onChangeText={setHour}
                  keyboardType="number-pad"
                />
              }
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Quiet hours start · 0–23"
                    value={quietStart}
                    onChangeText={setQuietStart}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Quiet hours end · 0–23"
                    value={quietEnd}
                    onChangeText={setQuietEnd}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
              <Button
                variant="secondary"
                small
                loading={busy}
                onPress={() =>
                  void run(async () => {
                    if (
                      ![hour, quietStart, quietEnd].every((v) =>
                        /^\d{1,2}$/.test(v),
                      )
                    )
                      throw new Error("Enter whole hours from 0 to 23.");
                    await updatePreferences({
                      reminderHour: Number(hour),
                      quietStart: Number(quietStart),
                      quietEnd: Number(quietEnd),
                    });
                    notify("Reminder timing saved.");
                  })
                }
              >
                Save reminder timing
              </Button>
            </View>
            <View style={{ marginTop: 24 }}>
              <Field
                label={"High renewal threshold · " + p.currency + " (optional)"}
                placeholder="Leave blank to disable"
                value={threshold}
                onChangeText={setThreshold}
                keyboardType="decimal-pad"
              />
              <Label size={11} color={colors.secondary}>
                Flag a scheduled charge at or above this price in your
                reminders. Applies only to {p.currency}; no currency conversions
                or extra alerts.
              </Label>
              <View style={{ marginTop: 12 }}>
                <Button
                  small
                  variant="secondary"
                  loading={busy}
                  onPress={() =>
                    void run(async () => {
                      await updatePreferences({
                        highRenewalThresholdMinor: threshold.trim()
                          ? parseMoney(threshold, p.currency)
                          : null,
                      });
                      notify("Renewal threshold saved.");
                    })
                  }
                >
                  Save renewal threshold
                </Button>
              </View>
            </View>
          </Card>
          <Card style={{ marginTop: 24 }}>
            <SectionTitle title="Your data belongs to you" />
            <LinkRow
              icon={Download}
              title="Export my data"
              detail="Download your data as a JSON archive"
              onPress={() => void run(exportData)}
            />
            <LinkRow
              icon={ShieldCheck}
              title="Privacy & permissions"
              detail="What we store and why"
              onPress={() => router.push("/privacy")}
            />
            <LinkRow
              icon={HelpCircle}
              title="Help & setup"
              detail="Answers and integration status"
              onPress={() => router.push("/help")}
            />
            {state.identity === "guest" ? (
              <Button
                variant="danger"
                icon={Trash2}
                onPress={() => setConfirmReset(true)}
              >
                Clear this device’s data
              </Button>
            ) : (
              <Button
                variant="danger"
                icon={Trash2}
                onPress={() => setConfirmDelete(true)}
              >
                Delete account and data
              </Button>
            )}
          </Card>
        </View>
      </View>
      {error && (
        <Card style={{ marginTop: 20, borderColor: colors.error }}>
          <Label accessibilityLiveRegion="polite" color={colors.error}>
            {error}
          </Label>
        </Card>
      )}
      <Confirm
        visible={confirmReset}
        title="Clear your local space?"
        body="This permanently removes the subscriptions, receipts, and preferences saved in the guest workspace on this device."
        action="Clear local data"
        danger
        onClose={() => setConfirmReset(false)}
        onConfirm={async () => {
          await removeSnapshot("guest");
          await hydrate("guest");
          router.replace("/onboarding");
        }}
      />
      <Confirm
        visible={confirmDelete}
        title="Delete your account?"
        body="This permanently deletes your Subloom account and its associated cloud data, revokes forwarding addresses, and clears both account and guest data on this device. It does not cancel billing with your providers."
        action="Delete account and data"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          const { error } = await supabase!.functions.invoke("delete-account");
          if (error)
            throw new Error(
              "Account deletion did not complete. Try again while connected.",
            );
          await removeSnapshot(state.identity);
          await removeSnapshot("guest");
          await supabase!.auth.signOut({ scope: "local" });
          await hydrate("guest");
          router.replace("/onboarding");
        }}
      />
    </Page>
  );
}
