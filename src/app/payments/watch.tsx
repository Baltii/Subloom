import { useMemo, useState } from "react";
import { Linking, View } from "react-native";
import { router } from "expo-router";
import {
  Button,
  Card,
  Chips,
  Confirm,
  Field,
  Heading,
  Label,
  Page,
} from "../../components/ui/Primitives";
import { SelectField } from "../../components/ui/Selection";
import { PaymentSettingState } from "../../components/payments/PaymentSettingState";
import { useApp, notify, readableError } from "../../store/app";
import { useFeatureSetting } from "../../hooks/useFeatureSetting";
import { emptyLedger, ledgerSchema } from "../../domain/radar";
import {
  cancellationCases,
  cancellationEvidence,
  providerConfirmation,
  emptyWatchReviews,
  watchReviewsSchema,
  watchStatuses,
  type CancellationCase,
  type WatchReview,
} from "../../domain/cancellationWatch";
import { cancellationGuide } from "../../domain/cancellation";
import { formatMoney } from "../../domain/money";
import { shareText } from "../../services/files";
function Watch() {
  const subscriptions = useApp((s) => s.data.subscriptions),
    demo = useApp((s) => s.data.demo);
  const ledger = useFeatureSetting(
      "payment_transactions",
      ledgerSchema,
      emptyLedger,
    ),
    reviews = useFeatureSetting(
      "cancellation_watch",
      watchReviewsSchema,
      emptyWatchReviews,
    );
  const cases = useMemo(
    () => cancellationCases(subscriptions, ledger.value, reviews.value),
    [subscriptions, ledger.value, reviews.value],
  );
  const [filter, setFilter] = useState<"Needs review" | "All cases">(
      "Needs review",
    ),
    [selected, setSelected] = useState<CancellationCase | null>(null),
    [status, setStatus] = useState<WatchReview["status"]>("open"),
    [note, setNote] = useState(""),
    [error, setError] = useState<string | null>(null),
    [visible, setVisible] = useState(20),
    [busy, setBusy] = useState(false);
  const rows = cases.filter(
    (c) =>
      filter === "All cases" ||
      !c.review ||
      c.review.status === "open" ||
      c.review.status === "contacted",
  );
  const missingProof = subscriptions.filter(
    (s) =>
      s.status === "canceled" && (!s.canceledAt || !providerConfirmation(s)),
  );
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      title="Cancellation Watch"
      subtitle="Review imported charges that appear after a cancellation you recorded as provider-confirmed."
      back
    >
      <View style={{ gap: 24 }}>
        <PaymentSettingState
          loaded={ledger.loaded}
          error={ledger.error}
          reload={ledger.reload}
        />
        <PaymentSettingState
          loaded={reviews.loaded}
          error={reviews.error}
          reload={reviews.reload}
        />
        <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
          <Button
            variant="secondary"
            onPress={() => router.push("/payments/statement")}
          >
            Import a newer statement
          </Button>
          <Button
            variant="ghost"
            onPress={() => router.push("/payments/radar")}
          >
            Review transaction matches
          </Button>
        </View>
        <Label size={13}>
          Watch checks matched charges in the same currency after the later of
          your cancellation date and recorded paid-through date. Flags are
          requests to review evidence, not confirmed billing errors.
        </Label>
        {missingProof.length ? (
          <View style={{ gap: 12 }}>
            <Heading size={22}>Add the missing confirmation</Heading>
            {missingProof.map((s) => (
              <View key={s.id} style={{ gap: 8 }}>
                <Label>
                  {s.name} is marked canceled, but needs a recorded date and
                  provider confirmation reference.
                </Label>
                <Button
                  small
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: "/cancellation",
                      params: { subscriptionId: s.id },
                    })
                  }
                >
                  {"Record confirmation for " + s.name}
                </Button>
              </View>
            ))}
          </View>
        ) : null}
        <Chips
          values={["Needs review", "All cases"] as const}
          selected={filter}
          onChange={(value) => {
            setFilter(value);
            setVisible(20);
          }}
        />
        {ledger.loaded && reviews.loaded && !rows.length ? (
          <View style={{ gap: 10 }}>
            <Heading size={23}>No matching charges to review.</Heading>
            <Label>
              {cases.length
                ? "All current cases have been reviewed. Switch to All cases to see them."
                : "As you import newer statements and confirm transaction matches, potential post-cancellation charges will appear here."}
            </Label>
          </View>
        ) : null}
        {rows.slice(0, visible).map((entry) => {
          const { subscription: s, transaction: t } = entry,
            url = cancellationGuide(s);
          return (
            <Card key={t.id}>
              <View style={{ gap: 12 }}>
                <Heading size={22}>{s.name}</Heading>
                <Label>
                  {formatMoney(t.amountMinor, t.currency)} {t.currency} ·
                  imported charge on {t.date}
                </Label>
                <Label size={13}>
                  Recorded cancellation: {s.canceledAt} · review cutoff:{" "}
                  {entry.cutoff}
                </Label>
                <Label size={13}>
                  Your confirmation reference: {entry.confirmation}
                </Label>
                <Label bold>{entry.review?.status ?? "open"}</Label>
                {entry.review?.note ? <Label>{entry.review.note}</Label> : null}
                {entry.credits.length ? (
                  <Label>
                    {entry.credits.length} later credit{" "}
                    {entry.credits.length === 1 ? "record" : "records"} found.
                    Review whether they relate to this charge before marking it
                    resolved.
                  </Label>
                ) : null}
                <View
                  style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}
                >
                  <Button
                    small
                    disabled={!reviews.loaded || demo}
                    onPress={() => {
                      setSelected(entry);
                      setStatus(entry.review?.status ?? "open");
                      setNote(entry.review?.note ?? "");
                    }}
                  >
                    Review this case
                  </Button>
                  <Button
                    small
                    variant="secondary"
                    loading={busy}
                    onPress={() =>
                      void run(() =>
                        shareText(
                          cancellationEvidence(entry, new Date().toISOString()),
                          `subloom-cancellation-${t.date}-${t.id.slice(0, 8)}.txt`,
                          "text/plain",
                        ),
                      )
                    }
                  >
                    Export evidence packet
                  </Button>
                  {url ? (
                    <Button
                      small
                      variant="ghost"
                      onPress={() => void run(() => Linking.openURL(url))}
                    >
                      Open provider account
                    </Button>
                  ) : null}
                </View>
              </View>
            </Card>
          );
        })}
        {rows.length > visible ? (
          <Button variant="secondary" onPress={() => setVisible((v) => v + 20)}>
            Show more cases
          </Button>
        ) : null}
        {error ? <Label accessibilityRole="alert">{error}</Label> : null}
        <Label size={13}>
          Subloom does not contact the provider or bank, submit disputes, or
          guarantee a refund. Credits and fees require your review.
        </Label>
      </View>
      <Confirm
        visible={selected !== null}
        title="Update cancellation review"
        body="Record the outcome of your own review. This does not change the merchant’s billing state or submit a dispute."
        action="Save case review"
        onClose={() => setSelected(null)}
        onConfirm={async () => {
          if (!selected) return;
          await reviews.save([
            ...reviews.value.filter(
              (r) => r.transactionId !== selected.transaction.id,
            ),
            {
              transactionId: selected.transaction.id,
              status,
              note,
              updatedAt: new Date().toISOString(),
            },
          ]);
          notify("Cancellation review saved.");
        }}
      >
        <SelectField
          label="Review status"
          value={status}
          options={watchStatuses.map((value) => ({
            value,
            label: {
              open: "Still needs review",
              contacted: "I contacted the provider",
              resolved: "I confirmed this is resolved",
              expected: "I confirmed this charge was expected",
            }[value],
          }))}
          onChange={setStatus}
        />
        <Field
          label="Review note (optional)"
          value={note}
          onChangeText={setNote}
          maxLength={300}
          multiline
        />
      </Confirm>
    </Page>
  );
}
export default function CancellationWatch() {
  const identity = useApp((s) => s.identity);
  return <Watch key={identity} />;
}
