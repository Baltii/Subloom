import { useLocalSearchParams } from "expo-router";
import { useApp } from "../../store/app";
import { Empty, Page } from "../../components/ui/Primitives";
import { SubscriptionForm } from "../../features/SubscriptionForm";
export default function EditSubscription() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    subscription = useApp((s) =>
      s.data.subscriptions.find((sub) => sub.id === id),
    );
  return subscription ? (
    <SubscriptionForm
      initial={subscription}
      page={{ title: "Edit " + subscription.name }}
    />
  ) : (
    <Page title="Edit subscription" back>
      <Empty
        title="Subscription not found."
        body="It may have been deleted on another device."
      />
    </Page>
  );
}
