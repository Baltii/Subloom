import { categories, currencies, intervals } from "../../domain/models";

const currencyNames: Record<string, string> = {
  USD: "US dollar",
  EUR: "Euro",
  GBP: "British pound",
  CAD: "Canadian dollar",
  AUD: "Australian dollar",
  TND: "Tunisian dinar",
  JPY: "Japanese yen",
  CHF: "Swiss franc",
  AED: "UAE dirham",
  INR: "Indian rupee",
};
export const currencyOptions = currencies.map((value) => ({
  value,
  label: value,
  detail: currencyNames[value],
}));
export const categoryOptions = categories.map((value) => ({
  value,
  label: value,
}));
const intervalDetails = {
  weekly: "Every week",
  monthly: "Every month",
  quarterly: "Every 3 months",
  yearly: "Every year",
  custom: "Choose your own interval",
};
export const intervalOptions = intervals.map((value) => ({
  value,
  label: value[0]!.toUpperCase() + value.slice(1),
  detail: intervalDetails[value],
}));
export const hourOptions = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: `${String(hour).padStart(2, "0")}:00`,
  detail:
    hour < 12 ? `${hour || 12}:00 AM` : `${hour === 12 ? 12 : hour - 12}:00 PM`,
}));
export function timezoneOptions(current: string) {
  const supported = (
    Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf?.("timeZone") || [
    "Africa/Tunis",
    "America/New_York",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Asia/Tokyo",
    "Asia/Dubai",
    "Australia/Sydney",
  ];
  return [...new Set([current, "UTC", ...supported])]
    .sort()
    .map((value) => ({
      value,
      label: value.replaceAll("_", " "),
      detail: value === "UTC" ? "Coordinated Universal Time" : value,
    }));
}
