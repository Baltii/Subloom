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
        "Exchange rates will be available after the backend is configured.",
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
        warning: "The daily rate refresh has not populated the database yet.",
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
