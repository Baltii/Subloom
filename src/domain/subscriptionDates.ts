import {
  dateSchema,
  type Candidate,
  type Subscription,
  type Interval,
} from "./models";
import { quickAddDates } from "./calendarEvents";
import { advanceRenewal } from "./renewal";

export function renewalFromStart({
  startDate,
  interval,
  intervalCount = "1",
  customUnit = "day",
  status = "active",
  trialEnd = "",
}: {
  startDate: string;
  interval: Interval | "";
  intervalCount?: string;
  customUnit?: Subscription["customUnit"];
  status?: Subscription["status"];
  trialEnd?: string;
}): string | null {
  if (!dateSchema.safeParse(startDate).success || !interval) return null;
  if (status === "trial" && dateSchema.safeParse(trialEnd).success)
    return trialEnd >= startDate ? trialEnd : null;
  if (!/^[1-9]\d{0,2}$/.test(intervalCount) || Number(intervalCount) > 365)
    return null;
  return advanceRenewal(startDate, {
    interval,
    intervalCount: Number(intervalCount),
    customUnit,
    anchorDay: Number(startDate.slice(-2)),
  });
}

export function subscriptionDateDefaults({
  initial,
  candidate,
  defaultRenewalDate,
  reference,
}: {
  initial?: Subscription;
  candidate?: Candidate;
  defaultRenewalDate?: string;
  reference: string;
}) {
  const explicitDate = dateSchema.safeParse(defaultRenewalDate).success;
  const dates = quickAddDates(defaultRenewalDate, reference);
  return {
    startDate: initial?.startDate || candidate?.chargeDate || dates.startDate,
    nextRenewal:
      initial?.nextRenewal ||
      candidate?.nextRenewal ||
      (candidate
        ? ""
        : explicitDate
          ? dates.nextRenewal
          : renewalFromStart({ startDate: reference, interval: "monthly" })!),
    automaticRenewal: !initial && !candidate && !explicitDate,
  };
}

export function subscriptionRenewalAnchor({
  startDate,
  nextRenewal,
  status,
  automaticRenewal,
  initial,
}: Pick<Subscription, "startDate" | "nextRenewal" | "status"> & {
  automaticRenewal: boolean;
  initial?: Subscription;
}): number {
  if (automaticRenewal)
    return Number((status === "trial" ? nextRenewal : startDate).slice(-2));
  return initial?.nextRenewal === nextRenewal
    ? initial.anchorDay
    : Number(nextRenewal.slice(-2));
}
