import type { Service } from "./catalog.ts";
import type { CancellationInstructions } from "./cancellationInstructions.ts";

// Original summaries of the linked first-party guidance, checked 2026-11-11.
// Prices vary by plan and region and are entered by the client rather than suggested.
const resources: {
  id: string;
  name: string;
  category: Service["category"];
  color: string;
  websiteUrl: string;
  sourceUrl: string;
  steps: string[];
  note: string;
  aliases: string[];
}[] = [
  {
    id: "disneyplus",
    name: "Disney+",
    category: "Entertainment",
    websiteUrl: "https://www.disneyplus.com",
    sourceUrl: "https://help.disneyplus.com/in/article/disneyplus-cancel",
    steps: [
      "Sign in to Disney+ in a browser with the account that owns the subscription.",
      "Open Profile, then Account, and select the Disney+ subscription.",
      "Choose Cancel Subscription and complete the prompts. Check the access end date.",
    ],
    note: "If an app store, bundle, or another company bills you, cancel through that billing provider.",
    aliases: ["Disney Plus", "Disney+ Premium"],
    color: "#113CCF",
  },
  {
    id: "hulu",
    name: "Hulu",
    category: "Entertainment",
    websiteUrl: "https://www.hulu.com",
    sourceUrl: "https://help.hulu.com/article/hulu-cancel-hulu-subscription",
    steps: [
      "Sign in to Hulu and open your Account page in a browser.",
      "Under Your Subscription, choose Cancel. Continue past the pause offer if you want to cancel.",
      "Choose Cancel Subscription and keep the confirmation email.",
    ],
    note: "If an app store, bundle, or another company bills you, cancel through that billing provider.",
    aliases: [],
    color: "#1CE783",
  },
  {
    id: "starz",
    name: "STARZ",
    category: "Entertainment",
    websiteUrl: "https://www.starz.com",
    sourceUrl: "https://www.starz.com/us/en/termsofuse",
    steps: [
      "Sign in to the STARZ account used for a direct subscription.",
      "Open Settings and follow the Cancel Subscription link.",
      "Finish the cancellation prompts and keep the confirmation and end date.",
    ],
    note: "If an app store, bundle, or another company bills you, cancel through that billing provider.",
    aliases: [],
    color: "#082125",
  },
  {
    id: "mubi",
    name: "MUBI",
    category: "Entertainment",
    websiteUrl: "https://mubi.com",
    sourceUrl:
      "https://help.mubi.com/article/68-how-do-i-cancel-my-subscription-if-i-purchased-it-online-through-the-web",
    steps: [
      "Sign in to MUBI with the account that pays for the membership.",
      "Open the subscription settings and choose to cancel the web-purchased subscription.",
      "Complete the prompts and check that renewal has stopped. Paid time already remaining is retained.",
    ],
    note: "If an app store, bundle, or another company bills you, cancel through that billing provider.",
    aliases: [],
    color: "#000000",
  },
  {
    id: "plex",
    name: "Plex Pass",
    category: "Entertainment",
    websiteUrl: "https://www.plex.tv",
    sourceUrl:
      "https://support.plex.tv/articles/201580107-plex-subscription-management/",
    steps: [
      "Sign in to Plex on the web and open your Account.",
      "Open Subscriptions & Payments and select the relevant Plex Pass subscription.",
      "Cancel future renewal and check the expiry date. Lifetime purchases do not have recurring renewal.",
    ],
    note: "If an app store, bundle, or another company bills you, cancel through that billing provider.",
    aliases: ["Plex", "Plex Premium"],
    color: "#EBAF00",
  },
  {
    id: "dazn",
    name: "DAZN",
    category: "Entertainment",
    websiteUrl: "https://www.dazn.com",
    sourceUrl:
      "https://www.dazn.com/help/articles/how-do-i-cancel-my-subscription",
    steps: [
      "Sign in to DAZN in a browser and open My Account.",
      "Find the subscription management controls and follow the cancellation process for your country and plan.",
      "Complete the prompts and save the confirmed end date and any final payment information.",
    ],
    note: "Notice periods, annual commitments, and final charges vary by country and contract. Check your own terms. If an app store, bundle, or another company bills you, cancel through that billing provider.",
    aliases: [],
    color: "#F8F8F5",
  },
  {
    id: "youtubemusic",
    name: "YouTube Music Premium",
    category: "Music",
    websiteUrl: "https://www.youtube.com/paid_memberships",
    sourceUrl: "https://support.google.com/youtube/answer/6308278?hl=en",
    steps: [
      "Sign in to the paying Google Account and open Purchases and memberships.",
      "Find Music Premium, open Manage membership, and choose to deactivate or cancel.",
      "Continue with cancellation rather than a pause, then confirm and check the end date.",
    ],
    note: "If an app store, bundle, or another company bills you, cancel through that billing provider.",
    aliases: ["YouTube Music", "YT Music"],
    color: "#FF0000",
  },
  {
    id: "amazonmusic",
    name: "Amazon Music Unlimited",
    category: "Music",
    websiteUrl: "https://music.amazon.com/settings",
    sourceUrl:
      "https://www.amazon.com/gp/help/customer/display.html?nodeId=GCRZL3F2UZMNP3T3",
    steps: [
      "Sign in and open your Amazon Music Settings.",
      "In the Amazon Music Unlimited section, select Cancel in the Subscription Renewal details.",
      "Confirm the cancellation and check the date your plan ends.",
    ],
    note: "If an app store, bundle, or another company bills you, cancel through that billing provider.",
    aliases: ["Amazon Music"],
    color: "#46C3D0",
  },
  {
    id: "appleone",
    name: "Apple One",
    category: "Entertainment",
    websiteUrl:
      "https://account.apple.com/account/manage/section/subscriptions",
    sourceUrl: "https://support.apple.com/en-us/118428",
    steps: [
      "Use the Apple Account that appears on the purchase receipt. On iPhone or iPad, open Settings and tap your name.",
      "Open Subscriptions and select Apple One.",
      "Choose Cancel Subscription or Cancel Free Trial, confirm, and check the expiry date.",
    ],
    note: "If the subscription is missing, check the purchase receipt and the Apple Account used to pay. Trial access can end immediately.",
    aliases: ["Apple bundle"],
    color: "#000000",
  },
  {
    id: "applearcade",
    name: "Apple Arcade",
    category: "Entertainment",
    websiteUrl:
      "https://account.apple.com/account/manage/section/subscriptions",
    sourceUrl: "https://support.apple.com/en-us/118428",
    steps: [
      "Use the Apple Account that appears on the purchase receipt. On iPhone or iPad, open Settings and tap your name.",
      "Open Subscriptions and select Apple Arcade.",
      "Choose Cancel Subscription or Cancel Free Trial, confirm, and check the expiry date.",
    ],
    note: "If the subscription is missing, check the purchase receipt and the Apple Account used to pay. Trial access can end immediately.",
    aliases: [],
    color: "#000000",
  },
  {
    id: "xbox",
    name: "Xbox Game Pass",
    category: "Entertainment",
    websiteUrl: "https://account.microsoft.com/services",
    sourceUrl:
      "https://support.xbox.com/en-AU/help/subscriptions-billing/manage-subscriptions/cancel-recurring-billing-or-subscription",
    steps: [
      "Sign in to Microsoft Services & subscriptions with the account that pays for Game Pass.",
      "Find the subscription and open Manage.",
      "Follow the cancellation or recurring-billing controls and check the expiry date. If recurring billing is already off, the plan should expire on its displayed date.",
    ],
    note: "If an app store, bundle, or another company bills you, cancel through that billing provider.",
    aliases: ["Game Pass", "PC Game Pass", "Xbox Game Pass Ultimate"],
    color: "#107C10",
  },
  {
    id: "playstation",
    name: "PlayStation Plus",
    category: "Entertainment",
    websiteUrl: "https://www.playstation.com",
    sourceUrl:
      "https://www.playstation.com/en-gb/support/subscriptions/cancel-playstation-plus/",
    steps: [
      "Sign in to PlayStation Account Management in a browser.",
      "Select Subscription from the account menu.",
      "Choose Cancel Subscription next to PlayStation Plus and check the confirmed end date.",
    ],
    note: "Paid benefits remain until the purchased membership period ends.",
    aliases: ["PS Plus", "PSN Plus"],
    color: "#0070D1",
  },
  {
    id: "eaplay",
    name: "EA Play",
    category: "Entertainment",
    websiteUrl: "https://myaccount.ea.com",
    sourceUrl:
      "https://help.ea.com/en/articles/ea-account/how-to-cancel-ea-play/",
    steps: [
      "For an EA app purchase, sign in to the EA Account used to join.",
      "Open Subscriptions and Memberships, then select Cancel membership in Your membership.",
      "Choose Cancel membership on the page that opens and complete the confirmation.",
    ],
    note: "For Steam, Epic, PlayStation, or Xbox purchases, use that platform\u2019s subscription controls. Game access ends with the membership.",
    aliases: ["EA Play Pro", "Electronic Arts"],
    color: "#000000",
  },
  {
    id: "ubisoftplus",
    name: "Ubisoft+",
    category: "Entertainment",
    websiteUrl: "https://www.ubisoft.com",
    sourceUrl: "https://www.ubisoft.com/en-us/help/cancel-subscription",
    steps: [
      "Sign in to Ubisoft and open its official cancellation page.",
      "Select Ubisoft+ and review the regular cancellation option and the subscription details requested.",
      "Submit the cancellation request and retain the confirmation and effective date.",
    ],
    note: "The official form also covers extraordinary cancellation requests, which are reviewed by support. Partner purchases use that partner\u2019s process.",
    aliases: ["Ubisoft Plus"],
    color: "#000000",
  },
  {
    id: "nintendoswitch",
    name: "Nintendo Switch Online",
    category: "Entertainment",
    websiteUrl: "https://accounts.nintendo.com",
    sourceUrl:
      "https://en-americas-support.nintendo.com/app/answers/detail/a_id/41196/p/989",
    steps: [
      "Open Nintendo eShop with the Nintendo Account that bought the membership.",
      "Open Account Information from your profile icon and find Nintendo Switch Online renewal settings.",
      "Turn off automatic renewal and confirm. Check the displayed membership expiry date.",
    ],
    note: "Nintendo advises turning off renewal at least 48 hours before expiry. A family membership is managed by the account that purchased it.",
    aliases: ["Nintendo Online", "Nintendo Switch Online Expansion Pack"],
    color: "#E60012",
  },
  {
    id: "geforcenow",
    name: "GeForce NOW",
    category: "Entertainment",
    websiteUrl: "https://www.nvidia.com/en-us/account/",
    sourceUrl: "https://www.nvidia.com/en-eu/geforce-now/faq/",
    steps: [
      "Sign in to the NVIDIA account that owns the GeForce NOW membership.",
      "Open the membership controls and choose the downgrade to Free option for a direct NVIDIA-billed plan.",
      "Confirm and review when the downgrade takes effect. Check the account portal for the pending change.",
    ],
    note: "Founders benefits can be lost when a paid plan ends. Alliance partner memberships must be managed with that partner.",
    aliases: ["NVIDIA GeForce NOW", "GFN"],
    color: "#76B900",
  },
  {
    id: "canva",
    name: "Canva",
    category: "Productivity",
    websiteUrl: "https://www.canva.com",
    sourceUrl: "https://www.canva.com/help/cancel-canva-plan/",
    steps: [
      "Sign in to the correct Canva account or team and open Settings, then Billing.",
      "On the paid plan, choose Cancel plan and continue through the cancellation screens.",
      "Select Cancel subscription to finish and keep the confirmation email.",
    ],
    note: "If an app store, bundle, or another company bills you, cancel through that billing provider.",
    aliases: ["Canva Pro", "Canva Teams", "Canva Business"],
    color: "#00C4CC",
  },
  {
    id: "slack",
    name: "Slack",
    category: "Productivity",
    websiteUrl: "https://slack.com",
    sourceUrl:
      "https://slack.com/help/articles/48764458651795-Change-or-cancel-your-paid-Slack-plan",
    steps: [
      "As an authorized workspace billing owner, open Admin, then Manage billing on desktop.",
      "In Overview, choose Change plan details, then Downgrade to Free and review the effective date.",
      "Continue to checkout, review the downgrade details, and confirm Downgrade Slack.",
    ],
    note: "Free-plan message, file, and app limits apply after the change. Enterprise contracts may require your account representative.",
    aliases: [],
    color: "#4A154B",
  },
  {
    id: "airtable",
    name: "Airtable",
    category: "Productivity",
    websiteUrl: "https://airtable.com/account",
    sourceUrl:
      "https://support.airtable.com/articles/3051898591-upgrading-and-downgrading-your-airtable-workspace-plan",
    steps: [
      "As a workspace owner, open your Airtable account overview and select the paid workspace.",
      "Use the workspace plan controls to downgrade that workspace to Free.",
      "Confirm and check the scheduled downgrade date in Workspace plan. Repeat for any other paid workspaces.",
    ],
    note: "Airtable bills each workspace separately. Review storage, record, and feature limits before downgrading.",
    aliases: [],
    color: "#18BFFF",
  },
  {
    id: "loom",
    name: "Loom",
    category: "Productivity",
    websiteUrl: "https://www.loom.com",
    sourceUrl:
      "https://support.atlassian.com/loom/docs/downgrade-or-cancel-your-loom-plan",
    steps: [
      "Check whether Loom uses Atlassian billing or legacy Loom billing, and sign in as a billing administrator.",
      "For Atlassian billing, open Admin, Billing, Subscriptions, and manage the Loom subscription. Use Deactivate and follow the cancellation flow.",
      "For legacy billing, use Workspace Settings, Plan & Billing, Manage Subscription, then Downgrade to Starter and complete cancellation.",
    ],
    note: "Keep the final confirmation and effective date. Unbilled seat changes may still be charged.",
    aliases: [],
    color: "#625DF5",
  },
  {
    id: "calendly",
    name: "Calendly",
    category: "Productivity",
    websiteUrl: "https://calendly.com",
    sourceUrl:
      "https://calendly.com/help/how-to-cancel-your-calendly-subscription",
    steps: [
      "As the account owner or an admin, open Billing in the Calendly Admin Center.",
      "Select Change plan, then Upgrade/Downgrade and choose the Free plan.",
      "Confirm the change and check when the current paid billing cycle ends.",
    ],
    note: "Paid features remain until the end of the current billing cycle.",
    aliases: [],
    color: "#006BFF",
  },
  {
    id: "claude",
    name: "Claude",
    category: "Productivity",
    websiteUrl: "https://claude.ai",
    sourceUrl:
      "https://support.anthropic.com/en/articles/8325617-how-do-i-cancel-my-paid-claude-subscription",
    steps: [
      "For a web or desktop purchase, sign in to the paying Claude account.",
      "Open your account menu, choose Settings, then Billing.",
      "Select Cancel and complete the confirmation. Check when paid access ends.",
    ],
    note: "Cancel at least 24 hours before the next billing date. If an app store, bundle, or another company bills you, cancel through that billing provider.",
    aliases: ["Claude Pro", "Claude Max", "Anthropic Claude"],
    color: "#D97757",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    category: "Productivity",
    websiteUrl: "https://www.perplexity.ai/settings/account",
    sourceUrl:
      "https://www.perplexity.ai/help-center/en/articles/10352901-what-is-perplexity-pro",
    steps: [
      "Sign in to the Perplexity account with the paid subscription.",
      "Open Settings and the subscription management controls for a website purchase.",
      "Complete cancellation and save the confirmation before considering account deletion.",
    ],
    note: "If an app store, bundle, or another company bills you, cancel through that billing provider.",
    aliases: ["Perplexity Pro", "Perplexity Max"],
    color: "#1FB8CD",
  },
  {
    id: "cursor",
    name: "Cursor",
    category: "Productivity",
    websiteUrl: "https://cursor.com/dashboard/billing",
    sourceUrl: "https://docs.cursor.com/account/billing",
    steps: [
      "Sign in to the Cursor account that owns the paid plan and open dashboard billing.",
      "For a separately billed Cursor plan, open Manage subscription or Manage in Stripe.",
      "Choose Cancel Subscription in the billing portal, confirm, and check the effective date.",
    ],
    note: "If an app store or bundled subscription bills you, use that billing provider\u2019s management controls.",
    aliases: ["Cursor Pro", "Cursor Ultra"],
    color: "#000000",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    category: "Productivity",
    websiteUrl: "https://elevenlabs.io",
    sourceUrl:
      "https://elevenlabs.io/docs/help-center/account/cancellation-refunds/how-do-i-cancel-my-subscription",
    steps: [
      "Sign in to ElevenLabs, open your profile menu, then Subscription and Billing.",
      "Under Modify Plan, select Cancel Plan, then Proceed.",
      "Select Cancel Subscription and check that cancellation is scheduled for the end of the billing cycle.",
    ],
    note: "Unused credits are lost when the account returns to the free plan.",
    aliases: ["Eleven Labs"],
    color: "#000000",
  },
  {
    id: "mistral",
    name: "Le Chat",
    category: "Productivity",
    websiteUrl: "https://chat.mistral.ai",
    sourceUrl:
      "https://help.mistral.ai/en/articles/568728-refund-policy-eligibility-timing-and-how-it-works",
    steps: [
      "Sign in to the Mistral account or organization that owns the Le Chat subscription.",
      "For a web purchase, open the Admin panel and use the subscription cancellation controls.",
      "Confirm the change and review the effective date and any withdrawal or refund information shown.",
    ],
    note: "Mobile purchases are managed by Apple or Google; carrier-billed plans use the carrier. Timing depends on when and how you subscribed.",
    aliases: ["Mistral", "Mistral AI", "Le Chat Pro"],
    color: "#FA520F",
  },
  {
    id: "expressvpn",
    name: "ExpressVPN",
    category: "Productivity",
    websiteUrl: "https://www.expressvpn.com",
    sourceUrl:
      "https://www.expressvpn.com/support/manage-account/cancel-expressvpn-subscription/",
    steps: [
      "Open My subscription in an ExpressVPN browser session and sign in if prompted.",
      "For a direct website purchase, choose Cancel subscription under Automatic renewal.",
      "Finish the prompts and check renewal is stopped. Access remains until the current cycle ends.",
    ],
    note: "If an app store, bundle, or another company bills you, cancel through that billing provider.",
    aliases: [],
    color: "#DA3940",
  },
  {
    id: "protonmail",
    name: "Proton Mail",
    category: "Productivity",
    websiteUrl: "https://account.proton.me",
    sourceUrl: "https://proton.me/support/manage-subscription",
    steps: [
      "Sign in to the paying Proton account and open Settings, then Subscription.",
      "Find the paid subscription and follow the cancellation or downgrade to Proton Free controls.",
      "Confirm the change and review its effective date and any storage or feature limits.",
    ],
    note: "Check all products included in a Proton bundle before downgrading. If an app store, bundle, or another company bills you, cancel through that billing provider.",
    aliases: ["ProtonMail", "Proton Mail Plus"],
    color: "#6D4AFF",
  },
  {
    id: "bitdefender",
    name: "Bitdefender",
    category: "Productivity",
    websiteUrl: "https://central.bitdefender.com",
    sourceUrl: "https://www.bitdefender.com/consumer/support/answer/29081/",
    steps: [
      "Sign in to Bitdefender Central and open My Subscriptions.",
      "Open My Payments or Subscriptions, depending on the account\u2019s billing controls.",
      "Select the relevant subscription and stop automatic renewal. Complete confirmation and check the expiry date.",
    ],
    note: "For purchases managed by a reseller or another billing partner, use that provider\u2019s renewal controls.",
    aliases: [],
    color: "#ED1C24",
  },
  {
    id: "norton",
    name: "Norton 360",
    category: "Productivity",
    websiteUrl: "https://my.norton.com",
    sourceUrl:
      "https://support.norton.com/sp/en/in/core/current/solutions/kb20100113164023EN",
    steps: [
      "Sign in to Norton and open My Account, then My Subscriptions.",
      "Choose Cancel Renewal or Manage Subscriptions for the relevant plan.",
      "Complete the prompts and confirm automatic renewal is stopped before the billing date.",
    ],
    note: "Linked add-ons and partner-billed plans can have different cancellation consequences. Review the account summary.",
    aliases: ["Norton", "Norton Antivirus"],
    color: "#FFE01A",
  },
  {
    id: "dashlane",
    name: "Dashlane",
    category: "Productivity",
    websiteUrl: "https://app.dashlane.com",
    sourceUrl:
      "https://support.dashlane.com/hc/en-us/articles/12247552144786-Cancel-my-Dashlane-subscription-and-stop-autorenewal",
    steps: [
      "For a website card purchase, open Dashlane\u2019s web app in a computer browser.",
      "Open the Vault menu, select Subscription, then Cancel your subscription.",
      "Choose Continue cancellation and complete the remaining prompts. Check the confirmation.",
    ],
    note: "App Store, Google Play, and PayPal purchases must be canceled through the respective payment platform.",
    aliases: [],
    color: "#0E353D",
  },
  {
    id: "adguard",
    name: "AdGuard",
    category: "Productivity",
    websiteUrl: "https://adguardaccount.com",
    sourceUrl: "https://adguard.com/kb/general/license/cancel-refund/",
    steps: [
      "Sign in to your AdGuard account.",
      "Select Licenses and find the recurring subscription you want to stop.",
      "Choose Cancel auto-renewal and check the license expiry date.",
    ],
    note: "Lifetime licenses do not renew. App Store subscriptions must be managed through Apple.",
    aliases: [],
    color: "#68BC71",
  },
  {
    id: "deepl",
    name: "DeepL",
    category: "Productivity",
    websiteUrl: "https://www.deepl.com/account",
    sourceUrl:
      "https://support.deepl.com/hc/en-us/articles/360020723719-Cancel-subscription",
    steps: [
      "Sign in to the DeepL account that owns the paid subscription.",
      "Open Subscriptions and select the relevant plan.",
      "Choose Cancel subscription, confirm, and check the end date.",
    ],
    note: "Cancel at least one day before the next payment. Sales-managed plans and partner purchases require the relevant support or billing provider.",
    aliases: ["DeepL Pro", "DeepL Write"],
    color: "#0F2B46",
  },
  {
    id: "fastmail",
    name: "Fastmail",
    category: "Productivity",
    websiteUrl: "https://app.fastmail.com",
    sourceUrl:
      "https://www.fastmail.help/hc/en-us/articles/1500000277342-Canceling-and-deleting-accounts",
    steps: [
      "Sign in and open Settings, then Billing & Plan. Review any additional users and export data you need first.",
      "In Cancel plan, choose Learn more and cancel this plan and read the information shown.",
      "Choose Confirm cancellation and note when the account closes.",
    ],
    note: "Canceling closes the account after the current cycle. Deleting all data is a separate, destructive option. Multi-user accounts require removing other users first.",
    aliases: [],
    color: "#005FF9",
  },
  {
    id: "tuta",
    name: "Tuta Mail",
    category: "Productivity",
    websiteUrl: "https://app.tuta.com",
    sourceUrl: "https://tuta.com/support/general",
    steps: [
      "Sign in to Tuta with the paying administrator account.",
      "Open subscription settings and follow the downgrade or cancellation controls for the paid plan.",
      "Confirm and review the change and free-plan limits. Check that the subscription will no longer renew.",
    ],
    note: "App Store purchases must be canceled through the store. Review custom domains, aliases, users, and storage before downgrading.",
    aliases: ["Tuta", "Tutanota"],
    color: "#850122",
  },
  {
    id: "linkedin",
    name: "LinkedIn Premium",
    category: "Productivity",
    websiteUrl: "https://www.linkedin.com/premium",
    sourceUrl: "https://www.linkedin.com/help/linkedin/answer/a7152614",
    steps: [
      "For a direct LinkedIn purchase, sign in on the desktop website with the paying account.",
      "Open Premium subscription management and follow the cancellation controls.",
      "Finish the prompts and check that Premium expires at the end of the current billing cycle.",
    ],
    note: "App Store and other partner purchases use the partner\u2019s process. InMail credits and other Premium benefits are lost when access ends.",
    aliases: [
      "LinkedIn",
      "LinkedIn Premium Career",
      "LinkedIn Premium Business",
    ],
    color: "#0A66C2",
  },
  {
    id: "medium",
    name: "Medium",
    category: "Entertainment",
    websiteUrl: "https://medium.com/me/settings",
    sourceUrl:
      "https://help.medium.com/hc/en-us/articles/360033418214-Trouble-canceling-membership-subscription",
    steps: [
      "For a direct purchase, sign in to your Medium member account on a desktop browser.",
      "Open Settings, scroll to Membership, and select Cancel your membership.",
      "Complete the prompts and check the end of the current billing cycle.",
    ],
    note: "If an app store, bundle, or another company bills you, cancel through that billing provider.",
    aliases: ["Medium Membership"],
    color: "#000000",
  },
];
export const additionalCatalog: Service[] = resources.map((row) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  color: row.color,
  background: "#FFFFFF",
  glyph: "",
  managementUrl: row.websiteUrl,
  aliases: row.aliases,
}));
export const additionalCancellationGuides: Readonly<
  Record<string, CancellationInstructions>
> = Object.fromEntries(
  resources.map((row) => [
    row.id,
    {
      websiteUrl: row.websiteUrl,
      sourceUrl: row.sourceUrl,
      steps: row.steps,
      note: row.note,
    },
  ]),
);
