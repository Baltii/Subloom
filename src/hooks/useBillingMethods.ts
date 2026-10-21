import { useMemo } from "react";
import { emptyPaymentProfile, paymentProfileSchema } from "../domain/payments";
import { useFeatureSetting } from "./useFeatureSetting";

export function useBillingMethods() {
  const setting = useFeatureSetting(
    "payment_sources",
    paymentProfileSchema,
    emptyPaymentProfile,
  );
  const byId = useMemo(
    () => new Map(setting.value.sources.map((source) => [source.id, source])),
    [setting.value.sources],
  );
  return { ...setting, byId };
}
