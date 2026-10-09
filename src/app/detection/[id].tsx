import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { useApp, dismissCandidate, readableError } from "../../store/app";
import {
  Badge,
  Button,
  Card,
  Empty,
  Heading,
  Label,
  Page,
} from "../../components/ui/Primitives";
import { SubscriptionForm } from "../../features/SubscriptionForm";
import { useTheme } from "../../theme/useTheme";
import { confidenceLevel } from "../../domain/detection";
export default function DetectionReview() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { colors } = useTheme(),
    data = useApp((s) => s.data),
    candidate = data.candidates.find((c) => c.id === id);
  const [update, setUpdate] = useState(true),
    [error, setError] = useState<string | null>(null);
  const matched = candidate?.matchedSubscriptionId
    ? data.subscriptions.find((s) => s.id === candidate.matchedSubscriptionId)
    : undefined;
  return (
    <Page
      title="A receipt worth a look."
      subtitle="Check the details. Keep what’s useful."
      back
    >
      {candidate?.state === "pending" ? (
        <View style={{ gap: 20 }}>
          <Card
            style={{
              maxWidth: 780,
              width: "100%",
              alignSelf: "center",
              gap: 12,
            }}
          >
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Badge
                tone={
                  confidenceLevel(candidate.confidence) === "high"
                    ? "green"
                    : "warning"
                }
              >
                {confidenceLevel(candidate.confidence) === "high"
                  ? "Ready to review"
                  : confidenceLevel(candidate.confidence) === "medium"
                    ? "Check uncertain details"
                    : "Needs a closer look"}
              </Badge>
              <Badge tone="neutral">
                {Math.round(candidate.confidence * 100)}% parser confidence
              </Badge>
            </View>
            <Label size={12} color={colors.secondary}>
              {candidate.kind.replace("_", " ")} ·{" "}
              {candidate.source.replace("_", " ")}
            </Label>
            {["one_time", "refund", "cancellation", "unknown"].includes(
              candidate.kind,
            ) && (
              <Label color={colors.warning}>
                This receipt does not clearly describe a new recurring
                subscription. Dismiss it unless you can confirm otherwise.
              </Label>
            )}
            {matched && (
              <>
                <Heading size={17}>This may update {matched.name}.</Heading>
                <Label size={12} color={colors.secondary}>
                  Choose whether to update your existing subscription or record
                  a separate plan.
                </Label>
                <View
                  style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}
                >
                  <Button
                    variant={update ? "primary" : "secondary"}
                    onPress={() => setUpdate(true)}
                  >
                    Update existing
                  </Button>
                  <Button
                    variant={!update ? "primary" : "secondary"}
                    onPress={() => setUpdate(false)}
                  >
                    Separate subscription
                  </Button>
                </View>
              </>
            )}
            <Button
              variant="ghost"
              onPress={() => {
                void dismissCandidate(id)
                  .then(() => router.replace("/activity"))
                  .catch((e) => setError(readableError(e)));
              }}
            >
              Dismiss this receipt
            </Button>
            {error && <Label color={colors.error}>{error}</Label>}
          </Card>
          <SubscriptionForm
            key={String(update)}
            candidate={candidate}
            initial={
              update && matched
                ? {
                    ...matched,
                    amountMinor: candidate.amountMinor ?? matched.amountMinor,
                    currency: candidate.currency ?? matched.currency,
                    nextRenewal: candidate.nextRenewal ?? matched.nextRenewal,
                  }
                : undefined
            }
          />
        </View>
      ) : (
        <Empty
          title={
            candidate ? "This receipt has been reviewed." : "Receipt not found."
          }
          body={
            candidate
              ? "Visit Activity to see other pending detections."
              : "It may have been removed or belong to another account."
          }
        />
      )}
    </Page>
  );
}
