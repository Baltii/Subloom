import { categories, currencies, intervals } from "../../domain/models";
import { ianaTimezones } from "../../domain/timezones";

const currencyNames: Record<(typeof currencies)[number], string> = {
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  CAD: "Canadian Dollar",
  AUD: "Australian Dollar",
  TND: "Tunisian Dinar",
  JPY: "Japanese Yen",
  CHF: "Swiss Franc",
  AED: "United Arab Emirates Dirham",
  INR: "Indian Rupee",
  CNY: "Chinese Yuan",
  HKD: "Hong Kong Dollar",
  NZD: "New Zealand Dollar",
  SGD: "Singapore Dollar",
  KRW: "South Korean Won",
  SEK: "Swedish Krona",
  NOK: "Norwegian Krone",
  DKK: "Danish Krone",
  PLN: "Polish Zloty",
  CZK: "Czech Koruna",
  HUF: "Hungarian Forint",
  RON: "Romanian Leu",
  TRY: "Turkish Lira",
  BRL: "Brazilian Real",
  MXN: "Mexican Peso",
  ZAR: "South African Rand",
  SAR: "Saudi Riyal",
  QAR: "Qatari Riyal",
  KWD: "Kuwaiti Dinar",
  BHD: "Bahraini Dinar",
  OMR: "Omani Rial",
  EGP: "Egyptian Pound",
  MAD: "Moroccan Dirham",
  DZD: "Algerian Dinar",
  JOD: "Jordanian Dinar",
  IDR: "Indonesian Rupiah",
  MYR: "Malaysian Ringgit",
  THB: "Thai Baht",
  PHP: "Philippine Peso",
  VND: "Vietnamese Dong",
  PKR: "Pakistani Rupee",
  BDT: "Bangladeshi Taka",
  LKR: "Sri Lankan Rupee",
  NPR: "Nepalese Rupee",
  NGN: "Nigerian Naira",
  KES: "Kenyan Shilling",
  GHS: "Ghanaian Cedi",
  UAH: "Ukrainian Hryvnia",
  ILS: "Israeli New Shekel",
  ISK: "Icelandic Króna",
  CLP: "Chilean Peso",
  COP: "Colombian Peso",
  PEN: "Peruvian Sol",
  ARS: "Argentine Peso",
  XOF: "West African CFA Franc",
  XAF: "Central African CFA Franc",
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
  let supported: string[] = [];
  try {
    supported =
      (
        Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
      ).supportedValuesOf?.("timeZone") || [];
  } catch {
    /* Older native runtimes can have only a partial Intl implementation. */
  }
  return [...new Set([current, ...ianaTimezones, ...supported])]
    .filter(
      (value) =>
        value === current || (value.includes("/") && !value.startsWith("Etc/")),
    )
    .sort()
    .map((value) => ({
      value,
      label:
        value === "UTC" || value === "Etc/UTC" || value === "GMT"
          ? "Universal time"
          : (value.includes("/")
              ? value.split("/").slice(1).join(" / ")
              : value
            ).replaceAll("_", " "),
      detail: value.replaceAll("_", " ").replaceAll("/", " / "),
    }));
}
