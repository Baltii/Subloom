import type { AccentTheme } from "../domain/models";
import { dark, light } from "./tokens";

export const accentThemes: { id: AccentTheme; name: string; swatch: string }[] =
  [
    { id: "green", name: "Green", swatch: "#087C65" },
    { id: "blue", name: "Blue", swatch: "#3478EE" },
    { id: "red", name: "Red", swatch: "#E34D54" },
    { id: "violet", name: "Violet", swatch: "#8B5CF6" },
    { id: "orange", name: "Orange", swatch: "#F58B36" },
    { id: "yellow", name: "Yellow", swatch: "#F4D35E" },
    { id: "pink", name: "Pink", swatch: "#E56AA3" },
    { id: "mono", name: "Black & white", swatch: "#252525" },
  ];

type AccentColors = Pick<
  typeof light,
  | "primary"
  | "accent"
  | "pressed"
  | "mint"
  | "mintStrong"
  | "hero"
  | "heroText"
  | "heroSecondary"
  | "heroArt"
>;
type ColorPair = { light: AccentColors; dark: AccentColors };
const palettes: Record<AccentTheme, ColorPair> = {
  green: { light, dark },
  blue: {
    light: {
      primary: "#245CC0",
      accent: "#3478EE",
      pressed: "#1C4694",
      mint: "#EDF3FF",
      mintStrong: "#DBE7FF",
      hero: "#E5EEFF",
      heroText: "#203B6B",
      heroSecondary: "#47618A",
      heroArt: "#94B4EB",
    },
    dark: {
      primary: "#9AC2FF",
      accent: "#3478EE",
      pressed: "#BCD7FF",
      mint: "#21314B",
      mintStrong: "#2D4263",
      hero: "#243958",
      heroText: "#EDF4FF",
      heroSecondary: "#BAD0EC",
      heroArt: "#557CA9",
    },
  },
  red: {
    light: {
      primary: "#B8313D",
      accent: "#E34D54",
      pressed: "#942532",
      mint: "#FFF0F1",
      mintStrong: "#FADCE0",
      hero: "#FCE6E8",
      heroText: "#702B34",
      heroSecondary: "#8B4850",
      heroArt: "#EAA0A7",
    },
    dark: {
      primary: "#FFA5AC",
      accent: "#E34D54",
      pressed: "#FFC3C8",
      mint: "#43272D",
      mintStrong: "#59343D",
      hero: "#4D2C34",
      heroText: "#FFF0F1",
      heroSecondary: "#EFC0C5",
      heroArt: "#A05C69",
    },
  },
  violet: {
    light: {
      primary: "#6D42BC",
      accent: "#8B5CF6",
      pressed: "#543197",
      mint: "#F4EFFF",
      mintStrong: "#E9DDFF",
      hero: "#EDE5FC",
      heroText: "#492A76",
      heroSecondary: "#6A508B",
      heroArt: "#B69ADE",
    },
    dark: {
      primary: "#C5ACFF",
      accent: "#8B5CF6",
      pressed: "#DCCEFA",
      mint: "#342943",
      mintStrong: "#49395D",
      hero: "#3D2E52",
      heroText: "#F4EFFF",
      heroSecondary: "#D3C1EF",
      heroArt: "#8067A8",
    },
  },
  orange: {
    light: {
      primary: "#A84C10",
      accent: "#F58B36",
      pressed: "#823907",
      mint: "#FFF3E9",
      mintStrong: "#FFE3CD",
      hero: "#FFEBD9",
      heroText: "#743916",
      heroSecondary: "#855331",
      heroArt: "#E7AB7B",
    },
    dark: {
      primary: "#FFB77E",
      accent: "#F58B36",
      pressed: "#FFD0AA",
      mint: "#422E21",
      mintStrong: "#59412D",
      hero: "#4D3525",
      heroText: "#FFF3E9",
      heroSecondary: "#EFCBAF",
      heroArt: "#A47854",
    },
  },
  yellow: {
    light: {
      primary: "#84620C",
      accent: "#F4D35E",
      pressed: "#664A04",
      mint: "#FFF9E4",
      mintStrong: "#F6EAB9",
      hero: "#FAF0C9",
      heroText: "#5B4615",
      heroSecondary: "#76602C",
      heroArt: "#CCB468",
    },
    dark: {
      primary: "#F4D35E",
      accent: "#F4D35E",
      pressed: "#FFE59B",
      mint: "#3A3320",
      mintStrong: "#51482B",
      hero: "#453D22",
      heroText: "#FFF9E4",
      heroSecondary: "#E9D9A4",
      heroArt: "#968650",
    },
  },
  pink: {
    light: {
      primary: "#AC386F",
      accent: "#E56AA3",
      pressed: "#862650",
      mint: "#FFF0F7",
      mintStrong: "#FAD9E9",
      hero: "#FCE6F1",
      heroText: "#732D4E",
      heroSecondary: "#8A4A69",
      heroArt: "#E4A0C1",
    },
    dark: {
      primary: "#F7AED0",
      accent: "#E56AA3",
      pressed: "#FFD0E4",
      mint: "#402A36",
      mintStrong: "#583A4B",
      hero: "#4C3040",
      heroText: "#FFF0F7",
      heroSecondary: "#EBC2D6",
      heroArt: "#A36785",
    },
  },
  mono: {
    light: {
      primary: "#252525",
      accent: "#252525",
      pressed: "#454545",
      mint: "#F0F0EF",
      mintStrong: "#E2E2DF",
      hero: "#EBEBE8",
      heroText: "#252525",
      heroSecondary: "#5C5C58",
      heroArt: "#B9B9B4",
    },
    dark: {
      primary: "#F4F4F2",
      accent: "#F4F4F2",
      pressed: "#DADAD6",
      mint: "#2C2C2B",
      mintStrong: "#3E3E3C",
      hero: "#343432",
      heroText: "#F4F4F2",
      heroSecondary: "#C6C6C0",
      heroArt: "#73736D",
    },
  },
};

// Precompute stable semantic maps. Feedback colors stay independent of accent.
const themeColors = Object.fromEntries(
  accentThemes.map(({ id }) => [
    id,
    {
      light:
        id === "green"
          ? light
          : {
              ...light,
              background: "#FAFAF9",
              text: "#242624",
              secondary: "#5F655F",
              faint: "#656B65",
              border: "#E6E8E4",
              spotlight: "#242624",
              ...palettes[id].light,
            },
      dark:
        id === "green"
          ? dark
          : {
              ...dark,
              background: "#131513",
              surface: "#1E211E",
              sidebar: "#191C19",
              text: "#F1F3EF",
              secondary: "#B0B7AB",
              faint: "#969F91",
              border: "#363B34",
              spotlight: "#F1F3EF",
              onSpotlight: "#242624",
              ...palettes[id].dark,
            },
    },
  ]),
) as Record<AccentTheme, { light: typeof light; dark: typeof light }>;

export function getThemeColors(accent: AccentTheme, isDark: boolean) {
  return themeColors[accent][isDark ? "dark" : "light"];
}
