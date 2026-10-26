import { expect, it, vi } from "vitest";
import {
  currencyOptions,
  timezoneOptions,
} from "../../src/components/ui/pickerOptions";
import { currencies } from "../../src/domain/models";

it("names every supported currency for searchable pickers", () => {
  expect(currencyOptions).toHaveLength(56);
  expect(currencyOptions.map((option) => option.value)).toEqual([
    ...currencies,
  ]);
  expect(currencyOptions.every((option) => Boolean(option.detail))).toBe(true);
  expect(
    currencyOptions.find((option) => option.value === "SAR")?.detail,
  ).toMatch(/Saudi/);
});
it("offers the complete geographic timezone list without UTC offsets on native fallback runtimes", () => {
  vi.stubGlobal("Intl", { ...Intl, supportedValuesOf: undefined });
  try {
    const options = timezoneOptions("Africa/Tunis");
    expect(options.length).toBeGreaterThan(500);
    for (const zone of [
      "Africa/Tunis",
      "Asia/Kolkata",
      "Asia/Kathmandu",
      "Pacific/Chatham",
      "America/Argentina/Ushuaia",
      "Antarctica/McMurdo",
      "America/Coyhaique",
    ]) {
      expect(options.some((option) => option.value === zone)).toBe(true);
    }
    expect(
      options.find((option) => option.value === "Africa/Tunis")?.label,
    ).toBe("Tunis");
    expect(options.every((option) => !option.label.includes("UTC"))).toBe(true);
    expect(options.some((option) => option.value === "UTC")).toBe(false);
    expect(new Set(options.map((option) => option.value)).size).toBe(
      options.length,
    );
  } finally {
    vi.unstubAllGlobals();
  }
});
