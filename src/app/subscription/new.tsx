import { useLocalSearchParams } from "expo-router";
import { Page } from "../../components/ui/Primitives";
import { SubscriptionForm } from "../../features/SubscriptionForm";
import { quickAddDates } from "../../domain/calendarEvents";
import { dateLabel, today } from "../../domain/renewal";
import { useApp } from "../../store/app";

export default function NewSubscription() {
  const { date } = useLocalSearchParams<{ date?: string | string[] }>();
  const timezone = useApp((state) => state.data.preferences.timezone);
  const defaults = quickAddDates(date, today(timezone));
  return (
    <Page
      title="Add a subscription."
      subtitle={
        date
          ? `Renewal date: ${dateLabel(defaults.nextRenewal, { month: "long", day: "numeric", year: "numeric" })}. Review the details before saving.`
          : "A few details today. Fewer surprises tomorrow."
      }
      back
    >
      <SubscriptionForm
        key={defaults.nextRenewal}
        defaultRenewalDate={defaults.nextRenewal}
      />
    </Page>
  );
}
