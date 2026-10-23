import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  Check,
  CreditCard,
  Download,
  FileSearch,
  Mail,
} from "lucide-react-native";
import {
  Button,
  Card,
  Chips,
  Confirm,
  Field,
  Heading,
  Label,
  Page,
} from "../components/ui/Primitives";
import { useTheme, useWide } from "../theme/useTheme";
import { useApp, readableError } from "../store/app";
import { usePro } from "../store/pro";
import {
  billingAuth,
  disconnectBilling,
  openProBilling,
  refreshPro,
  sendBillingCode,
  stripeCheckoutAllowed,
  verifyBillingCode,
} from "../services/proBilling";

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "your billing date";
}
export default function ProRoute() {
  const identity = useApp((s) => s.identity);
  return <ProPage key={identity} identity={identity} />;
}
function ProPage({ identity }: { identity: string }) {
  const { colors } = useTheme(),
    wide = useWide();
  const billing = usePro();
  const demo = useApp((s) => s.data.demo);
  const [interval, setInterval] = useState<"month" | "year">("year");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disconnect, setDisconnect] = useState(false);
  const operation = useRef(false);
  const pro = billing.workspace === identity && billing.offlineUntil > 0;
  const snapshot = billing.workspace === identity ? billing.snapshot : null;
  useFocusEffect(
    useCallback(() => {
      void refreshPro(identity);
    }, [identity]),
  );
  async function run(work: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await work();
    } catch (e) {
      setError(readableError(e));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  const price = interval === "month" ? "€2.99" : "€24";
  const cadence = interval === "month" ? "month" : "year";
  const status = pro
    ? snapshot?.status === "trialing"
      ? "Your Pro trial is active"
      : "Pro is active"
    : snapshot?.status === "past_due" || snapshot?.status === "unpaid"
      ? "Your payment needs attention"
      : snapshot?.status === "review"
        ? "Billing needs a support review"
        : "Make room for a little more.";
  return (
    <Page
      title="Subloom Pro"
      back
      subtitle="Your daily essentials stay free."
      contentMaxWidth={1000}
    >
      <View style={{ gap: 24 }}>
        <View style={{ gap: 10, maxWidth: 680 }}>
          <Heading size={wide ? 36 : 28}>{status}</Heading>
          <Label color={colors.secondary}>
            Keep tracking subscriptions and getting reminders for free. Choose
            Pro when you want to find recurring charges in statements, export
            transaction reports, or save more billing methods.
          </Label>
        </View>
        <View
          style={{
            flexDirection: wide ? "row" : "column",
            gap: 24,
            alignItems: "stretch",
          }}
        >
          <Card style={{ flex: wide ? 1 : undefined, gap: 22 }}>
            <Heading size={22}>More clarity, less sorting.</Heading>
            {[
              {
                icon: FileSearch,
                title: "Import statements",
                body: "Review CSV transactions and detect possible recurring subscriptions. You choose what to track.",
              },
              {
                icon: Download,
                title: "Export transaction reports",
                body: "Download your imported transaction records as a CSV, in their original currencies.",
              },
              {
                icon: CreditCard,
                title: "Up to 50 cards & wallets",
                body: "Keep more saved billing labels together. Free includes 3 combined.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <View key={title} style={{ flexDirection: "row", gap: 14 }}>
                <Icon size={22} color={colors.primary} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Label bold>{title}</Label>
                  <Label size={13} color={colors.secondary}>
                    {body}
                  </Label>
                </View>
              </View>
            ))}
            <View
              style={{
                gap: 8,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                paddingTop: 18,
              }}
            >
              <Label bold size={13}>
                Always included for free
              </Label>
              <Label size={13} color={colors.secondary}>
                Manual subscription tracking, renewal reminders, calendar, and a
                full JSON backup of your data. Your existing records stay
                accessible if Pro ends.
              </Label>
            </View>
          </Card>
          <Card style={{ flex: wide ? 1 : undefined, gap: 18 }}>
            {pro ? (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <Check size={22} color={colors.primary} />
                  <Heading size={22}>You’re all set.</Heading>
                </View>
                <Label>
                  {snapshot?.status === "trialing"
                    ? `Trial ends ${formatDate(snapshot.trialEnd)}.`
                    : snapshot?.cancelAtPeriodEnd
                      ? `Pro ends ${formatDate(snapshot.accessUntil)}. Renewal is canceled.`
                      : snapshot?.accessUntil
                        ? `Next billing date: ${formatDate(snapshot.accessUntil)}.`
                        : "Your purchase is saved on this device."}
                </Label>
                {!snapshot && (
                  <Label size={13} color={colors.secondary}>
                    Offline access is available until{" "}
                    {formatDate(new Date(billing.offlineUntil).toISOString())}.
                    Connect to check the latest billing status.
                  </Label>
                )}
              </>
            ) : stripeCheckoutAllowed ? (
              <>
                <Heading size={22}>Choose your plan</Heading>
                <Chips
                  wrap
                  values={["month", "year"] as const}
                  selected={interval}
                  onChange={setInterval}
                  disabled={busy}
                  labels={{ month: "Monthly", year: "Yearly" }}
                />
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    gap: 6,
                  }}
                >
                  <Heading size={40}>{price}</Heading>
                  <Label color={colors.secondary}>/ {cadence}</Label>
                </View>
                <Label size={13} color={colors.secondary}>
                  {interval === "year"
                    ? "€24 billed once a year."
                    : "€2.99 billed each month."}{" "}
                  Final total, including any applicable tax, is shown in Stripe
                  before you confirm.
                </Label>
                {!billing.owner && (
                  <Label size={13}>
                    First-time billing emails get 7 days free. A payment method
                    is required at trial start; your selected plan renews
                    automatically unless canceled before the trial ends.
                  </Label>
                )}
              </>
            ) : (
              <Label>
                Purchases are not available in this build. You can verify your
                billing email below to restore an existing purchase.
              </Label>
            )}

            {identity === "guest" && !billing.owner ? (
              <View style={{ gap: 10 }}>
                <Heading size={18}>Keep your data local</Heading>
                <Label size={13} color={colors.secondary}>
                  Verify an email to buy or restore Pro. This creates a billing
                  identity for receipts and recovery. Your tracked subscriptions
                  and statements stay on this device; it doesn’t connect your
                  workspace to cloud sync.
                </Label>
                <Field
                  label="Billing email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    setSentTo(null);
                    setCode("");
                  }}
                  editable={!busy}
                />
                <Button
                  icon={Mail}
                  variant="secondary"
                  loading={busy}
                  disabled={!billingAuth || demo || !email.trim()}
                  onPress={() =>
                    void run(async () => {
                      await sendBillingCode(email);
                      setSentTo(email.trim());
                      setMessage("Check your email for a verification code.");
                    })
                  }
                >
                  {sentTo ? "Send another code" : "Send verification code"}
                </Button>
                {sentTo && (
                  <>
                    <Field
                      label="Email verification code"
                      value={code}
                      onChangeText={setCode}
                      keyboardType="number-pad"
                      autoComplete="one-time-code"
                      editable={!busy}
                    />
                    <Button
                      loading={busy}
                      disabled={!code.trim() || demo}
                      onPress={() =>
                        void run(async () => {
                          await verifyBillingCode(sentTo, code);
                          setCode("");
                          setMessage(
                            "Billing email verified. Your local workspace is unchanged.",
                          );
                        })
                      }
                    >
                      Verify and restore Pro
                    </Button>
                  </>
                )}
              </View>
            ) : (
              <>
                <Label size={13} color={colors.secondary}>
                  Billing email: {billing.email || "your signed-in account"}
                </Label>
                {!pro && snapshot?.configured && stripeCheckoutAllowed && (
                  <>
                    <Label size={13}>
                      {snapshot.trialEligible
                        ? `7 days free, then ${price}/${cadence}. A payment method is required now. Renews automatically unless you cancel before the trial ends in Manage billing.`
                        : `Your free trial has already been used. ${price}/${cadence} starts immediately and renews automatically until canceled.`}
                    </Label>
                    <Button
                      loading={busy}
                      disabled={
                        demo ||
                        billing.loading ||
                        (snapshot.canManage &&
                          !["none", "canceled", "incomplete_expired"].includes(
                            snapshot.status,
                          ))
                      }
                      onPress={() =>
                        void run(async () => {
                          await openProBilling("checkout", interval);
                          setMessage(
                            "Complete checkout in your browser, then return and check your Pro status.",
                          );
                        })
                      }
                    >
                      {snapshot.trialEligible
                        ? "Start 7-day free trial"
                        : "Subscribe to Pro"}
                    </Button>
                  </>
                )}
                {snapshot?.canManage && stripeCheckoutAllowed && (
                  <Button
                    variant="secondary"
                    loading={busy}
                    disabled={demo}
                    onPress={() =>
                      void run(async () => {
                        await openProBilling("portal");
                        setMessage(
                          "Manage your plan, payment method, invoices, or cancellation in Stripe. Return here to refresh your status.",
                        );
                      })
                    }
                  >
                    Manage billing
                  </Button>
                )}
                <Button
                  variant="secondary"
                  loading={busy || billing.loading}
                  onPress={() =>
                    void run(async () => {
                      await refreshPro(identity);
                    })
                  }
                >
                  Check purchase / restore access
                </Button>
                {snapshot && !snapshot.configured && (
                  <Label size={13}>
                    Pro purchases aren’t available yet. Payment setup is still
                    in progress.
                  </Label>
                )}
                {identity === "guest" && (
                  <Button
                    small
                    variant="ghost"
                    disabled={busy}
                    onPress={() => setDisconnect(true)}
                  >
                    Disconnect billing on this device
                  </Button>
                )}
              </>
            )}
            {message && (
              <Label accessibilityLiveRegion="polite" size={13}>
                {message}
              </Label>
            )}
            {(error || billing.error) && (
              <Label accessibilityRole="alert" color={colors.error} size={13}>
                {error || billing.error}
              </Label>
            )}
          </Card>
        </View>
        <Label size={12} color={colors.secondary}>
          Payments are handled by Stripe. Subloom never receives your full
          payment card details. For local workspaces, verify the same billing
          email on another device to restore Pro; local records need a separate
          backup. Verified Pro access works offline for up to 72 hours, bounded
          by your trial or paid period.
        </Label>
      </View>
      <Confirm
        visible={disconnect}
        title="Disconnect billing on this device?"
        body="This removes Pro access from this local workspace until you verify your billing email again. Your local records stay saved. This does not cancel your subscription or stop renewal; use Manage billing to cancel first."
        action="Disconnect billing"
        onClose={() => setDisconnect(false)}
        onConfirm={disconnectBilling}
      />
    </Page>
  );
}
