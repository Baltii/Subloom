import { z } from "zod";
import { exchangeRateSchema } from "../domain/exchangeRates";
import { localSetting } from "./featureSettings";
import { supabase } from "./supabase";
const schema = z.array(exchangeRateSchema).max(10);
export async function loadExchangeRates() {
  let cached: z.infer<typeof schema> = [];
  try {
    const raw = await localSetting("public", "exchange_rates");
    if (raw) cached = schema.parse(JSON.parse(raw));
  } catch {
    /* A corrupt cache must not block fresh rates. */
  }
  if (!supabase)
    return {
      rates: cached,
      warning:
        "Currency estimates are not available yet. Original amounts are shown.",
    };
  try {
    const { data, error } = await supabase
      .from("latest_exchange_rates")
      .select("*")
      .limit(10);
    if (error) throw error;
    const rates = schema.parse(data);
    if (!rates.length)
      return {
        rates: cached,
        warning: "No exchange rates are available yet. Try again later.",
      };
    try {
      await localSetting("public", "exchange_rates", JSON.stringify(rates));
    } catch {
      /* Rates remain usable if cache storage is unavailable. */
    }
    return { rates, warning: null };
  } catch {
    return {
      rates: cached,
      warning:
        "Could not refresh rates. Showing cached estimates where available.",
    };
  }
}
