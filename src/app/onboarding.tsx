import { useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Palette,
  ShieldCheck,
  UserRound,
} from "lucide-react-native";
import { Brand } from "../components/ui/Brand";
import { OnboardingArt } from "../components/onboarding/OnboardingArt";
import {
  Button,
  Card,
  Heading,
  IconButton,
  Label,
  Page,
} from "../components/ui/Primitives";
import { PickerSheet, SelectField } from "../components/ui/Selection";
import { ThemePicker } from "../components/ui/ThemePicker";
import {
  currencyOptions,
  timezoneOptions,
} from "../components/ui/pickerOptions";
import type { Currency, Preferences } from "../domain/models";
import {
  finishOnboarding,
  readableError,
  updatePreferences,
  useApp,
} from "../store/app";
import { useTheme, useWide } from "../theme/useTheme";
import { syncNow } from "../services/sync";

const steps = [
  {
    title: "Less juggling.\nMore clarity.",
    body: "Keep the subscriptions you love together, from movie nights to your everyday tools.",
  },
  {
    title: "See what’s\ncoming next.",
    body: "Keep an eye on renewal dates and trial endings. A little planning, a little more peace of mind.",
  },
  {
    title: "Your space.\nYour choice.",
    body: "Create an account to sync across devices, or keep things local. You can connect an account later.",
  },
] as const;

export default function OnboardingRoute() {
  const identity = useApp((state) => state.identity);
  const { tour } = useLocalSearchParams<{ tour?: string }>();
  return <Onboarding key={identity} replay={tour === "1"} />;
}

