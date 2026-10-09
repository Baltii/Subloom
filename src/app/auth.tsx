import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Mail, ShieldCheck } from "lucide-react-native";
import { z } from "zod";
import { supabase } from "../services/supabase";
import { useTheme } from "../theme/useTheme";
import {
  Button,
  Card,
  Field,
  Heading,
  Label,
  Page,
} from "../components/ui/Primitives";
import { importGuestData, readableError, useApp } from "../store/app";
export default function Auth() {
  const { colors } = useTheme(),
    identity = useApp((s) => s.identity);
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
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
  return (
    <Page
      title="A home for your subscriptions."
      subtitle="Connect an account to sync across your devices."
      back
    >
      <Card
        style={{ maxWidth: 500, alignSelf: "center", width: "100%", gap: 18 }}
      >
        <Mail size={26} color={colors.primary} />
        {identity !== "guest" ? (
          <>
            <Heading size={21}>You’re connected.</Heading>
            <Label color={colors.secondary}>
              Your guest workspace is still saved on this device. Import it to
              this account when you’re ready.
            </Label>
            <Button loading={busy} onPress={() => void run(importGuestData)}>
              Import my guest subscriptions
            </Button>
            <Button
              variant="secondary"
              onPress={() => router.replace("/settings")}
            >
              Back to Settings
            </Button>
          </>
        ) : !supabase ? (
          <>
            <Heading size={21}>Your local space works right now.</Heading>
            <Label color={colors.secondary}>
              Account sync needs the Supabase project configuration described in
              the setup guide. All tracking and text receipt imports work
              without an account.
            </Label>
            <Button onPress={() => router.back()}>
              Continue on this device
            </Button>
          </>
        ) : (
          <>
            <Heading size={21}>
              {sent ? "Check your inbox." : "Sign in with your email."}
            </Heading>
            <Label color={colors.secondary} size={13}>
              {sent
                ? "Enter the one-time code from your email. Your guest data stays safe until you choose to import it."
                : "We’ll email you a one-time code. No password to remember."}
            </Label>
            <Field
              label="Email address"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              editable={!sent}
            />
            {sent && (
              <Field
                label="One-time email code"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={10}
              />
            )}
            <Button
              loading={busy}
              disabled={sent && code.length < 6}
              onPress={() =>
                void run(async () => {
                  const destination = z.string().email().parse(email.trim());
                  if (!sent) {
                    const { error } = await supabase!.auth.signInWithOtp({
                      email: destination,
                    });
                    if (error) throw new Error(error.message);
                    setSent(true);
                  } else {
                    const { error } = await supabase!.auth.verifyOtp({
                      email: destination,
                      token: code.trim(),
                      type: "email",
                    });
                    if (error)
                      throw new Error(
                        "That code could not be verified. Check it or request a new one.",
                      );
                  }
                })
              }
            >
              {sent ? "Verify and connect" : "Email me a code"}
            </Button>
            {sent && (
              <Button
                variant="ghost"
                onPress={() => {
                  setSent(false);
                  setCode("");
                }}
              >
                Use another email or resend
              </Button>
            )}
          </>
        )}
        {error && (
          <Label color={colors.error} size={12}>
            {error}
          </Label>
        )}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <ShieldCheck size={15} color={colors.primary} />
          <Label color={colors.secondary} size={11} style={{ flex: 1 }}>
            Guest data is never discarded when you sign in. It only moves to
            your account with your permission.
          </Label>
        </View>
      </Card>
    </Page>
  );
}
