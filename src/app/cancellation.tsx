import { useState } from "react";
import { Linking, Switch, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useApp, saveSubscription, readableError } from "../store/app";
import { useFeatureSetting } from "../hooks/useFeatureSetting";
import {
  cancellationSchema,
  cancellationGuide,
  cancellationRecord,
  deadlineLabel,
} from "../domain/cancellation";
import type { Subscription } from "../domain/models";
import { today } from "../domain/renewal";
import {
  Button,
  Card,
  Confirm,
  Field,
  Heading,
  Label,
  Page,
} from "../components/ui/Primitives";
const initial: ReturnType<typeof cancellationSchema.parse> = {};
function Planner({ s }: { s: Subscription }) {
  const identity = useApp((state) => state.identity),
    timezone = useApp((state) => state.data.preferences.timezone),
    demo = useApp((state) => state.data.demo);
  const settings = useFeatureSetting(
    "cancellation",
    cancellationSchema,
    initial,
  );
  const [deadline, setDeadline] = useState(s.trialEnd || s.nextRenewal),
    [checks, setChecks] = useState({
      reviewedBilling: false,
      openedProvider: false,
      requested: false,
    }),
    [reference, setReference] = useState(""),
    [paidThrough, setPaidThrough] = useState(s.paidThrough ?? ""),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState<string | null>(null);
  const plan = settings.value[s.id],
    url = cancellationGuide(s);
  return (
    <View style={{ gap: 18 }}>
      <Heading size={22}>{s.name}</Heading>
      <Label>
        Cancel with the company that bills you. App Store, Google Play and
        partner billing may use a different cancellation process. Removing or
        pausing tracking in Subloom does not stop billing.
      </Label>
      {url ? (
        <Button
          variant="secondary"
          onPress={() => {
            void Linking.openURL(url).catch((e) => setError(readableError(e)));
          }}
        >
          Open provider account
        </Button>
      ) : (
        <Label>
          Open your provider’s official account or billing page. A verified
          account link is not available for this service.
        </Label>
      )}
      <Label>
        Review the next charge and cancellation terms, request cancellation at
        the provider, then keep its confirmation email or reference.
      </Label>
      {settings.error ? (
        <>
          <Label>{settings.error}</Label>
          <Button
            onPress={() => {
              setError(null);
              void settings.reload();
            }}
          >
            Reload cancellation plan
          </Button>
        </>
      ) : null}
      {plan ? (
        <Card>
          <Label bold>{deadlineLabel(plan.deadline, today(timezone))}</Label>
          <Label>
            Saved target: {plan.deadline} · Billing reviewed:{" "}
            {plan.reviewedBilling ? "Yes" : "No"} · Provider opened:{" "}
            {plan.openedProvider ? "Yes" : "No"} · Cancellation requested:{" "}
            {plan.requested ? "Yes" : "No"}
          </Label>
          <Button
            variant="ghost"
            onPress={() => {
              setDeadline(plan.deadline);
              setChecks({
                reviewedBilling: plan.reviewedBilling,
                openedProvider: plan.openedProvider,
                requested: plan.requested,
              });
            }}
          >
            Load saved plan for editing
          </Button>
        </Card>
      ) : null}
      <Card>
        <View style={{ gap: 12 }}>
          <Field
            label="Your cancellation deadline (YYYY-MM-DD)"
            value={deadline}
            onChangeText={setDeadline}
          />
          {(["reviewedBilling", "openedProvider", "requested"] as const).map(
            (key) => (
              <View
                key={key}
                style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
              >
                <Label style={{ flex: 1 }}>
                  {
                    {
                      reviewedBilling: "I reviewed who bills me and the terms",
                      openedProvider: "I opened the provider account",
                      requested: "I requested cancellation at the provider",
                    }[key]
                  }
                </Label>
                <Switch
                  accessibilityLabel={
                    {
                      reviewedBilling: "I reviewed who bills me and the terms",
                      openedProvider: "I opened the provider account",
                      requested: "I requested cancellation at the provider",
                    }[key]
                  }
                  value={checks[key]}
                  onValueChange={(value) =>
                    setChecks((current) => ({ ...current, [key]: value }))
                  }
                />
              </View>
            ),
          )}
          <Button
            loading={settings.busy}
            disabled={!settings.loaded || demo}
            onPress={() => {
              setError(null);
              void settings
                .save({ ...settings.value, [s.id]: { deadline, ...checks } })
                .catch((e) => setError(readableError(e)));
            }}
          >
            Save cancellation plan
          </Button>
        </View>
      </Card>
      <Card>
        <Field
          label="Provider confirmation reference"
          value={reference}
          onChangeText={setReference}
          maxLength={160}
          hint="Only record this after the provider confirms cancellation."
        />
        <Field
          label="Access paid through (optional YYYY-MM-DD)"
          value={paidThrough}
          onChangeText={setPaidThrough}
        />
        <Button
          disabled={!reference.trim() || demo}
          onPress={() => setConfirm(true)}
        >
          Record confirmed cancellation
        </Button>
      </Card>
      {error ? <Label accessibilityRole="alert">{error}</Label> : null}
      {s.status === "canceled" ? (
        <Button
          variant="secondary"
          onPress={() => router.push("/transactions")}
        >
          Review imported charges
        </Button>
      ) : null}
      <Confirm
        visible={confirm}
        title="Record provider confirmation?"
        body="This updates tracking in Subloom. It does not send a cancellation request or verify the provider’s billing state."
        action="Record cancellation"
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          const state = useApp.getState();
          if (state.identity !== identity)
            throw new Error("Your account changed. Reopen the subscription.");
          const latest = state.data.subscriptions.find(
            (row) => row.id === s.id,
          );
          if (!latest) throw new Error("This subscription was deleted.");
          await saveSubscription(
            cancellationRecord(
              latest,
              reference,
              paidThrough || null,
              today(timezone),
            ),
          );
        }}
      />
    </View>
  );
}
export default function Cancellation() {
  const state = useApp();
  const params = useLocalSearchParams<{
    subscriptionId?: string | string[];
    id?: string | string[];
  }>();
  const id =
    typeof params.subscriptionId === "string"
      ? params.subscriptionId
      : typeof params.id === "string"
        ? params.id
        : null;
  const setId = (value: string | null) =>
    router.setParams({ subscriptionId: value || "", id: "" });
  const s = state.data.subscriptions.find((row) => row.id === id);
  return (
    <Page
      title="Cancellation assistant"
      subtitle="Plan your deadline, follow your provider’s process, and record its confirmation."
      back
    >
      {s ? (
        <Planner key={state.identity + s.id} s={s} />
      ) : (
        <View style={{ gap: 12 }}>
          {state.data.subscriptions.length ? (
            state.data.subscriptions.map((row) => (
              <Button
                key={row.id}
                variant="secondary"
                onPress={() => setId(row.id)}
              >
                {"Plan cancellation for " + row.name}
              </Button>
            ))
          ) : (
            <Label>Add a subscription to create a cancellation plan.</Label>
          )}
        </View>
      )}
      {s ? (
        <Button variant="ghost" onPress={() => setId(null)}>
          Choose another subscription
        </Button>
      ) : null}
    </Page>
  );
}
