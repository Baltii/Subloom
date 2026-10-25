import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Crown, CalendarDays, X, Mail } from "lucide-react-native";
import {
  Button,
  Card,
  Chips,
  Confirm,
  Field,
  Heading,
  IconButton,
  Label,
  Page,
} from "../components/ui/Primitives";
import { useTheme, useWide } from "../theme/useTheme";
import { useApp, readableError } from "../store/app";
import { usePro, workspaceHasPaidPro } from "../store/pro";
import { type ProFeature } from "../hooks/useProAccess";
import { PRO_PLAN_ENABLED } from "../domain/planMode";
import {
  billingAuth,
  cancelProSubscription,
  disconnectBilling,
  openProBilling,
  refreshPro,
  sendBillingCode,
  stripeCheckoutAllowed,
  verifyBillingCode,
} from "../services/proBilling";

import { ProMembershipCard } from "../components/pro/ProMembershipCard";
import { ProFeatures } from "../components/pro/ProFeatures";
import { SupportCard } from "../components/settings/SupportCard";

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: useApp.getState().data.preferences.timezone,
      })
    : "your billing date";
}
export default function ProRoute() {
  const identity = useApp((s) => s.identity);
  return <ProPage key={identity} identity={identity} />;
}
type ProPageProps = {
  identity: string;
  onClose?: () => void;
  feature?: ProFeature;
};
export function ProPage(props: ProPageProps) {
  const [manageBilling, setManageBilling] = useState(false);
  if (PRO_PLAN_ENABLED || manageBilling) return <PaidProPage {...props} />;
  return (
    <Page
      title="Free access"
      back={!props.onClose}
      right={
        props.onClose ? (
          <IconButton
            icon={X}
            label="Close free access"
            onPress={props.onClose}
          />
        ) : undefined
      }
      subtitle="All available features are included."
    >
      <View style={{ gap: 20 }}>
        <Card>
          <Heading>Subloom is free to use</Heading>
          <Label>
            Track more subscriptions, save cards and wallets, and use imports
            and exports without a paid plan. No payment is required.
          </Label>
          <Button variant="ghost" onPress={() => setManageBilling(true)}>
            Manage an existing subscription
          </Button>
        </Card>
        <SupportCard />
      </View>
    </Page>
  );
}
function PaidProPage({
  identity,
  onClose,
  feature,
}: {
  identity: string;
  onClose?: () => void;
  feature?: ProFeature;
}) {
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
  const [cancel, setCancel] = useState(false);
  const operation = useRef(false);
  const pro = workspaceHasPaidPro(identity);
  const snapshot = billing.workspace === identity ? billing.snapshot : null;
  const tracked = useApp((s) =>
    s.data.subscriptions.some((item) => item.id === snapshot?.tracking?.id),
  );
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
    ? snapshot?.cancelAtPeriodEnd
      ? "Renewal canceled. Enjoy Pro until your plan ends."
      : snapshot?.status === "trialing"
        ? "Your Pro trial is active"
        : "Pro is active"
    : snapshot?.status === "past_due" || snapshot?.status === "unpaid"
      ? "Your payment needs attention"
      : snapshot?.status === "review"
        ? "Billing needs a support review"
        : "Make room for a little more.";
  return (
    <Page
      title={PRO_PLAN_ENABLED ? "Subloom Pro" : "Existing billing"}
      back={!onClose}
      right={
        onClose ? (
          <IconButton icon={X} label="Close Subloom Pro" onPress={onClose} />
        ) : undefined
      }
      subtitle={
        !PRO_PLAN_ENABLED
          ? "All available features remain free."
          : feature
            ? `Included with Subloom Pro: ${feature}.`
            : "Your daily essentials stay free."
      }
      contentMaxWidth={1000}
    >
      <View style={{ gap: 24 }}>
        <View
          style={{
            flexDirection: wide ? "row" : "column",
            gap: 24,
            alignItems: wide ? "flex-start" : "stretch",
          }}
        >
          {PRO_PLAN_ENABLED && (
            <View style={{ flex: wide ? 1 : undefined, gap: 24 }}>
              <ProMembershipCard
                active={pro}
                ending={Boolean(snapshot?.cancelAtPeriodEnd)}
                interval={snapshot?.interval ?? interval}
                detail={
                  pro
                    ? status
                    : "An optional upgrade. Your everyday essentials stay free."
                }
              />
              {wide && <ProFeatures />}
            </View>
          )}
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
                  <Crown size={22} color={colors.primary} />
                  <Heading size={22}>Your Pro membership</Heading>
                </View>
                <Label>
                  {snapshot?.cancelAtPeriodEnd
                    ? `Pro ends ${formatDate(snapshot.accessUntil ?? snapshot.tracking?.endsAt ?? null)}. Renewal is canceled.`
                    : snapshot?.status === "trialing"
                      ? `Trial ends ${formatDate(snapshot.trialEnd)}.`
                      : snapshot?.accessUntil
                        ? `Next billing date: ${formatDate(snapshot.accessUntil)}.`
                        : "Your purchase is saved on this device."}
                </Label>
                {snapshot?.interval && (
                  <View style={{ gap: 5 }}>
                    <Label size={12} color={colors.secondary}>
                      {snapshot.status === "trialing"
                        ? "After your trial"
                        : "Your plan"}
                    </Label>
                    <Label bold size={22}>
                      {snapshot.interval === "month"
                        ? "€2.99 / month"
                        : "€24 / year"}
                    </Label>
                  </View>
                )}
                {snapshot?.tracking && tracked && (
                  <View
                    style={{
                      gap: 8,
                      paddingVertical: 16,
                      borderTopWidth: 1,
                      borderBottomWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <CalendarDays size={16} color={colors.primary} />
                      <Label bold size={13}>
                        Added to your subscriptions
                      </Label>
                    </View>
                    <Label size={13} color={colors.secondary}>
                      Your purchase date and{" "}
                      {snapshot.cancelAtPeriodEnd
                        ? "ending"
                        : snapshot.status === "trialing"
                          ? "trial"
                          : "renewal"}{" "}
                      date stay in sync. Reminders follow your notification
                      settings.
                    </Label>
                    <Label size={12} color={colors.secondary}>
                      Purchased {formatDate(snapshot.tracking.purchasedAt)}
                    </Label>
                    <Button
                      small
                      variant="ghost"
                      onPress={() =>
                        router.push({
                          pathname: "/subscription/[id]",
                          params: { id: snapshot.tracking!.id },
                        })
                      }
                    >
                      View subscription & reminders
                    </Button>
                  </View>
                )}
                {!snapshot && (
                  <Label size={13} color={colors.secondary}>
                    Offline access is available until{" "}
                    {formatDate(new Date(billing.offlineUntil).toISOString())}.
                    Connect to check the latest billing status.
                  </Label>
                )}
              </>
            ) : PRO_PLAN_ENABLED && stripeCheckoutAllowed ? (
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
                {PRO_PLAN_ENABLED
                  ? "Purchases are not available in this build. You can verify your billing email below to restore an existing purchase."
                  : "Verify your billing email to manage an existing subscription. No paid plan is needed to use Subloom."}
              </Label>
            )}

            {identity === "guest" && !billing.owner ? (
              <View style={{ gap: 10 }}>
                <Heading size={18}>Keep your data local</Heading>
                <Label size={13} color={colors.secondary}>
                  {PRO_PLAN_ENABLED
                    ? "Verify an email to buy or restore Pro."
                    : "Verify an email to manage existing billing."}{" "}
                  This creates a billing identity for receipts and recovery.
                  Your tracked subscriptions and statements stay on this device;
                  it doesn’t connect your workspace to cloud sync.
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
                      Verify email
                    </Button>
                  </>
                )}
              </View>
            ) : (
              <>
                <Label size={13} color={colors.secondary}>
                  Billing email: {billing.email || "your signed-in account"}
                </Label>
                {PRO_PLAN_ENABLED &&
                  !pro &&
                  snapshot?.configured &&
                  stripeCheckoutAllowed && (
                    <>
                      <Label size={13}>
                        {snapshot.trialEligible
                          ? `7 days free, then ${price}/${cadence}. A payment method is required now. Renews automatically unless you cancel before the trial ends.`
                          : `Your free trial has already been used. ${price}/${cadence} starts immediately and renews automatically until canceled.`}
                      </Label>
                      <Button
                        loading={busy}
                        disabled={
                          demo ||
                          billing.loading ||
                          (snapshot.canManage &&
                            ![
                              "none",
                              "canceled",
                              "incomplete_expired",
                            ].includes(snapshot.status))
                        }
                        onPress={() =>
                          void run(async () => {
                            await openProBilling("checkout", interval);
                            setMessage(
                              "Finish checkout in your browser. Your plan and reminders update automatically when you return.",
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
                          "Manage payment details and invoices in Stripe. Your plan updates automatically when you return.",
                        );
                      })
                    }
                  >
                    Manage billing
                  </Button>
                )}
                {snapshot?.canManage &&
                  stripeCheckoutAllowed &&
                  [
                    "trialing",
                    "active",
                    "past_due",
                    "unpaid",
                    "paused",
                  ].includes(snapshot.status) &&
                  !snapshot.cancelAtPeriodEnd && (
                    <Button
                      variant="ghost"
                      icon={X}
                      disabled={busy || demo || billing.loading}
                      testID="pro-cancel-subscription"
                      onPress={() => setCancel(true)}
                    >
                      Cancel subscription
                    </Button>
                  )}
                {PRO_PLAN_ENABLED && snapshot && !snapshot.configured && (
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
              <View style={{ gap: 10 }}>
                <Label accessibilityRole="alert" color={colors.error} size={13}>
                  {error || billing.error}
                </Label>
                <Button
                  variant="secondary"
                  loading={busy || billing.loading}
                  onPress={() => void run(() => refreshPro(identity))}
                >
                  Retry billing status
                </Button>
              </View>
            )}
          </Card>
        </View>
        {PRO_PLAN_ENABLED && !wide && <ProFeatures />}
        <Label size={12} color={colors.secondary}>
          Payments are handled by Stripe. Subloom never receives your full
          payment card details. For local workspaces, verify the same billing
          email on another device to restore Pro; local records need a separate
          backup. Verified Pro access works offline for up to 72 hours, bounded
          by your trial or paid period.
        </Label>
      </View>
      <Confirm
        visible={cancel}
        title="Cancel your Pro subscription?"
        body={
          (pro
            ? "This stops automatic renewal. You keep Pro until "
            : "This stops automatic renewal. Your plan ends ") +
          formatDate(
            snapshot?.tracking?.endsAt ?? snapshot?.accessUntil ?? null,
          ) +
          ". Your saved records stay available after Pro ends. Outstanding invoices, if any, remain payable."
        }
        action="Cancel subscription"
        onClose={() => setCancel(false)}
        onConfirm={async () => {
          const result = await cancelProSubscription();
          setMessage(
            "Renewal canceled. Your plan ends " +
              formatDate(result.endsAt) +
              ".",
          );
        }}
      />
      <Confirm
        visible={disconnect}
        title="Disconnect billing on this device?"
        body="This removes Pro access from this local workspace until you verify your billing email again. Your local records stay saved. This does not cancel your subscription or stop renewal; use Cancel subscription to stop renewal."
        action="Disconnect billing"
        onClose={() => setDisconnect(false)}
        onConfirm={disconnectBilling}
      />
    </Page>
  );
}
