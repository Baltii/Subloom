import {
  admin,
  endpoint,
  json,
  requireCron,
  providerJson,
  HttpError,
} from "../_shared/http.ts";
import { parseProviderRates, providerRatesUrl } from "../_shared/exchange-rates.ts";
export const handler = endpoint(async (req) => {
  requireCron(req);
  const now = new Date();
  const response = await providerJson(
    providerRatesUrl(now),
    {},
    32000,
  );
  let rows;
  try {
    rows = parseProviderRates(response, now);
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
