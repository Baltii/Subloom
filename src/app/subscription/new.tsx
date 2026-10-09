import { Page } from "../../components/ui/Primitives";
import { SubscriptionForm } from "../../features/SubscriptionForm";
export default function NewSubscription() {
  return (
    <Page
      title="Add a subscription."
      subtitle="A few details today. Fewer surprises tomorrow."
      back
    >
      <SubscriptionForm />
    </Page>
  );
}