function Onboarding({ replay }: { replay: boolean }) {
  const { colors } = useTheme(),
    wide = useWide(),
    { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const defaults = useApp((s) => s.data.preferences),
    identity = useApp((s) => s.identity),
    onboarded = useApp((s) => s.data.onboarded),
    lastSyncedAt = useApp((s) => s.data.lastSyncedAt),
    syncError = useApp((s) => s.syncError);
  const [step, setStep] = useState(identity === "guest" || replay ? 0 : 2),
    [currency, setCurrency] = useState<Currency>(defaults.currency),
    [timezone, setTimezone] = useState(defaults.timezone),
    [regionOpen, setRegionOpen] = useState(false),
    [themeOpen, setThemeOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [savingTheme, setSavingTheme] = useState(false),
    [destination, setDestination] = useState<"/" | "/auth" | null>(null),
    [error, setError] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  const disabled = busy || savingTheme;
  function go(next: number) {
    setStep(next);
    setError(null);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }
  async function saveTheme(changes: Partial<Preferences>) {
    setSavingTheme(true);
    setError(null);
    try {
      await updatePreferences(changes);
    } catch (e) {
      setError(readableError(e));
    } finally {
      setSavingTheme(false);
    }
  }
  async function start(account = false) {
    setBusy(true);
    setError(null);
    try {
      const preferences = useApp.getState().data.preferences;
      await finishOnboarding({
        ...preferences,
        currency,
        timezone,
        highRenewalThresholdMinor:
          currency === preferences.currency
            ? preferences.highRenewalThresholdMinor
            : null,
      });
      if (useApp.getState().identity === identity)
        setDestination(account ? "/auth" : "/");
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  if (destination) return <Redirect href={destination} />;
  if (onboarded && !replay && !busy) return <Redirect href="/" />;
  if (identity !== "guest" && !lastSyncedAt)
    return (
      <Page title="Your account, on this device">
        <Card style={{ gap: 18, maxWidth: 480 }}>
          <Heading size={24}>Loading your subscriptions</Heading>
          <Label color={colors.secondary}>
            We’re checking your account before setting up this device.
          </Label>
          {syncError ? (
            <>
              <Label accessibilityRole="alert" color={colors.error}>
                {syncError}
              </Label>
              <Button
                loading={busy}
                onPress={() => {
                  setBusy(true);
                  void syncNow()
                    .catch(() => {})
                    .finally(() => setBusy(false));
                }}
              >
                Retry account sync
              </Button>
            </>
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </Card>
      </Page>
    );
  const current = steps[step]!;
  return (
    <ScrollView
      ref={scroll}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        flexGrow: 1,
        padding: wide ? 40 : 24,
        paddingBottom: Math.max(insets.bottom, 24),
        width: "100%",
        maxWidth: 1200,
        alignSelf: "center",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Brand compact={width < 360} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {step < 2 && (
            <Button
              small
              variant="ghost"
              disabled={disabled}
              onPress={() => go(2)}
            >
              Skip intro
            </Button>
          )}
          <IconButton
            icon={Palette}
            label="Choose theme and appearance"
            disabled={disabled}
            onPress={() => setThemeOpen(true)}
          />
        </View>
      </View>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          paddingVertical: wide ? 44 : 28,
        }}
      >
        <View
          style={{
            flexDirection: wide ? "row" : "column",
            alignItems: "center",
            gap: wide ? 68 : 28,
          }}
        >
          <View
            style={{
              flex: wide ? 1 : undefined,
              width: "100%",
              minHeight: wide ? 460 : undefined,
              paddingVertical: wide ? 40 : 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.hero,
              borderRadius: 28,
            }}
          >
            <OnboardingArt
              step={step}
              size={
                wide
                  ? Math.min((Math.min(width, 1200) - 148) / 2, 420)
                  : Math.min(width - 72, step === 2 ? 230 : 310)
              }
            />
          </View>
          <View
            style={{
              flex: wide ? 1 : undefined,
              width: "100%",
              maxWidth: wide ? 410 : 500,
              gap: 24,
            }}
          >
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Welcome tour"
              accessibilityValue={{
                min: 1,
                max: 3,
                now: step + 1,
                text: `Step ${step + 1} of 3`,
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View
                aria-hidden
                accessibilityElementsHidden
                style={{ flexDirection: "row", gap: 6 }}
              >
                {steps.map((_, i) => (
                  <View
                    key={i}
                    style={{
                      width: i === step ? 26 : 8,
                      height: 6,
                      borderRadius: 4,
                      backgroundColor:
                        i === step ? colors.primary : colors.border,
                    }}
                  />
                ))}
              </View>
              <Label size={12} color={colors.secondary}>
                Step {step + 1} of 3
              </Label>
            </View>
            <View accessibilityLiveRegion="polite" style={{ gap: 12 }}>
              <Heading size={32}>
                {identity !== "guest" && step === 2
                  ? "Make yourself\nat home."
                  : current.title}
              </Heading>
              <Label color={colors.secondary} size={15}>
                {identity !== "guest" && step === 2
                  ? "You’re signed in. Choose your currency and timezone, then your space is ready."
                  : current.body}
              </Label>
            </View>
            {step === 2 && (
              <View style={{ gap: 14 }}>
                <Button
                  small
                  variant="ghost"
                  icon={ChevronDown}
                  disabled={disabled}
                  onPress={() => setRegionOpen(!regionOpen)}
                  accessibilityLabel={
                    regionOpen
                      ? "Hide currency and timezone"
                      : "Change currency and timezone"
                  }
                >{`${currency} · ${timezone.replaceAll("_", " ")}`}</Button>
                {regionOpen && (
                  <View>
                    <SelectField
                      label="Your preferred currency"
                      testID="onboarding-currency"
                      value={currency}
                      onChange={setCurrency}
                      options={currencyOptions}
                      searchable
                      disabled={disabled}
                    />
                    <SelectField
                      label="Your timezone"
                      testID="onboarding-timezone"
                      value={timezone}
                      onChange={setTimezone}
                      options={timezoneOptions(defaults.timezone)}
                      searchable
                      disabled={disabled}
                    />
                  </View>
                )}
              </View>
            )}
            {error && (
              <Label accessibilityRole="alert" color={colors.error}>
                {error}
              </Label>
            )}
            {step < 2 ? (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                {step > 0 && (
                  <IconButton
                    icon={ArrowLeft}
                    label="Previous welcome step"
                    disabled={disabled}
                    onPress={() => go(step - 1)}
                  />
                )}
                <View style={{ flex: 1 }}>
                  <Button
                    testID="onboarding-next"
                    icon={ArrowRight}
                    disabled={disabled}
                    onPress={() => go(step + 1)}
                  >
                    Continue
                  </Button>
                </View>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {identity === "guest" && (
                  <Button
                    testID="onboarding-account"
                    icon={UserRound}
                    disabled={disabled}
                    loading={busy}
                    onPress={() => void start(true)}
                  >
                    Create or sign in
                  </Button>
                )}
                <Button
                  testID="get-started"
                  variant={identity === "guest" ? "secondary" : "primary"}
                  disabled={disabled}
                  loading={busy}
                  icon={identity === "guest" ? undefined : ArrowRight}
                  onPress={() => void start()}
                >
                  {identity === "guest" ? "Use on this device" : "Open Subloom"}
                </Button>
                <Label
                  size={12}
                  color={colors.secondary}
                  style={{ textAlign: "center" }}
                >
                  {identity === "guest"
                    ? "Local data stays in this browser or app. Export a backup from Settings to keep a copy."
                    : "Your account and guest data stay separate."}
                </Label>
                <Button
                  small
                  variant="ghost"
                  disabled={disabled}
                  onPress={() => go(1)}
                >
                  Back
                </Button>
              </View>
            )}
          </View>
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
        }}
      >
        <ShieldCheck size={15} color={colors.secondary} />
        <Label size={12} color={colors.secondary}>
          A calmer home for your subscriptions.
        </Label>
      </View>
      <PickerSheet
        visible={themeOpen}
        title="Make it feel like you"
        onClose={() => setThemeOpen(false)}
        busy={disabled}
        footer={
          <Button disabled={disabled} onPress={() => setThemeOpen(false)}>
            Done
          </Button>
        }
      >
        <ThemePicker
          compact
          disabled={disabled}
          onAccent={(accentTheme) => void saveTheme({ accentTheme })}
          onAppearance={(appearance) => void saveTheme({ appearance })}
        />
        {error && (
          <Label accessibilityRole="alert" color={colors.error}>
            {error}
          </Label>
        )}
      </PickerSheet>
    </ScrollView>
  );
}
