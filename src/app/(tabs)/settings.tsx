import { ThemedSwitch } from "../../components/ui/ThemedSwitch";
import { useRef, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Download,
  HelpCircle,
  Mail,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
  LogOut,
  Search,
  X,
  Activity,
  Sparkles,
} from "lucide-react-native";
import {
  useApp,
  updatePreferences,
  readableError,
  leaveDemo,
  hydrate,
  notify,
} from "../../store/app";
import { supabase } from "../../services/supabase";
import { macosBridge } from "../../services/macosBridge";
import { windowsBridge } from "../../services/windowsBridge";
import {
  enableWindowsReminders,
  openWindowsNotificationSettings,
  useWindowsNotifications,
} from "../../services/windowsNotifications";
import {
  enableMacReminders,
  openMacNotificationSettings,
  useMacNotifications,
} from "../../services/macosNotifications";
import { disableDevice, registerPush } from "../../services/notifications";
import { exportData } from "../../services/export";
import { clearLocalFeatures } from "../../services/featureSettings";
import { removeSnapshot } from "../../services/storage";
import { syncNow, resolveConflict } from "../../services/sync";
import { useTheme, useWide } from "../../theme/useTheme";
import {
  Badge,
  Button,
  Card,
  Confirm,
  Field,
  Label,
  LinkRow,
  Page,
  SectionTitle,
  Empty,
} from "../../components/ui/Primitives";
import { toolActions } from "../../components/ui/QuickActions";
import { ThemePicker } from "../../components/ui/ThemePicker";
import { ProFeatureBadge } from "../../components/pro/ProFeatureBadge";
import { ProBadge } from "../../components/pro/ProBadge";
import { PRO_PLAN_ENABLED } from "../../domain/planMode";
import { usePro } from "../../store/pro";
import { AppUpdatesCard } from "../../components/settings/AppUpdatesCard";
import { SupportCard } from "../../components/settings/SupportCard";
import { SecurityCard } from "../../components/settings/SecurityCard";
import { SelectField } from "../../components/ui/Selection";
import {
  currencyOptions,
  hourOptions,
  timezoneOptions,
} from "../../components/ui/pickerOptions";
const settingsGroups = [
  {
    title: "Account",
    keywords:
      "login sign in sync import guest delete account" +
      (PRO_PLAN_ENABLED
        ? " pro upgrade trial billing payment subscription"
        : ""),
  },
  {
    title: "Preferences",
    keywords: "appearance theme dark light system currency region timezone",
  },
  {
    title: "Security",
    keywords:
      "app protection lock unlock pin code passkey password biometric face touch privacy device recovery backup reset",
  },
  {
    title: "Reminders",
    keywords:
      "notification push email trial weekly digest private lock screen time quiet hours renewal mac windows",
  },
  {
    title: "Tools",
    keywords:
      "subscription receipt import monthly budgets csv calendar bank statement transactions",
  },
  {
    title: "App updates",
    keywords: "version download install update restart release",
  },
  {
    title: "Support & feedback",
    keywords:
      "donate donation coffee support developer ideas feedback suggestion feature bug problem report message",
  },
  {
    title: "Data & privacy",
    keywords: "json export download permissions help reset clear",
  },
];
export default function SettingsRoute() {
  const identity = useApp((state) => state.identity);
  return <Settings key={identity} />;
}
function Settings() {
  const { colors } = useTheme(),
    wide = useWide(),
    state = useApp(),
    p = state.data.preferences;
  const canManageBilling = usePro(
    (billing) =>
      billing.workspace === state.identity &&
      Boolean(billing.snapshot?.canManage),
  );
  const hasExistingBilling =
    canManageBilling ||
    state.data.subscriptions.some((subscription) =>
      Boolean(subscription.proBillingOwner),
    );
  const params = useLocalSearchParams<{ section?: string }>();
  const requestedSection = ["Support", "Feedback"].includes(
    params.section || "",
  )
    ? "Support & feedback"
    : params.section;
  const section = settingsGroups.some(
    (group) => group.title === requestedSection,
  )
    ? requestedSection!
    : "Preferences";
  const [search, setSearch] = useState("");
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const tools = toolActions.filter(
    (action) =>
      ![
        "Subscriptions",
        "Settings",
        "Data & privacy",
        "Ideas & feedback",
        "Family workspaces",
        "Team workspaces and SSO",
      ].includes(action.title),
  );
  const visibleGroups = words.length
    ? settingsGroups
        .filter((group) => {
          const content =
            group.title +
            " " +
            group.keywords +
            (group.title === "Tools"
              ? " " +
                tools
                  .map(
                    (action) =>
                      action.title +
                      " " +
                      action.detail +
                      " " +
                      (action.keywords || ""),
                  )
                  .join(" ")
              : "");
          return words.every((word) => content.toLowerCase().includes(word));
        })
        .map((group) => group.title)
    : [section];
  const isMobile = Platform.OS === "ios" || Platform.OS === "android";
  const isMac = Boolean(macosBridge());
  const isWindows = Boolean(windowsBridge());
  const mac = useMacNotifications();
  const windows = useWindowsNotifications();
  const [hour, setHour] = useState(String(p.reminderHour)),
    [quietStart, setQuietStart] = useState(String(p.quietStart)),
    [quietEnd, setQuietEnd] = useState(String(p.quietEnd)),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false),
    [confirmReset, setConfirmReset] = useState(false),
    [deletePhrase, setDeletePhrase] = useState("");
  const running = useRef(false);
  async function run(action: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      const message = readableError(e);
      setError(message);
      notify(message, "error");
    } finally {
      running.current = false;
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
          <Label size={14} bold>
            {label}
          </Label>
          <Label size={12} color={colors.secondary}>
            {detail}
          </Label>
        </View>
        <ThemedSwitch
          testID={
            "preference-" + label.toLowerCase().replace(/[^a-z0-9]/g, "-")
          }
          accessibilityLabel={label}
          value={value}
          onValueChange={(v) => void run(() => change(v))}
          disabled={busy || state.data.demo}
        />
      </View>
    );
  }
  return (
    <Page title="Settings">
      <View style={{ gap: 20 }}>
        <Field
          label="Find a setting or tool"
          placeholder="Try timezone, reminders or receipts"
          value={search}
          onChangeText={setSearch}
          leading={<Search size={18} color={colors.secondary} />}
        />
        <View
          style={{
            flexDirection: wide ? "row" : "column",
            gap: wide ? 32 : 20,
            alignItems: "flex-start",
          }}
        >
          <View style={{ width: wide ? 184 : "100%", gap: 4 }}>
            <View
              style={{
                flexDirection: wide ? "column" : "row",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              {settingsGroups.map((group) => (
                <Pressable
                  key={group.title}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: !search && section === group.title,
                  }}
                  onPress={() => {
                    router.setParams({ section: group.title });
                    setSearch("");
                    setError(null);
                  }}
                  style={({ pressed }) => ({
                    minHeight: 44,
                    paddingHorizontal: 14,
                    paddingVertical: 11,
                    borderRadius: 10,
                    backgroundColor:
                      !search && section === group.title
                        ? colors.mint
                        : pressed
                          ? colors.surface
                          : "transparent",
                  })}
                >
                  <Label
                    size={14}
                    bold={!search && section === group.title}
                    color={
                      !search && section === group.title
                        ? colors.primary
                        : colors.secondary
                    }
                  >
                    {group.title}
                  </Label>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ flex: 1, width: "100%", maxWidth: 760, gap: 20 }}>
            {visibleGroups.length === 0 && (
              <Empty
                icon={Search}
                actionIcon={X}
                title="No matching settings"
                body="Try a shorter search or browse the groups above."
                action="Clear search"
                onPress={() => setSearch("")}
              />
            )}
            {visibleGroups.includes("Account") && (
              <Card>
                <SectionTitle title="Account" />
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
                    <ProBadge />
                    <Label size={11} color={colors.secondary}>
                      {state.identity === "guest"
                        ? "Everything is saved on this device."
                        : "Connected to your Subloom account."}
                    </Label>
                  </View>
                </View>
                {(PRO_PLAN_ENABLED || hasExistingBilling) && (
                  <LinkRow
                    icon={Sparkles}
                    title={
                      PRO_PLAN_ENABLED
                        ? "Subloom Pro"
                        : "Manage existing billing"
                    }
                    detail="Plan and billing"
                    onPress={() => router.push("/pro")}
                  />
                )}
                <LinkRow
                  icon={Activity}
                  title="Recent activity"
                  detail="Subscription changes and reminders"
                  onPress={() => router.push("/activity")}
                />
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
                <Label
                  size={11}
                  color={colors.secondary}
                  style={{ marginTop: 15 }}
                >
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
                          onPress={() =>
                            void run(() => resolveConflict("remote"))
                          }
                        >
                          Use cloud version for this subscription
                        </Button>
                        <Button
                          variant="secondary"
                          onPress={() =>
                            void run(() => resolveConflict("local"))
                          }
                        >
                          Keep my local version
                        </Button>
                      </>
                    )}
                  </View>
                )}
                {state.identity !== "guest" && (
                  <Button
                    variant="danger"
                    icon={Trash2}
                    onPress={() => {
                      setDeletePhrase("");
                      setConfirmDelete(true);
                    }}
                  >
                    Delete account and data
                  </Button>
                )}
              </Card>
            )}
            {visibleGroups.includes("Security") && <SecurityCard />}
            {visibleGroups.includes("Preferences") && (
              <Card style={{ marginTop: 24 }}>
                <SectionTitle title="Appearance & region" />
                <ThemePicker
                  disabled={busy}
                  onAccent={(accentTheme) =>
                    void run(async () => {
                      await updatePreferences({ accentTheme });
                      notify("Your theme is saved.");
                    })
                  }
                  onAppearance={(appearance) =>
                    void run(async () => {
                      await updatePreferences({ appearance });
                      notify("Appearance saved.");
                    })
                  }
                />
                <View style={{ marginTop: 24 }}>
                  <SelectField
                    label="Preferred currency"
                    value={p.currency}
                    options={currencyOptions}
                    searchable
                    disabled={busy}
                    onChange={(currency) =>
                      void run(async () => {
                        await updatePreferences({
                          currency,
                          highRenewalThresholdMinor: null,
                        });
                      })
                    }
                  />
                </View>
                <Label
                  size={11}
                  color={colors.secondary}
                  style={{ marginTop: 12 }}
                >
                  Home totals use your preferred currency. Original subscription
                  prices stay unchanged.
                </Label>
                <View style={{ marginTop: 24 }}>
                  <SelectField
                    label="Timezone"
                    value={p.timezone}
                    disabled={busy}
                    onChange={(timezone) =>
                      void run(async () => {
                        await updatePreferences({ timezone });
                        notify("Timezone saved.");
                      })
                    }
                    options={timezoneOptions(p.timezone)}
                    searchable
                    hint="Renewals and reminders follow this timezone."
                  />
                </View>
              </Card>
            )}
            {visibleGroups.includes("Reminders") && (
              <Card>
                <SectionTitle title="Reminder preferences" />
                {isWindows && (
                  <>
                    {toggle(
                      "Windows notifications",
                      "Reminders on this PC, without an account.",
                      windows.enabled,
                      enableWindowsReminders,
                    )}
                    <Label size={12} color={colors.secondary}>
                      {windows.enabled
                        ? `${windows.pending} upcoming reminders ready on this laptop.`
                        : "Notifications are off."}
                    </Label>
                    <Label
                      size={11}
                      color={colors.secondary}
                      style={{ marginTop: 8 }}
                    >
                      Keep Subloom open or minimized to receive reminders.
                    </Label>
                    <View style={{ gap: 10, marginVertical: 16 }}>
                      <Button
                        variant="ghost"
                        onPress={() =>
                          void run(openWindowsNotificationSettings)
                        }
                      >
                        Open Windows notification settings
                      </Button>
                      {windows.error && (
                        <Label size={12} color={colors.error}>
                          {windows.error}
                        </Label>
                      )}
                    </View>
                  </>
                )}
                {isMac && (
                  <>
                    {toggle(
                      "Mac notifications",
                      "Local reminders on this Mac, even without an account.",
                      mac.enabled,
                      async (enabled) => {
                        await enableMacReminders(enabled);
                      },
                    )}
                    <Label size={12} color={colors.secondary}>
                      {mac.permission === "denied"
                        ? "Notifications are blocked in System Settings."
                        : mac.enabled
                          ? `${mac.pending} upcoming reminders scheduled on this Mac.`
                          : "Notifications are off."}
                    </Label>
                    <View style={{ gap: 10, marginVertical: 16 }}>
                      {mac.enabled &&
                        mac.permission === "granted" &&
                        !mac.alertsEnabled && (
                          <Label size={12} color={colors.secondary}>
                            Banners are disabled in System Settings. Alerts may
                            only appear in Notification Center.
                          </Label>
                        )}
                      <Button
                        variant="ghost"
                        onPress={() => void run(openMacNotificationSettings)}
                      >
                        Open notification settings
                      </Button>
                      {mac.error && (
                        <Label size={12} color={colors.error}>
                          {mac.error}
                        </Label>
                      )}
                    </View>
                  </>
                )}
                {state.identity === "guest" && !isMac && !isWindows && (
                  <Badge tone="neutral">Connect an account for delivery</Badge>
                )}
                {isMobile && (
                  <>
                    {toggle(
                      "Mobile push reminders",
                      "Send reminders to the phones registered to your account.",
                      p.pushEnabled,
                      async (enabled) => {
                        if (enabled && state.identity === "guest")
                          throw new Error(
                            "Connect an account before enabling push reminders.",
                          );
                        if (enabled && Platform.OS !== "web")
                          await registerPush();
                        else await disableDevice();
                        await updatePreferences({ pushEnabled: enabled });
                      },
                    )}
                    {state.identity !== "guest" && p.pushEnabled ? (
                      <View style={{ gap: 10, marginBottom: 16 }}>
                        <Label size={12} color={colors.secondary}>
                          {state.pushDeviceEnabled === null
                            ? "Checking this device…"
                            : state.pushDeviceEnabled
                              ? "This device is registered for push reminders."
                              : "Push delivery is not enabled on this device yet."}
                        </Label>
                        {!state.pushDeviceEnabled && (
                          <Button
                            variant="secondary"
                            loading={busy}
                            onPress={() =>
                              void run(async () => {
                                await registerPush();
                                notify(
                                  "Push reminders enabled on this device.",
                                );
                              })
                            }
                          >
                            Enable push on this device
                          </Button>
                        )}
                        {state.pushDeviceEnabled && (
                          <Button
                            variant="ghost"
                            loading={busy}
                            onPress={() =>
                              void run(async () => {
                                await disableDevice();
                                notify(
                                  "Push is off on this device. Your other devices keep their reminders.",
                                );
                              })
                            }
                          >
                            Turn off push on this device
                          </Button>
                        )}
                      </View>
                    ) : null}
                    {state.pushError && (
                      <Label size={12} color={colors.error}>
                        {state.pushError}
                      </Label>
                    )}
                  </>
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
                  async (trialReminders) =>
                    updatePreferences({ trialReminders }),
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
                  "Hide merchant names and prices from notification alerts.",
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
                <View
                  style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}
                >
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
                  <SelectField
                    label="Reminder time"
                    value={hour}
                    onChange={setHour}
                    options={hourOptions}
                    hint="In your selected timezone."
                  />
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <SelectField
                        label="Quiet hours start"
                        value={quietStart}
                        onChange={setQuietStart}
                        options={hourOptions}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <SelectField
                        label="Quiet hours end"
                        value={quietEnd}
                        onChange={setQuietEnd}
                        options={hourOptions}
                      />
                    </View>
                  </View>
                  <Label
                    size={11}
                    color={colors.secondary}
                    style={{ marginBottom: 14 }}
                  >
                    Use the same start and end time to turn off quiet hours.
                  </Label>
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
              </Card>
            )}
            {visibleGroups.includes("Tools") && (
              <Card>
                <SectionTitle title="Subscription tools" />
                {tools
                  .filter((action) =>
                    words.every((word) =>
                      (
                        action.title +
                        " " +
                        action.detail +
                        " " +
                        (action.keywords || "")
                      )
                        .toLowerCase()
                        .includes(word),
                    ),
                  )
                  .map((action) => (
                    <LinkRow
                      key={action.title}
                      title={action.title}
                      detail={action.detail}
                      badge={
                        action.proFeature ? <ProFeatureBadge /> : undefined
                      }
                      icon={action.icon}
                      onPress={() => router.push(action.route)}
                    />
                  ))}
              </Card>
            )}
            {visibleGroups.includes("App updates") && <AppUpdatesCard />}
            {visibleGroups.includes("Support & feedback") && <SupportCard />}
            {visibleGroups.includes("Data & privacy") && (
              <Card style={{ marginTop: 24 }}>
                <SectionTitle title="Data & privacy" />
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
                  title="Help"
                  detail="Using Subloom"
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
                ) : null}
              </Card>
            )}
          </View>
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
        cancelLabel="Keep my data"
        danger
        onClose={() => setConfirmReset(false)}
        onConfirm={async () => {
          await clearLocalFeatures("guest");
          await removeSnapshot("guest");
          await hydrate("guest");
          router.replace("/onboarding");
        }}
      />
      <Confirm
        visible={confirmDelete}
        title="Delete your account?"
        body="This permanently deletes your Subloom account and its associated cloud data, and clears both account and guest data on this device. It does not cancel billing with your providers."
        action="Delete account and data"
        cancelLabel="Keep my account"
        confirmDisabled={deletePhrase !== "DELETE"}
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (deletePhrase !== "DELETE")
            throw new Error("Type DELETE to confirm account deletion.");
          const { error } = await supabase!.functions.invoke("delete-account");
          if (error)
            throw new Error(
              "Account deletion did not complete. Try again while connected.",
            );
          await clearLocalFeatures(state.identity);
          await removeSnapshot(state.identity);
          await clearLocalFeatures("guest");
          await removeSnapshot("guest");
          await supabase!.auth.signOut({ scope: "local" });
          await hydrate("guest");
          router.replace("/onboarding");
        }}
      >
        <Field
          label="Type DELETE to confirm"
          value={deletePhrase}
          onChangeText={setDeletePhrase}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </Confirm>
    </Page>
  );
}
