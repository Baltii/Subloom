import type { Category } from "./models.ts";
export type Service = {
  id: string;
  name: string;
  category: Category;
  color: string;
  background: string;
  glyph: string;
  managementUrl: string | null;
  aliases?: readonly string[];
};
// No suggested prices. Provider links only go to first-party account pages.
export const catalog: Service[] = [
  {
    id: "subloom-pro",
    name: "Subloom Pro",
    category: "Productivity",
    color: "#087C65",
    background: "#E1F0DE",
    glyph: "subloom",
    managementUrl: "https://subloom.baltii.tn/pro",
    aliases: ["Subloom", "Subloom Premium"],
  },
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
    color: "#000000",
    background: "#F2F5F2",
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
  {
    id: "applemusic",
    name: "Apple Music",
    category: "Music",
    color: "#FA243C",
    background: "#F2F5F2",
    glyph: "A",
    aliases: ["Apple Music"],
    managementUrl: null,
  },

  {
    id: "soundcloud",
    name: "SoundCloud Go",
    category: "Music",
    color: "#FF5500",
    background: "#F2F5F2",
    glyph: "S",
    aliases: ["SoundCloud"],
    managementUrl: null,
  },

  {
    id: "tidal",
    name: "TIDAL",
    category: "Music",
    color: "#000000",
    background: "#F2F5F2",
    glyph: "T",
    aliases: ["Tidal"],
    managementUrl: null,
  },

  {
    id: "deezer",
    name: "Deezer",
    category: "Music",
    color: "#A238FF",
    background: "#F2F5F2",
    glyph: "D",
    aliases: ["Deezer"],
    managementUrl: null,
  },

  {
    id: "pandora",
    name: "Pandora",
    category: "Music",
    color: "#224099",
    background: "#F2F5F2",
    glyph: "P",
    aliases: ["Pandora"],
    managementUrl: null,
  },

  {
    id: "appletv",
    name: "Apple TV+",
    category: "Entertainment",
    color: "#000000",
    background: "#F2F5F2",
    glyph: "A",
    aliases: ["Apple TV AppleTV"],
    managementUrl: null,
  },

  {
    id: "hbo",
    name: "HBO Max",
    category: "Entertainment",
    color: "#000000",
    background: "#F2F5F2",
    glyph: "H",
    aliases: ["HBO Max"],
    managementUrl: null,
  },

  {
    id: "twitch",
    name: "Twitch",
    category: "Entertainment",
    color: "#9146FF",
    background: "#F2F5F2",
    glyph: "T",
    aliases: ["Twitch Turbo"],
    managementUrl: null,
  },

  {
    id: "crunchyroll",
    name: "Crunchyroll",
    category: "Entertainment",
    color: "#FF5E00",
    background: "#F2F5F2",
    glyph: "C",
    aliases: ["anime"],
    managementUrl: null,
  },

  {
    id: "paramountplus",
    name: "Paramount+",
    category: "Entertainment",
    color: "#0064FF",
    background: "#F2F5F2",
    glyph: "P",
    aliases: ["Paramount Plus"],
    managementUrl: null,
  },

  {
    id: "audible",
    name: "Audible",
    category: "Entertainment",
    color: "#F8991C",
    background: "#17251E",
    glyph: "A",
    aliases: ["audiobooks"],
    managementUrl: null,
  },

  {
    id: "patreon",
    name: "Patreon",
    category: "Entertainment",
    color: "#000000",
    background: "#F2F5F2",
    glyph: "P",
    aliases: ["creator membership"],
    managementUrl: null,
  },

  {
    id: "substack",
    name: "Substack",
    category: "Entertainment",
    color: "#FF6719",
    background: "#F2F5F2",
    glyph: "S",
    aliases: ["newsletters"],
    managementUrl: null,
  },

  {
    id: "dropbox",
    name: "Dropbox",
    category: "Cloud & storage",
    color: "#0061FF",
    background: "#F2F5F2",
    glyph: "D",
    aliases: ["cloud backup"],
    managementUrl: null,
  },

  {
    id: "protondrive",
    name: "Proton Drive",
    category: "Cloud & storage",
    color: "#EB508D",
    background: "#F2F5F2",
    glyph: "P",
    aliases: ["encrypted storage"],
    managementUrl: null,
  },

  {
    id: "mega",
    name: "MEGA",
    category: "Cloud & storage",
    color: "#D9272E",
    background: "#F2F5F2",
    glyph: "M",
    aliases: ["cloud storage"],
    managementUrl: null,
  },

  {
    id: "backblaze",
    name: "Backblaze",
    category: "Cloud & storage",
    color: "#E21E29",
    background: "#F2F5F2",
    glyph: "B",
    aliases: ["backup"],
    managementUrl: null,
  },

  {
    id: "box",
    name: "Box",
    category: "Cloud & storage",
    color: "#0061D5",
    background: "#F2F5F2",
    glyph: "B",
    aliases: ["cloud storage"],
    managementUrl: null,
  },

  {
    id: "github",
    name: "GitHub",
    category: "Productivity",
    color: "#181717",
    background: "#F2F5F2",
    glyph: "G",
    aliases: ["Copilot Git Hub"],
    managementUrl: null,
  },

  {
    id: "gitlab",
    name: "GitLab",
    category: "Productivity",
    color: "#FC6D26",
    background: "#F2F5F2",
    glyph: "G",
    aliases: ["Git Lab"],
    managementUrl: null,
  },

  {
    id: "discord",
    name: "Discord Nitro",
    category: "Productivity",
    color: "#5865F2",
    background: "#F2F5F2",
    glyph: "D",
    aliases: ["Discord"],
    managementUrl: null,
  },

  {
    id: "zoom",
    name: "Zoom",
    category: "Productivity",
    color: "#0B5CFF",
    background: "#F2F5F2",
    glyph: "Z",
    aliases: ["meetings"],
    managementUrl: null,
  },

  {
    id: "todoist",
    name: "Todoist",
    category: "Productivity",
    color: "#E44332",
    background: "#F2F5F2",
    glyph: "T",
    aliases: ["tasks"],
    managementUrl: null,
  },

  {
    id: "trello",
    name: "Trello",
    category: "Productivity",
    color: "#0052CC",
    background: "#F2F5F2",
    glyph: "T",
    aliases: ["tasks boards"],
    managementUrl: null,
  },

  {
    id: "asana",
    name: "Asana",
    category: "Productivity",
    color: "#F06A6A",
    background: "#F2F5F2",
    glyph: "A",
    aliases: ["project management"],
    managementUrl: null,
  },

  {
    id: "clickup",
    name: "ClickUp",
    category: "Productivity",
    color: "#7B68EE",
    background: "#F2F5F2",
    glyph: "C",
    aliases: ["Click Up"],
    managementUrl: null,
  },

  {
    id: "linear",
    name: "Linear",
    category: "Productivity",
    color: "#5E6AD2",
    background: "#F2F5F2",
    glyph: "L",
    aliases: ["issues"],
    managementUrl: null,
  },

  {
    id: "miro",
    name: "Miro",
    category: "Productivity",
    color: "#050038",
    background: "#F2F5F2",
    glyph: "M",
    aliases: ["whiteboard"],
    managementUrl: null,
  },

  {
    id: "grammarly",
    name: "Grammarly",
    category: "Productivity",
    color: "#027E6F",
    background: "#F2F5F2",
    glyph: "G",
    aliases: ["writing"],
    managementUrl: null,
  },

  {
    id: "evernote",
    name: "Evernote",
    category: "Productivity",
    color: "#00A82D",
    background: "#F2F5F2",
    glyph: "E",
    aliases: ["notes"],
    managementUrl: null,
  },

  {
    id: "obsidian",
    name: "Obsidian",
    category: "Productivity",
    color: "#7C3AED",
    background: "#F2F5F2",
    glyph: "O",
    aliases: ["notes sync"],
    managementUrl: null,
  },

  {
    id: "bitwarden",
    name: "Bitwarden",
    category: "Productivity",
    color: "#175DDC",
    background: "#F2F5F2",
    glyph: "B",
    aliases: ["password manager"],
    managementUrl: null,
  },

  {
    id: "1password",
    name: "1Password",
    category: "Productivity",
    color: "#145FE4",
    background: "#F2F5F2",
    glyph: "1",
    aliases: ["one password password manager"],
    managementUrl: null,
  },

  {
    id: "readme",
    name: "ReadMe",
    category: "Productivity",
    color: "#018EF5",
    background: "#F2F5F2",
    glyph: "R",
    aliases: ["developer documentation"],
    managementUrl: null,
  },

  {
    id: "replit",
    name: "Replit",
    category: "Productivity",
    color: "#F26207",
    background: "#F2F5F2",
    glyph: "R",
    aliases: ["coding"],
    managementUrl: null,
  },

  {
    id: "vercel",
    name: "Vercel",
    category: "Productivity",
    color: "#000000",
    background: "#F2F5F2",
    glyph: "V",
    aliases: ["hosting"],
    managementUrl: null,
  },

  {
    id: "netlify",
    name: "Netlify",
    category: "Productivity",
    color: "#00C7B7",
    background: "#17251E",
    glyph: "N",
    aliases: ["hosting"],
    managementUrl: null,
  },

  {
    id: "digitalocean",
    name: "DigitalOcean",
    category: "Productivity",
    color: "#0080FF",
    background: "#F2F5F2",
    glyph: "D",
    aliases: ["cloud hosting"],
    managementUrl: null,
  },

  {
    id: "webflow",
    name: "Webflow",
    category: "Productivity",
    color: "#146EF5",
    background: "#F2F5F2",
    glyph: "W",
    aliases: ["website"],
    managementUrl: null,
  },

  {
    id: "squarespace",
    name: "Squarespace",
    category: "Productivity",
    color: "#000000",
    background: "#F2F5F2",
    glyph: "S",
    aliases: ["website"],
    managementUrl: null,
  },

  {
    id: "shopify",
    name: "Shopify",
    category: "Productivity",
    color: "#7AB55C",
    background: "#17251E",
    glyph: "S",
    aliases: ["store ecommerce"],
    managementUrl: null,
  },

  {
    id: "framer",
    name: "Framer",
    category: "Productivity",
    color: "#0055FF",
    background: "#F2F5F2",
    glyph: "F",
    aliases: ["website design"],
    managementUrl: null,
  },

  {
    id: "protonvpn",
    name: "Proton VPN",
    category: "Other",
    color: "#66DEB1",
    background: "#17251E",
    glyph: "P",
    aliases: ["security"],
    managementUrl: null,
  },

  {
    id: "nordvpn",
    name: "NordVPN",
    category: "Other",
    color: "#4687FF",
    background: "#F2F5F2",
    glyph: "N",
    aliases: ["Nord VPN security"],
    managementUrl: null,
  },

  {
    id: "surfshark",
    name: "Surfshark",
    category: "Other",
    color: "#1EBFBF",
    background: "#17251E",
    glyph: "S",
    aliases: ["VPN security"],
    managementUrl: null,
  },

  {
    id: "duolingo",
    name: "Duolingo",
    category: "Education",
    color: "#58CC02",
    background: "#17251E",
    glyph: "D",
    aliases: ["Super Duolingo language"],
    managementUrl: null,
  },

  {
    id: "coursera",
    name: "Coursera",
    category: "Education",
    color: "#0056D2",
    background: "#F2F5F2",
    glyph: "C",
    aliases: ["courses"],
    managementUrl: null,
  },

  {
    id: "udemy",
    name: "Udemy",
    category: "Education",
    color: "#A435F0",
    background: "#F2F5F2",
    glyph: "U",
    aliases: ["courses"],
    managementUrl: null,
  },

  {
    id: "skillshare",
    name: "Skillshare",
    category: "Education",
    color: "#00FF84",
    background: "#17251E",
    glyph: "S",
    aliases: ["courses"],
    managementUrl: null,
  },

  {
    id: "pluralsight",
    name: "Pluralsight",
    category: "Education",
    color: "#F15B2A",
    background: "#F2F5F2",
    glyph: "P",
    aliases: ["courses"],
    managementUrl: null,
  },

  {
    id: "strava",
    name: "Strava",
    category: "Health & fitness",
    color: "#FC4C02",
    background: "#F2F5F2",
    glyph: "S",
    aliases: ["fitness"],
    managementUrl: null,
  },

  {
    id: "peloton",
    name: "Peloton",
    category: "Health & fitness",
    color: "#181A1D",
    background: "#F2F5F2",
    glyph: "P",
    aliases: ["fitness"],
    managementUrl: null,
  },

  {
    id: "fitbit",
    name: "Fitbit",
    category: "Health & fitness",
    color: "#00B0B9",
    background: "#F2F5F2",
    glyph: "F",
    aliases: ["fitness"],
    managementUrl: null,
  },

  {
    id: "headspace",
    name: "Headspace",
    category: "Health & fitness",
    color: "#F47D31",
    background: "#17251E",
    glyph: "H",
    aliases: ["meditation"],
    managementUrl: null,
  },
];

