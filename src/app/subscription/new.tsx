import { useLocalSearchParams } from "expo-router";
import { SubscriptionForm } from "../../features/SubscriptionForm";
import { quickAddDates } from "../../domain/calendarEvents";
import { dateLabel, today } from "../../domain/renewal";
import { useApp } from "../../store/app";
import { dateSchema } from "../../domain/models";

export default function NewSubscription() {
  const { date } = useLocalSearchParams<{ date?: string | string[] }>();
  const timezone = useApp((state) => state.data.preferences.timezone);
  const defaults = quickAddDates(date, today(timezone));
  return (
    <SubscriptionForm
      key={defaults.nextRenewal}
      defaultRenewalDate={
        typeof date === "string" && dateSchema.safeParse(date).success
          ? date
          : undefined
      }
      page={{
        title: "Add subscription",
        subtitle: date
          ? `Renewal date: ${dateLabel(defaults.nextRenewal, { month: "long", day: "numeric", year: "numeric" })}. Review the details before saving.`
          : "Enter what you pay and when it renews.",
      }}
    />
  );
}
