import { describe, expect, it } from "vitest";
import { defaultPreferences, preferencesSchema } from "../../src/domain/models";
import { accentThemes, getThemeColors } from "../../src/theme/palettes";

function luminance(hex: string) {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}
describe("accent accessibility", () => {
  for (const { id } of accentThemes)
    for (const isDark of [false, true]) {
      it(`${id} ${isDark ? "dark" : "light"} keeps reading, controls and feedback legible`, () => {
        const c = getThemeColors(id, isDark);
        const pairs = [
          [c.text, c.background],
          [c.secondary, c.background],
          [c.faint, c.background],
          [c.text, c.surface],
          [c.secondary, c.surface],
          [c.primary, c.surface],
          [c.primary, c.mint],
          [c.onPrimary, c.primary],
          [c.onPrimary, c.pressed],
          [c.heroText, c.hero],
          [c.heroSecondary, c.hero],
          [c.onSpotlight, c.spotlight],
          [c.spotlightSecondary, c.spotlight],
          [c.success, c.successBg],
          [c.error, c.errorBg],
          [c.warning, c.warningBg],
          [c.text, c.successBg],
          [c.text, c.errorBg],
        ];
        for (const [foreground, background] of pairs) {
          expect(
            contrast(foreground!, background!),
            `${foreground} on ${background}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
});
it("loads pre-theme preferences without losing the owner's appearance or financial settings", () => {
  const old = {
    ...defaultPreferences(),
    appearance: "dark",
    currency: "EUR",
    timezone: "Europe/Paris",
  };
  const { accentTheme: _, ...withoutAccent } = old;
  expect(preferencesSchema.parse(withoutAccent)).toMatchObject({
    accentTheme: "green",
    appearance: "dark",
    currency: "EUR",
    timezone: "Europe/Paris",
  });
  expect(
    preferencesSchema.safeParse({ ...old, accentTheme: "unknown" }).success,
  ).toBe(false);
});