const byId = new Map(catalog.map((service) => [service.id, service]));
export function serviceFor(id: string | null) {
  return id ? byId.get(id) : undefined;
}
function normalizeSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
const searchIndex = catalog.map((service) => ({
  service,
  names: [service.name, ...(service.aliases ?? [])].map(normalizeSearch),
  text: normalizeSearch(
    [
      service.name,
      service.id,
      service.category,
      ...(service.aliases ?? []),
    ].join(" "),
  ),
}));
export function searchServices(
  query: string,
  category: Category | "All" = "All",
  proPlanEnabled = true,
): Service[] {
  const terms = normalizeSearch(query.slice(0, 80)).split(" ").filter(Boolean);
  return searchIndex
    .filter(
      ({ service, text }) =>
        (proPlanEnabled || service.id !== "subloom-pro") &&
        (category === "All" || service.category === category) &&
        terms.every((term) => text.includes(term)),
    )
    .map((entry) => entry.service);
}

// Inline name suggestions intentionally match prefixes, not category/substring search.
export function suggestServices(
  query: string,
  proPlanEnabled = true,
): Service[] {
  const prefix = normalizeSearch(query.slice(0, 80));
  if (!prefix) return [];
  return searchIndex
    .filter(
      ({ service, names }) =>
        (proPlanEnabled || service.id !== "subloom-pro") &&
        names.some((name) => name.startsWith(prefix)),
    )
    .map(({ service }) => service)
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 6);
}
