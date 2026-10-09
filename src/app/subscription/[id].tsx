import { useState } from "react";
import { View, Linking, Switch } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  ExternalLink,
  Pencil,
  Pause,
  Play,
  Trash2,
  X,
  Bell,
  CalendarDays,
  CreditCard,
  ReceiptText,
} from "lucide-react-native";
import {
  useApp,
  changeStatus,
  deleteSubscription,
  saveSubscription,
  readableError,
} from "../../store/app";
import { annualCost, formatMoney } from "../../domain/money";
import {
  dateLabel,
  intervalLabel,
  nextEvent,
  today,
} from "../../domain/renewal";
import { serviceFor } from "../../domain/catalog";
import { useTheme, useWide } from "../../theme/useTheme";
import {
  Badge,
  Button,
  Card,
  Chips,
  Confirm,
  Empty,
  Field,
  Heading,
  Label,
  Page,
  SectionTitle,
} from "../../components/ui/Primitives";
import { ServiceIcon } from "../../components/subscriptions/ServiceIcon";
export default function Details() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { colors } = useTheme(),
    wide = useWide(),
    data = useApp((s) => s.data),
    s = data.subscriptions.find((s) => s.id === id);
  const [confirmation, setConfirmation] = useState<"delete" | "cancel" | null>(
      null,
    ),
    [paidThrough, setPaidThrough] = useState(""),
    [error, setError] = useState<string | null>(null);
  if (!s)
    return (
      <Page title="Subscription details" back>
        <Empty
          title="Subscription not found."
          body="This subscription may have been deleted."
        />
      </Page>
    );
  const service = serviceFor(s.serviceId),
    detection = data.candidates.find(
      (c) => c.state === "confirmed" && c.matchedSubscriptionId === s.id,
    ),
    event = nextEvent(s, today(data.preferences.timezone));
  async function updateReminder(enabled: boolean) {
    if (!s) return;
    try {
      await saveSubscription({
        ...s,
        reminders: {
          enabled,
          days: s.reminders?.days || data.preferences.reminderDays,
        },
      });
    } catch (e) {
      setError(readableError(e));
    }
  }
  return (
    <Page
      title={s.name}
      subtitle="Everything you need, in one place."
      back
      right={
        <Button
          variant="secondary"
          icon={Pencil}
          small
          onPress={() =>
            router.push({ pathname: "/subscription/edit", params: { id } })
          }
        >
          Edit
        </Button>
      }
    >
      <View
        style={{
          flexDirection: wide ? "row" : "column",
          gap: 24,
          maxWidth: 1000,
          alignSelf: "center",
          width: "100%",
        }}
      >
        <View style={{ flex: 1.3 }}>
          <Card style={{ padding: 30 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <ServiceIcon serviceId={s.serviceId} name={s.name} size={65} />
              <Badge
                tone={
                  s.status === "trial"
                    ? "warning"
                    : s.status === "active"
                      ? "green"
                      : "neutral"
                }
              >
                {s.status}
              </Badge>
            </View>
            <View style={{ marginTop: 28, gap: 6 }}>
              <Heading size={38}>
                {formatMoney(s.amountMinor, s.currency)}
              </Heading>
              <Label color={colors.secondary}>
                {s.currency} / {intervalLabel(s)}
              </Label>
            </View>
            <View style={{ marginTop: 28, gap: 22 }}>
              {[
                {
                  icon: CalendarDays,
                  label:
                    event?.type === "paid_through"
                      ? "Access paid through"
                      : event?.type === "trial"
                        ? "Trial ends"
                        : "Next renewal",
                  value: event
                    ? dateLabel(event.date, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Tracking " + s.status,
                },
                {
                  icon: ReceiptText,
                  label: "Estimated annual cost",
                  value: formatMoney(annualCost(s), s.currency),
                },
                {
                  icon: CalendarDays,
                  label: "Started on",
                  value: dateLabel(s.startDate, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  }),
                },
                {
                  icon: CreditCard,
                  label: "Payment nickname",
                  value: s.paymentMethod || "Not provided",
                },
              ].map((row) => (
                <View
                  key={row.label}
                  style={{
                    flexDirection: "row",
                    gap: 13,
                    alignItems: "center",
                  }}
                >
                  <row.icon size={19} color={colors.secondary} />
                  <View style={{ flex: 1 }}>
                    <Label size={11} color={colors.secondary}>
                      {row.label}
                    </Label>
                    <Label bold size={13}>
                      {row.value}
                    </Label>
                  </View>
                </View>
              ))}
            </View>
          </Card>
          <Card style={{ marginTop: 20 }}>
            <SectionTitle title="Details" />
            <Label size={12} color={colors.secondary}>
              Category
            </Label>
            <Label style={{ marginBottom: 16 }}>{s.category}</Label>
            <Label size={12} color={colors.secondary}>
              Added through
            </Label>
            <Label style={{ marginBottom: 16 }}>
              {s.source.replace("_", " ")}
            </Label>
            {detection && (
              <Label
                size={11}
                color={colors.secondary}
                style={{ marginBottom: 16 }}
              >
                Parser confidence at import:{" "}
                {Math.round(detection.confidence * 100)}% · confirmed by you.
              </Label>
            )}
            <Label size={12} color={colors.secondary}>
              Notes
            </Label>
            <Label>{s.notes || "No notes yet."}</Label>
          </Card>
        </View>
        <View style={{ flex: 1 }}>
          <Card>
            <SectionTitle title="Your reminders" />
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <Bell size={18} color={colors.primary} />
              <Label style={{ flex: 1 }} size={13}>
                Enable for this subscription
              </Label>
              <Switch
                accessibilityLabel="Enable reminders for this subscription"
                value={s.reminders?.enabled ?? true}
                onValueChange={(enabled) => void updateReminder(enabled)}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
            <Label size={12} color={colors.secondary} style={{ marginTop: 17 }}>
              Reminder days:{" "}
              {(s.reminders?.days || data.preferences.reminderDays).join(", ")}{" "}
              days before renewal.
            </Label>
            <View style={{ marginTop: 16 }}>
              <Chips
                values={["Default", "1 day", "3 & 1 days"] as const}
                selected={
                  !s.reminders
                    ? "Default"
                    : s.reminders.days.length === 1
                      ? "1 day"
                      : "3 & 1 days"
                }
                onChange={(value) => {
                  void saveSubscription({
                    ...s,
                    reminders:
                      value === "Default"
                        ? null
                        : {
                            enabled: true,
                            days: value === "1 day" ? [1] : [3, 1],
                          },
                  }).catch((e) => setError(readableError(e)));
                }}
              />
            </View>
            <Label size={11} color={colors.secondary} style={{ marginTop: 16 }}>
              Connect an account and enable a delivery channel in Settings to
              receive server reminders.
            </Label>
          </Card>
          <Card style={{ marginTop: 20, gap: 14 }}>
            <Heading size={18}>Make it work for you.</Heading>
            {service?.managementUrl && (
              <Button
                variant="secondary"
                icon={ExternalLink}
                onPress={() =>
                  void Linking.openURL(service.managementUrl!).catch(() =>
                    setError("Could not open the provider link."),
                  )
                }
              >
                Manage with provider
              </Button>
            )}
            <Label size={11} color={colors.secondary}>
              To cancel billing, visit your provider. Recording a cancellation
              here only updates Subloom.
            </Label>
            {s.status === "active" || s.status === "trial" ? (
              <>
                <Button
                  variant="secondary"
                  icon={Pause}
                  onPress={() =>
                    void changeStatus(id, "paused").catch((e) =>
                      setError(readableError(e)),
                    )
                  }
                >
                  Pause tracking
                </Button>
                <Button
                  variant="secondary"
                  icon={X}
                  onPress={() => setConfirmation("cancel")}
                >
                  Record cancellation
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                icon={Play}
                onPress={() =>
                  void changeStatus(id, "active").catch((e) =>
                    setError(readableError(e)),
                  )
                }
              >
                Resume tracking
              </Button>
            )}
            <Button
              variant="danger"
              icon={Trash2}
              onPress={() => setConfirmation("delete")}
            >
              Delete subscription
            </Button>
            {error && (
              <Label color={colors.error} size={12}>
                {error}
              </Label>
            )}
          </Card>
        </View>
      </View>
      <Confirm
        visible={confirmation === "delete"}
        title="Delete this subscription?"
        body="This removes the subscription and its future Subloom reminders. It won’t cancel billing with the provider."
        action="Delete subscription"
        danger
        onClose={() => setConfirmation(null)}
        onConfirm={async () => {
          await deleteSubscription(id);
          router.replace("/subscriptions");
        }}
      />
      <Confirm
        visible={confirmation === "cancel"}
        title="Record a cancellation"
        body="Confirm you have handled billing with the provider. If access remains, enter the date it is paid through."
        action="Record in Subloom"
        onClose={() => setConfirmation(null)}
        onConfirm={async () => {
          await changeStatus(id, "canceled", paidThrough || null);
        }}
      >
        <Field
          label="Paid through (optional) · YYYY-MM-DD"
          value={paidThrough}
          onChangeText={setPaidThrough}
        />
      </Confirm>
    </Page>
  );
}
