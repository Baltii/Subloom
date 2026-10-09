import { useState } from "react";
import { View, Pressable } from "react-native";
import { router } from "expo-router";
import { ArrowRight, Check, ShieldCheck } from "lucide-react-native";
import { Brand, BloomArt } from "../components/ui/Brand";
import {
  Button,
  Card,
  Chips,
  Field,
  Heading,
  Label,
  Page,
} from "../components/ui/Primitives";
import { currencies, type Currency } from "../domain/models";
import { finishOnboarding, readableError, useApp } from "../store/app";
import { useTheme, useWide } from "../theme/useTheme";
export default function Onboarding() {
  const { colors } = useTheme(),
    wide = useWide(),
    defaults = useApp((s) => s.data.preferences);
  const [currency, setCurrency] = useState<Currency>(defaults.currency),
    [timezone, setTimezone] = useState(defaults.timezone),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function start(demo = false) {
    setBusy(true);
    setError(null);
    try {
      await finishOnboarding({ ...defaults, currency, timezone }, demo);
      router.replace("/");
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title="" right={<Brand />}>
      <View
        style={{
          flexDirection: wide ? "row" : "column",
          gap: wide ? 70 : 24,
          alignItems: "center",
          marginTop: wide ? 20 : 0,
        }}
      >
        <View
          style={{
            flex: 1,
            width: "100%",
            backgroundColor: colors.hero,
            borderRadius: 30,
            padding: wide ? 46 : 28,
            minHeight: wide ? 580 : 340,
            justifyContent: "space-between",
            overflow: "hidden",
          }}
        >
          <Label
            size={10}
            bold
            color={colors.heroSecondary}
            style={{ letterSpacing: 2 }}
          >
            LESS SURPRISE. MORE CLARITY.
          </Label>
          <View style={{ alignItems: "center", marginVertical: 20 }}>
            <BloomArt size={wide ? 270 : 180} color={colors.heroArt} />
          </View>
          <View style={{ gap: 14 }}>
            <Heading size={wide ? 41 : 30}>
              A little clarity for{wide ? "\n" : " "}your recurring world.
            </Heading>
            <Label color={colors.heroSecondary} size={15}>
              Take control of your subscriptions.
            </Label>
          </View>
        </View>
        <View style={{ flex: 1, width: "100%", maxWidth: 430, gap: 24 }}>
          <View style={{ gap: 10 }}>
            <Heading size={30}>Make room for peace of mind.</Heading>
            <Label color={colors.secondary}>
              Know what you pay for. See what’s coming. Keep the subscriptions
              you love.
            </Label>
          </View>
          <View style={{ gap: 17 }}>
            {[
              "Everything you subscribe to, in one place",
              "A heads-up before your next renewal",
              "Find subscriptions hiding in your receipts",
            ].map((item) => (
              <View
                key={item}
                style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: colors.mint,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Check color={colors.primary} size={13} />
                </View>
                <Label size={13}>{item}</Label>
              </View>
            ))}
          </View>
          <Card style={{ padding: 18, gap: 12 }}>
            <Label size={12} bold>
              Your preferred currency
            </Label>
            <Chips
              values={currencies}
              selected={currency}
              onChange={setCurrency}
            />
            <Field
              label="Your timezone"
              value={timezone}
              onChangeText={setTimezone}
              autoCapitalize="none"
            />
          </Card>
          {error && <Label color={colors.error}>{error}</Label>}
          <Button
            testID="get-started"
            icon={ArrowRight}
            loading={busy}
            onPress={() => void start()}
          >
            Create my personal space
          </Button>
          <Pressable
            accessibilityRole="button"
            onPress={() => void start(true)}
            style={{
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Label size={13} color={colors.primary} bold>
              Explore a clearly labeled sample first
            </Label>
          </Pressable>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 7,
            }}
          >
            <ShieldCheck size={14} color={colors.secondary} />
            <Label size={11} color={colors.secondary}>
              No account needed. Your data stays yours.
            </Label>
          </View>
        </View>
      </View>
    </Page>
  );
}
