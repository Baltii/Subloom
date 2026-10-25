import { expect, it } from "vitest";
import {
  currencyOptions,
  timezoneOffset,
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
it("labels timezones with signed UTC offsets including fractional hours and daylight saving", () => {
  expect(timezoneOffset("UTC")).toBe("UTC+00:00");
  expect(timezoneOffset("Africa/Tunis")).toBe("UTC+01:00");
  expect(timezoneOffset("Asia/Kolkata")).toBe("UTC+05:30");
  expect(
    timezoneOffset("America/New_York", new Date("2026-01-15T12:00:00Z")),
  ).toBe("UTC-05:00");
  expect(
    timezoneOffset("America/New_York", new Date("2026-07-15T12:00:00Z")),
  ).toBe("UTC-04:00");
  expect(
    timezoneOptions("Africa/Tunis").find(
      (option) => option.value === "Africa/Tunis",
    )?.label,
  ).toContain("UTC+01:00");
});
