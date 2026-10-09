import { useLocalSearchParams } from "expo-router";
import { useApp } from "../../store/app";
import { Empty, Page } from "../../components/ui/Primitives";
import { SubscriptionForm } from "../../features/SubscriptionForm";
export default function EditSubscription() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    subscription = useApp((s) =>
      s.data.subscriptions.find((sub) => sub.id === id),
    );
  return (
    <Page title="Edit subscription." back>
      {subscription ? (
        <SubscriptionForm initial={subscription} />
      ) : (
        <Empty
          title="Subscription not found."
          body="It may have been deleted on another device."
        />
      )}
    </Page>
  );
}
