import {
  admin,
  endpoint,
  json,
  requireCron,
  providerJson,
  HttpError,
} from "../_shared/http.ts";
import { parseProviderRates } from "../_shared/exchange-rates.ts";
export const handler = endpoint(async (req) => {
  requireCron(req);
  const response = await providerJson(
    "https://api.frankfurter.dev/v2/rates?base=USD&quotes=EUR,GBP,CAD,AUD,TND,JPY,CHF,AED,INR",
    {},
    32000,
  );
  let rows;
  try {
    rows = parseProviderRates(response);
  } catch {
    throw new HttpError(
      502,
      "The exchange-rate provider returned incomplete or invalid rates. Existing rates were kept.",
    );
  }
  const { error } = await admin()
    .from("exchange_rates")
    .upsert(rows, { onConflict: "base_currency,quote_currency,as_of" });
  if (error)
    throw new HttpError(
      503,
      "Could not store exchange rates. Existing rates were kept.",
    );
  return json({ stored: rows.length, provider: "frankfurter" });
});
Deno.serve(handler);
