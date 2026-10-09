import type { Category } from "./models.ts";
export type Service = {
  id: string;
  name: string;
  category: Category;
  color: string;
  background: string;
  glyph: string;
  managementUrl: string | null;
};
// No suggested prices. Provider links only go to first-party account pages.
export const catalog: Service[] = [
  {
    id: "netflix",
    name: "Netflix",
    category: "Entertainment",
    color: "#E50914",
    background: "#171717",
    glyph: "N",
    managementUrl: "https://www.netflix.com/YourAccount",
  },
  {
    id: "spotify",
    name: "Spotify",
    category: "Music",
    color: "#1ED760",
    background: "#18251C",
    glyph: "spotify",
    managementUrl: "https://www.spotify.com/account/subscription/",
  },
  {
    id: "youtube",
    name: "YouTube Premium",
    category: "Entertainment",
    color: "#FF0033",
    background: "#FFF1F2",
    glyph: "youtube",
    managementUrl: "https://www.youtube.com/paid_memberships",
  },
  {
    id: "icloud",
    name: "iCloud+",
    category: "Cloud & storage",
    color: "#3687EC",
    background: "#ECF5FF",
    glyph: "cloud",
    managementUrl: "https://support.apple.com/en-us/118428",
  },
  {
    id: "google",
    name: "Google One",
    category: "Cloud & storage",
    color: "#4285F4",
    background: "#F2F5FF",
    glyph: "G",
    managementUrl: "https://one.google.com/settings",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    category: "Productivity",
    color: "#25866C",
    background: "#EAF5EF",
    glyph: "spark",
    managementUrl: "https://chatgpt.com/#settings/Account",
  },
  {
    id: "adobe",
    name: "Adobe Creative Cloud",
    category: "Productivity",
    color: "#E83B33",
    background: "#FFF1ED",
    glyph: "A",
    managementUrl: "https://account.adobe.com/plans",
  },
  {
    id: "microsoft",
    name: "Microsoft 365",
    category: "Productivity",
    color: "#3378B8",
    background: "#EAF3FB",
    glyph: "grid",
    managementUrl: "https://account.microsoft.com/services",
  },
  {
    id: "amazon",
    name: "Amazon Prime",
    category: "Entertainment",
    color: "#219BCC",
    background: "#EDF8FC",
    glyph: "a",
    managementUrl: "https://www.amazon.com/prime",
  },
  {
    id: "notion",
    name: "Notion",
    category: "Productivity",
    color: "#242424",
    background: "#F2F0ED",
    glyph: "N",
    managementUrl: "https://www.notion.so/settings",
  },
  {
    id: "figma",
    name: "Figma",
    category: "Productivity",
    color: "#7755CD",
    background: "#F2EEFC",
    glyph: "figma",
    managementUrl: "https://www.figma.com/settings",
  },
  {
    id: "gym",
    name: "Gym membership",
    category: "Health & fitness",
    color: "#BD7945",
    background: "#FCF0E5",
    glyph: "gym",
    managementUrl: null,
  },
];
export function serviceFor(id: string | null) {
  return catalog.find((s) => s.id === id);
}
