import { currencies } from "../../../src/domain/models.ts";
import { parseProviderRates, providerRatesUrl } from "../_shared/exchange-rates.ts";
const now = new Date("2026-10-14T17:30:00Z");
const response = currencies.filter((currency) => currency !== "USD")
  .map((quote) => ({ base: "USD", quote, date: "2026-10-14", rate: 1.23 }));
Deno.test("reference rates retain provider dates and decimal precision", () => {
  const rows = parseProviderRates(response, now);
  if (
    rows.length !== currencies.length - 1 ||
    rows[0]?.rate !== "1.230000000000" ||
    rows[0]?.as_of !== "2026-10-14"
  )
    throw new Error("Wrong rate conversion");
});
Deno.test("provider requests use the UTC date and include every supported quote", () => {
  const url = new URL(providerRatesUrl(new Date("2026-10-26T01:00:00+05:30")));
  if (url.searchParams.get("date") !== "2026-10-25" ||
    url.searchParams.get("quotes")?.split(",").length !== currencies.length - 1)
    throw new Error("The provider request must exclude future observations and cover all currencies");
});
Deno.test(
  "partial, duplicate, invalid and future rates cannot replace the cache",
  () => {
    for (const input of [
      response.slice(1),
      [...response, response[0]],
      response.map((r) => ({ ...r, date: "2027-01-01" })),
      response.map((r) => ({ ...r, rate: 0 })),
      response.map((r) => ({ ...r, date: "2026-01-01" })),
      response.map((r) => ({ ...r, rate: 1e-15 })),
    ]) {
      let rejected = false;
      try {
        parseProviderRates(input, now);
      } catch {
        rejected = true;
      }
      if (!rejected) throw new Error("Invalid response accepted");
    }
  },
);
