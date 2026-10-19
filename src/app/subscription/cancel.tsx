import { useState } from "react";
import { Linking, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ExternalLink } from "lucide-react-native";
import type { Subscription } from "../../domain/models";
import { serviceFor } from "../../domain/catalog";
import {
  cancellationInstructions,
  storeCancellationInstructions,
} from "../../domain/cancellationInstructions";
import { useApp } from "../../store/app";
import { useTheme } from "../../theme/useTheme";
import {
  Button,
  Card,
  Chips,
  Empty,
  Heading,
  Label,
  Page,
} from "../../components/ui/Primitives";
import { ServiceIcon } from "../../components/subscriptions/ServiceIcon";

const billingSources = ["Service", "Apple", "Google Play"] as const;
type BillingSource = (typeof billingSources)[number];

function Guide({ subscription: s }: { subscription: Subscription }) {
  const { colors } = useTheme();
  const [billingSource, setBillingSource] = useState<BillingSource>(
    s.serviceId === "applemusic" || s.serviceId === "appletv"
      ? "Apple"
      : "Service",
  );
  const [error, setError] = useState<string | null>(null);
  const instructions = cancellationInstructions(s.serviceId);
  const store =
    billingSource === "Service"
      ? null
      : storeCancellationInstructions[billingSource];
  const service = serviceFor(s.serviceId);
  const steps = store?.steps ?? instructions.steps;
  const sourceUrl = store?.sourceUrl ?? instructions.sourceUrl;

  function openWebsite(url: string) {
    setError(null);
    void Linking.openURL(url).catch(() =>
      setError(
        "The website could not open. Check your connection and try again.",
      ),
    );
  }

  return (
    <View
      style={{ width: "100%", maxWidth: 720, alignSelf: "center", gap: 24 }}
    >
      <Card style={{ gap: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <ServiceIcon serviceId={s.serviceId} name={s.name} size={52} />
          <View style={{ flex: 1, gap: 4 }}>
            <Heading size={22}>{s.name}</Heading>
            <Label size={13} color={colors.secondary}>
              {service && service.name !== s.name
                ? "Guide for " + service.name
                : "Follow these steps with your billing provider."}
            </Label>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Label bold>Who bills this subscription?</Label>
          <Chips
            values={billingSources}
            selected={billingSource}
            onChange={(value) => {
              setBillingSource(value);
              setError(null);
            }}
          />
          <Label size={12} color={colors.secondary}>
            Check your receipt if you’re unsure. For a bundle or another billing
            partner, follow that company’s cancellation process.
          </Label>
        </View>

        <View style={{ gap: 20 }}>
          <Heading size={18}>
            {store ? "Cancel through " + billingSource : "Cancellation steps"}
          </Heading>
          {!store && instructions.general && (
            <Label size={13} color={colors.secondary}>
              General guidance for {service?.name ?? "this service"}. The exact
              process depends on your provider and plan.
            </Label>
          )}
          {steps.map((step, index) => (
            <View
              key={step}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 14,
              }}
            >
              <Label bold color={colors.primary} style={{ width: 20 }}>
                {index + 1}.
              </Label>
              <Label style={{ flex: 1 }}>{step}</Label>
            </View>
          ))}
          {!store && instructions.note && (
            <Label size={13} color={colors.secondary}>
              {instructions.note}
            </Label>
          )}
        </View>

        <View style={{ gap: 10 }}>
          {instructions.websiteUrl ? (
            <>
              <Button
                icon={ExternalLink}
                testID="cancellation-visit-website"
                onPress={() => openWebsite(instructions.websiteUrl!)}
              >
                Visit website
              </Button>
              <Label
                size={12}
                color={colors.secondary}
                style={{ textAlign: "center" }}
              >
                {new URL(instructions.websiteUrl).hostname}
              </Label>
            </>
          ) : (
            <Label size={13} color={colors.secondary}>
              {s.serviceId === "gym"
                ? "Use your gym’s official website or contact your club. A specific gym website is not linked to this record."
                : "No official website is linked to this custom service. Choose a service from the catalog when editing to see its website and guide."}
            </Label>
          )}
          {store && (
            <Button
              variant="secondary"
              icon={ExternalLink}
              onPress={() => openWebsite(store.manageUrl)}
            >
              {"Open " + billingSource + " subscriptions"}
            </Button>
          )}
          {sourceUrl && sourceUrl !== instructions.websiteUrl && (
            <Button
              variant="ghost"
              icon={ExternalLink}
              onPress={() => openWebsite(sourceUrl)}
            >
              {store || !instructions.general
                ? "Read official instructions"
                : "Open provider help"}
            </Button>
          )}
          {!service && (
            <Button
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/subscription/edit",
                  params: { id: s.id },
                })
              }
            >
              Edit subscription
            </Button>
          )}
          {error && (
            <Label accessibilityRole="alert" color={colors.error} size={13}>
              {error}
            </Label>
          )}
        </View>
      </Card>
      <Label size={12} color={colors.secondary}>
        Complete cancellation with your provider and keep its confirmation.
        Opening this guide does not change your subscription or stop billing.
        Provider screens and terms can change; use the official instructions if
        they differ.
      </Label>
    </View>
  );
}

export default function CancellationGuide() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const identity = useApp((state) => state.identity);
  const subscription = useApp((state) =>
    typeof params.id === "string"
      ? state.data.subscriptions.find((row) => row.id === params.id)
      : undefined,
  );
  return (
    <Page
      title="How to cancel"
      subtitle="Find the right steps for your subscription."
      back
    >
      {subscription ? (
        <Guide
          key={identity + subscription.id + subscription.serviceId}
          subscription={subscription}
        />
      ) : (
        <Empty
          title="Subscription not found."
          body="This record may have been removed or belongs to a different workspace. Open a subscription to view its guide."
        />
      )}
    </Page>
  );
}
