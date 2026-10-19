import { serviceFor } from "./catalog";

export type CancellationInstructions = {
  websiteUrl: string | null;
  sourceUrl: string | null;
  steps: readonly string[];
  note?: string;
  general?: boolean;
};

function guide(
  websiteUrl: string,
  sourceUrl: string,
  steps: readonly string[],
  note?: string,
): CancellationInstructions {
  return { websiteUrl, sourceUrl, steps, note };
}

// Original summaries of first-party guidance. No remote HTML or user-derived URLs.
// Keep uncertain menu paths general rather than presenting guessed labels as facts.
const guides: Record<string, CancellationInstructions> = {
  netflix: guide(
    "https://www.netflix.com",
    "https://help.netflix.com/en/node/407",
    [
      "Sign in to the Netflix account that pays for the membership.",
      "Open Manage your membership and choose Cancel.",
      "Choose Finish Cancellation, then save the confirmation and access end date.",
    ],
    "If another company bills you, follow the billing partner link in your Netflix account.",
  ),
  spotify: guide(
    "https://www.spotify.com/account/subscription/",
    "https://support.spotify.com/us/article/cancel-premium/",
    [
      "Sign in to your Spotify account in a browser and open Manage your plan.",
      "Choose Cancel subscription and complete the confirmation steps.",
      "Check the account shows when Premium ends and keep the confirmation.",
    ],
    "A Family or Duo plan must be canceled by its manager. Partner billing uses the partner’s process. A zero-priced trial may end immediately.",
  ),
  youtube: guide(
    "https://www.youtube.com/paid_memberships",
    "https://support.google.com/youtube/answer/6308278?hl=en",
    [
      "Sign in to YouTube and open Purchases and memberships.",
      "Find Premium, choose Manage membership, then Deactivate or Cancel.",
      "Continue with cancellation rather than pausing, and confirm the final step.",
    ],
  ),
  icloud: guide(
    "https://www.icloud.com",
    "https://support.apple.com/en-us/108318",
    [
      "On iPhone or iPad with OS 18.4 or later, open Settings, tap your name, then Subscriptions and iCloud+.",
      "Choose Cancel Subscription and follow the prompts. To choose a smaller paid plan instead, use See All Plans.",
      "On older versions, use iCloud’s plan or storage settings, then Downgrade Options and select the free plan. Apple’s guide below covers Mac, Windows, and other versions.",
    ],
    "Download or reduce content above the new storage limit first. Check how the change affects backups, syncing, and any Apple One bundle.",
  ),
  google: guide(
    "https://one.google.com/settings",
    "https://support.google.com/googleone/answer/9056360?hl=en",
    [
      "Sign in to Google One with the account that owns the plan.",
      "Open Settings and select Cancel membership.",
      "Confirm cancellation and check the membership end date.",
    ],
    "Review your storage usage before the plan ends. Cancel through Apple if Apple bills your membership.",
  ),
  chatgpt: guide(
    "https://chatgpt.com",
    "https://help.openai.com/en/articles/7232927-canceling-your-chatgpt-subscription",
    [
      "Sign in to the ChatGPT account with the paid subscription.",
      "Open your account menu, choose Settings, then Billing.",
      "Under Cancel plan, choose Cancel and complete the confirmation. For Business, the workspace owner should use Workspace settings, Billing, then Manage plan.",
    ],
  ),
  adobe: guide(
    "https://account.adobe.com/plans",
    "https://helpx.adobe.com/manage-account/using/cancel-subscription.html",
    [
      "Sign in to your Adobe account and open Plans.",
      "Choose Manage plan for the correct subscription, then Cancel your plan.",
      "Read the cancellation summary, including any fee and access changes, before completing all confirmation steps.",
    ],
    "Some annual contracts have early cancellation fees. If you bought through a reseller, contact that reseller.",
  ),
  microsoft: guide(
    "https://account.microsoft.com/services",
    "https://support.microsoft.com/en-US/accounts-billing/subscriptions/turn-recurring-billing-on-or-off-for-a-microsoft-subscription",
    [
      "Sign in to your Microsoft account and open Services & subscriptions.",
      "Find Microsoft 365 and choose Manage.",
      "Choose Cancel subscription or Turn off recurring billing, follow the prompts, and check the expiry date.",
    ],
    "Business subscriptions are managed by the billing administrator or reseller. Store-billed subscriptions must be managed with that store.",
  ),
  amazon: guide(
    "https://www.amazon.com/prime",
    "https://www.aboutamazon.com/news/retail/how-to-cancel-amazon-prime-membership",
    [
      "Sign in to the Amazon marketplace where you purchased Prime.",
      "Open Prime membership and choose Manage membership, then End membership.",
      "Continue through the cancellation screens and confirm the end date shown.",
    ],
    "Use your country’s Amazon website. Prime Video channels and other Amazon subscriptions may need to be canceled separately.",
  ),
  notion: guide(
    "https://www.notion.so",
    "https://www.notion.com/help/plan-downgrade",
    [
      "Open the correct Notion workspace as a workspace owner.",
      "Open Settings and the workspace’s plan or billing controls.",
      "Choose the downgrade to Free option, review the limits, and confirm the change.",
    ],
    "Each workspace is billed separately. Review any separately billed products and enterprise agreement with your billing owner.",
  ),
  figma: guide(
    "https://www.figma.com",
    "https://help.figma.com/hc/en-us/articles/360046216313",
    [
      "Sign in as an administrator of the team whose plan you want to cancel.",
      "Open the team’s Admin dashboard and plan settings.",
      "Choose the downgrade to Starter option, complete the cancellation prompts, and check the effective date.",
    ],
    "Organization and Enterprise plans may require your administrator or account representative. Check file limits before downgrading.",
  ),
  applemusic: guide(
    "https://music.apple.com",
    "https://support.apple.com/en-us/118428",
    [
      "On iPhone or iPad, open Settings and tap the Apple Account name used for billing.",
      "Open Subscriptions and select Apple Music.",
      "Choose Cancel Subscription and confirm. On another device, follow Apple’s guide below.",
    ],
    "If Apple Music is included in Apple One or billed by another company, manage that bundle or billing provider instead.",
  ),
  appletv: guide(
    "https://tv.apple.com",
    "https://support.apple.com/en-us/118428",
    [
      "Open Apple Account subscription settings using the account that pays for Apple TV.",
      "Select the Apple TV subscription and choose Cancel Subscription.",
      "Confirm and check the expiry date. Apple’s guide below covers web and other devices.",
    ],
    "If this is part of Apple One or a provider bundle, review that bundle’s billing settings.",
  ),
  soundcloud: guide(
    "https://soundcloud.com/you/subscriptions",
    "https://help.soundcloud.com/hc/en-us/articles/360056011234-Cancel-your-subscription",
    [
      "Sign in to SoundCloud in a browser and open your Subscriptions page.",
      "Choose Edit next to Go, then opt out of the current plan.",
      "Confirm cancellation and check that the page shows an expiry date.",
    ],
  ),
  tidal: guide(
    "https://account.tidal.com",
    "https://support.tidal.com/hc/en-us/articles/201314601-Cancel-Tidal-Subscription-or-Trial",
    [
      "Sign in at account.tidal.com using the account that pays for TIDAL.",
      "Open Subscription and choose Cancel Subscription.",
      "Confirm the cancellation and save the membership end date.",
    ],
  ),
  deezer: {
    ...guide("https://www.deezer.com", "https://www.deezer.com", [
      "Sign in to the Deezer account linked to your payment.",
      "Find your subscription in account settings and look for its management or cancellation options.",
      "Follow the cancellation prompts. If your plan is managed by a partner, contact that billing partner.",
    ]),
    general: true,
  },
  pandora: {
    ...guide("https://www.pandora.com", "https://help.pandora.com/s/", [
      "Sign in to the Pandora account linked to your subscription.",
      "Open account settings and find your subscription’s billing provider.",
      "Follow the cancellation option for that provider in Pandora’s help center and retain the confirmation.",
    ]),
    general: true,
  },
  hbo: guide(
    "https://www.hbomax.com",
    "https://help.hbomax.com/tv-en/Answer/Detail/000002526",
    [
      "Sign in to HBO Max in a browser and open Subscription.",
      "Check who bills you. For a direct subscription, choose the cancellation option and complete the prompts.",
      "If another provider bills you, cancel through that provider. Save the confirmation and end date.",
    ],
  ),
  twitch: guide(
    "https://www.twitch.tv/subscriptions",
    "https://help.twitch.tv/s/article/cancelling-subscriptions",
    [
      "Sign in to Twitch and open your Subscriptions management page.",
      "Find the subscription you want to end. Turbo appears under Other Subscriptions.",
      "Open its management controls, choose not to renew, and finish the cancellation prompts.",
    ],
    "Each channel subscription and Turbo membership is separate. Check the one you intend to cancel.",
  ),
  crunchyroll: guide(
    "https://www.crunchyroll.com",
    "https://help.crunchyroll.com/hc/en-us/articles/17931128982164-How-do-I-cancel-my-membership",
    [
      "Sign in to Crunchyroll in a browser and open your account settings.",
      "Open Membership Info and find the cancellation option for your plan.",
      "Complete the cancellation prompts. If the page names a different billing provider, cancel with that provider instead.",
    ],
  ),
  paramountplus: guide(
    "https://www.paramountplus.com/account/",
    "https://support.paramountplus.com/s/article/PI-How-do-I-cancel-my-subscription",
    [
      "Sign in to Paramount+ on the website and open Account.",
      "For a direct subscription, choose Cancel subscription and follow all prompts.",
      "Save the confirmation. If you subscribed through a store, TV provider, or Prime Video channel, cancel there instead.",
    ],
  ),
  audible: guide(
    "https://www.audible.com",
    "https://help.audible.co.uk/s/article/cancel-membership?language=en_GB",
    [
      "Sign in to the Audible marketplace where you purchased the membership.",
      "Open Account details and choose Cancel membership.",
      "Continue through the cancellation screens and save the confirmation.",
    ],
    "Check what happens to unused credits before canceling. Use the store’s cancellation process for store-billed memberships.",
  ),
  patreon: guide(
    "https://www.patreon.com",
    "https://support.patreon.com/hc/en-us/articles/360005502572-Canceling-a-paid-membership",
    [
      "Sign in to Patreon with your member profile and open Settings, then Memberships.",
      "Find the creator, choose View Details, then Cancel membership.",
      "Confirm cancellation and complete the remaining prompts, including your free membership preference.",
    ],
    "Cancel each creator membership separately and check the access end date shown for that membership.",
  ),
  substack: guide(
    "https://substack.com/settings",
    "https://support.substack.com/hc/en-us/articles/360037489252-How-do-I-cancel-my-paid-subscription-on-Substack",
    [
      "Sign in to Substack and open Settings, then select the paid publication under Subscriptions.",
      "On Manage subscription, find Account actions and choose the paid subscription cancellation link.",
      "Choose cancellation, complete any reason or offer screens, and confirm. Check when subscriber benefits end.",
    ],
  ),
  dropbox: guide(
    "https://www.dropbox.com",
    "https://help.dropbox.com/plans/downgrade-dropbox-individual-plans",
    [
      "Sign in to Dropbox and open Manage account from your avatar.",
      "For an individual plan, choose Cancel plan at the bottom of the page.",
      "Choose a reason, complete the remaining prompts, and keep the confirmation email.",
    ],
    "Family and team plans have different administrator steps. Review storage limits and file access before downgrading.",
  ),
  protondrive: guide(
    "https://account.proton.me",
    "https://proton.me/support/manage-subscription",
    [
      "Sign in to your Proton account and open Settings, then All settings.",
      "Open Subscription, scroll to Cancel subscription, and continue.",
      "Review the plan and storage changes, then confirm cancellation.",
    ],
    "A Proton bundle may cover several services. Check which services change before canceling the plan.",
  ),
  protonvpn: guide(
    "https://account.proton.me",
    "https://proton.me/support/manage-subscription",
    [
      "Sign in to your Proton account and open Settings, then All settings.",
      "Open Subscription and choose the cancellation option for your plan.",
      "Read the plan changes and confirm. For a business agreement, contact your account representative.",
    ],
    "Check whether your subscription includes other Proton services before canceling it.",
  ),
  mega: {
    ...guide(
      "https://mega.nz",
      "https://help.mega.io/plans-storage/payments-billing/cancel-subscription",
      [
        "Sign in to the MEGA account that owns the paid plan.",
        "Open your account’s plan and billing controls and find the recurring subscription.",
        "Follow the cancellation options for your payment method, then check that renewal is disabled.",
      ],
      "Review your storage usage before the paid plan ends. Store-billed subscriptions must be managed with the store.",
    ),
    general: true,
  },
  backblaze: guide(
    "https://www.backblaze.com",
    "https://help.backblaze.com/hc/en-us/articles/217665728-Canceling-and-Deleting-a-Backblaze-Account",
    [
      "Sign in to the Backblaze web console and identify whether you use Computer Backup, B2, or both.",
      "For Computer Backup, first save any data you need. The official cancellation process removes registered backups and their licenses.",
      "Follow the official guide below for every backup and unused license you intend to remove, then review billing.",
    ],
    "Deleting a backup immediately and irreversibly removes its data. B2 has a separate usage-based billing process; canceling Computer Backup does not cover B2.",
  ),
  box: {
    ...guide(
      "https://www.box.com",
      "https://support.box.com/hc/en-us/articles/360044191853-Why-was-my-subscription-automatically-renewed",
      [
        "Sign in as the Box account owner or billing administrator.",
        "Review the account’s billing settings and your agreement’s cancellation and notice requirements.",
        "Use Box’s official cancellation guidance or contact Box billing support, and request written confirmation.",
      ],
      "Business contracts may require advance notice. Keep a copy of any data you need before service ends.",
    ),
    general: true,
  },
  github: {
    ...guide(
      "https://github.com/settings/billing",
      "https://docs.github.com/en/billing",
      [
        "Sign in to GitHub and open the billing settings for your personal account or the correct organization.",
        "Find the specific paid product you want to stop, such as Pro, Copilot, or a Marketplace app.",
        "Use that product’s downgrade or cancellation controls and confirm. Review each remaining paid product separately.",
      ],
      "GitHub plans, Copilot, Marketplace apps, and usage charges are separate billing items.",
    ),
    general: true,
  },
  gitlab: guide(
    "https://customers.gitlab.com",
    "https://docs.gitlab.com/subscriptions/manage_subscription/",
    [
      "Sign in to GitLab’s Customers Portal with the account that manages the subscription.",
      "Find the subscription and open Subscription actions, then choose Cancel subscription to disable renewal.",
      "Select a reason, complete cancellation, and check that the subscription shows an expiry date.",
    ],
  ),
  discord: guide(
    "https://discord.com/app",
    "https://support.discord.com/hc/en-us/articles/19580873036695-How-to-Cancel-your-Nitro-Subscription",
    [
      "For a browser or desktop purchase, open Discord User Settings.",
      "Select Subscriptions and choose Cancel on the Nitro or Nitro Basic subscription.",
      "Complete the prompts and check the expiry date. For a mobile purchase, use the original mobile platform.",
    ],
    "Server Boosts and other Discord subscriptions are separate; canceling Nitro does not necessarily stop them.",
  ),
  zoom: guide(
    "https://zoom.us/signin",
    "https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0066687",
    [
      "Sign in to Zoom’s web portal with billing privileges.",
      "Open Plans and billing and locate the plan under Current Plans or Plan Management.",
      "Choose Cancel Plan and confirm. Check for a pending cancellation and keep the email confirmation.",
    ],
    "Add-ons may need separate cancellation. If self-service cancellation is unavailable, contact Zoom or your reseller.",
  ),
  todoist: guide(
    "https://www.todoist.com",
    "https://www.todoist.com/help/account-and-billing/billing/cancel-a-todoist-subscription-08AmJLVkC",
    [
      "For Pro billed directly, sign in to Todoist on the web or desktop and open Settings from your avatar.",
      "Open Subscription and choose Cancel plan.",
      "Select a reason, review any timing choices, and confirm Cancel subscription. Business plans require the team billing administrator.",
    ],
  ),
  trello: guide(
    "https://trello.com",
    "https://support.atlassian.com/trello/docs/changing-the-admins-of-a-workspace-or-board/",
    [
      "Sign in as an administrator of the Trello Workspace whose paid plan you want to end.",
      "Open that Workspace’s billing page and find the cancellation link for Standard or Premium.",
      "Complete the cancellation prompts and check the effective date. If you cannot access billing, contact the administrator or Trello support.",
    ],
  ),
  asana: guide(
    "https://app.asana.com",
    "https://help.asana.com/s/article/how-to-cancel-your-asana-plan",
    [
      "Sign in as the billing owner or an administrator and open Admin console from your profile menu.",
      "Go to Billing and choose Cancel plan under Plan details.",
      "Complete the prompts and check the next renewal status. Manually invoiced plans may require contacting Asana.",
    ],
  ),
  clickup: {
    ...guide(
      "https://app.clickup.com",
      "https://help.clickup.com/hc/en-us/requests/new",
      [
        "Sign in as the owner or an administrator of the correct ClickUp Workspace.",
        "Open Workspace settings and Billing, and review the options to downgrade to Free Forever.",
        "Follow the downgrade prompts or contact ClickUp billing support if the option is unavailable. Check the status of any paid add-ons too.",
      ],
    ),
    general: true,
  },
  linear: guide(
    "https://linear.app",
    "https://linear.app/docs/billing-and-plans",
    [
      "Sign in as a workspace administrator.",
      "Open Settings, then Administration, then Billing.",
      "Use the subscription cancellation controls, complete the prompts, and check the effective date.",
    ],
  ),
  miro: guide(
    "https://miro.com",
    "https://help.miro.com/hc/en-us/articles/360017571694-Manage-your-subscription",
    [
      "Sign in with billing permissions and open Admin console from your profile avatar.",
      "Open Billing and choose Cancel subscription under Billing actions.",
      "Complete the prompts and review the plan’s end date and board access changes.",
    ],
  ),
  grammarly: guide(
    "https://account.grammarly.com",
    "https://support.grammarly.com/hc/en-us/articles/115000090172-How-do-I-cancel-my-subscription",
    [
      "Sign in to Grammarly and open Account, then Your account and Subscription.",
      "Choose Cancel Subscription and continue through the next screen.",
      "Select a reason and confirm cancellation.",
    ],
    "If your Grammarly account is part of a Superhuman subscription, check the effect on the other included applications.",
  ),
  evernote: guide(
    "https://www.evernote.com",
    "https://help.evernote.com/hc/en-us/articles/115005949208-How-to-cancel-your-Evernote-subscription",
    [
      "Sign in to Evernote Web, open Account Settings, and select Billing.",
      "Choose Manage beside your plan, then Cancel plan. Some accounts show Cancel subscription directly on Billing.",
      "Complete all cancellation prompts, including any device-limit choices, and check the plan’s expiry date.",
    ],
  ),
  obsidian: {
    ...guide(
      "https://obsidian.md/account",
      "https://help.obsidian.md",
      [
        "Sign in to your Obsidian account on the website.",
        "Find the paid service you want to end, such as Sync or Publish, and open its subscription controls.",
        "Disable renewal or cancel the selected service, then check its end date. Contact Obsidian support if the controls are unavailable.",
      ],
      "Sync and Publish are separate services. Make sure your vault is available locally before Sync ends.",
    ),
    general: true,
  },
  bitwarden: guide(
    "https://vault.bitwarden.com",
    "https://bitwarden.com/help/cancel-a-subscription/",
    [
      "Sign in to the Bitwarden web app on the server where you purchased the subscription.",
      "For a personal plan, open Settings, then Subscription.",
      "Note the next charge date, choose Cancel subscription, and confirm. Organization plans use their administrator’s billing controls.",
    ],
  ),
  "1password": guide(
    "https://start.1password.com",
    "https://support.1password.com/manage-subscription/",
    [
      "Sign in to your 1Password account on its website and open Billing.",
      "Choose Cancel subscription on the Billing page; you may need to scroll down to find it.",
      "Confirm cancellation and review when paid access ends. Family and team billing requires the appropriate organizer or administrator.",
    ],
  ),
  readme: guide(
    "https://dash.readme.com",
    "https://docs.readme.com/main/docs/your-account",
    [
      "Sign in as the owner of the ReadMe project whose subscription you want to stop.",
      "Open the project’s settings. In the legacy dashboard, cancellation is at the bottom of General Settings, then Project Settings.",
      "Choose Cancel Subscription and confirm. If your dashboard differs, use the official guidance or contact ReadMe support.",
    ],
    "Canceling a subscription and deleting a project are different actions. Do not delete a project to find the cancellation option.",
  ),
  replit: {
    ...guide(
      "https://replit.com",
      "https://ld.replit.com/terms-of-service",
      [
        "Sign in to the Replit account that pays for the subscription.",
        "Open your account page and billing controls, then find the active membership.",
        "Use its cancellation controls and confirm. Review active deployments and other usage charges separately.",
      ],
      "A membership change may not stop separately billed usage. Business agreements may have different notice terms.",
    ),
    general: true,
  },
  vercel: guide(
    "https://vercel.com/dashboard",
    "https://vercel.com/docs/plans/pro-plan#downgrading-to-hobby",
    [
      "Sign in to Vercel and select the team whose Pro plan you want to end.",
      "Open the team’s Settings and Billing, and find the option to downgrade to Hobby.",
      "Review project eligibility, feature changes, and outstanding usage before confirming the downgrade.",
    ],
    "Check separately billed products, domains, and usage. Contact your account team for Enterprise contracts.",
  ),
  netlify: {
    ...guide(
      "https://app.netlify.com",
      "https://docs.netlify.com/manage/accounts-and-billing/billing/manage-payments/",
      [
        "Sign in as the Team Owner or Billing Admin and select the correct Netlify team.",
        "Open Usage & billing and find your plan’s management controls.",
        "Choose the Free plan if eligible, review the limits, and confirm. Check domains and other paid services separately.",
      ],
    ),
    general: true,
  },
  digitalocean: guide(
    "https://cloud.digitalocean.com",
    "https://docs.digitalocean.com/platform/accounts/deactivate/",
    [
      "Sign in to DigitalOcean and review the resources and billing in each team.",
      "Back up any data you need before following DigitalOcean’s resource removal or account deactivation process.",
      "Use the official guide below to resolve team memberships and deactivate the account if that is your goal. Review outstanding invoices.",
    ],
    "DigitalOcean is usage-based. Removing resources can permanently delete data; simply stopping a server is not a general cancellation method.",
  ),
  webflow: guide(
    "https://webflow.com/dashboard",
    "https://help.webflow.com/hc/en-us/articles/33961220482707-Downgrade-or-cancel-your-Site-plan",
    [
      "Open the correct Webflow site and go to Site settings, then Plans.",
      "Find the Site plan’s downgrade or cancellation controls and select the free Starter plan if eligible.",
      "Review the timing, hosting changes, and any add-on requirements before confirming.",
    ],
    "Site and Workspace plans are separate. Check every paid plan and add-on you intend to stop.",
  ),
  squarespace: guide(
    "https://account.squarespace.com",
    "https://support.squarespace.com/hc/en-us/articles/205810508-Cancel-your-website-subscription",
    [
      "Open the Squarespace site you want to cancel and go to Billing.",
      "Under Subscriptions, select the website plan and choose Cancel subscription.",
      "Review any end-date choices and site availability changes, then complete cancellation.",
    ],
    "Domains, email, and other subscriptions may remain active. Review them separately.",
  ),
  shopify: guide(
    "https://admin.shopify.com",
    "https://help.shopify.com/en/manual/your-account/manage-billing/billing-considerations-pause-deactivate-store",
    [
      "Sign in as the Shopify store owner and review the billing considerations in the official guide below.",
      "Open Settings, then Plan, and find the cancellation or store deactivation option for your plan.",
      "Review the effect on your storefront, outstanding balances, apps, and domains before confirming the cancellation prompts.",
    ],
    "Store deactivation affects the business. Third-party app or domain charges may require separate action.",
  ),
  framer: guide(
    "https://www.framer.com",
    "https://www.framer.com/help/articles/cancel-your-framer-plan/",
    [
      "Open your Framer workspace settings and select Plans.",
      "Open the three-dot menu beside the site you want to cancel and choose Cancel Plan.",
      "Complete the feedback and confirmation steps, then check the cancellation status.",
    ],
    "Review all sites in the workspace; editor billing depends on its active site subscriptions.",
  ),
  nordvpn: guide(
    "https://my.nordaccount.com",
    "https://support.nordvpn.com/hc/en-us/articles/19556844985489-How-to-cancel-auto-renewal-for-your-NordVPN-subscription",
    [
      "Sign in to your Nord Account and open Billing.",
      "Choose Cancel next to auto-renewal for the correct subscription.",
      "Confirm Cancel auto-renewal, check that renewal is off, and keep the confirmation email.",
    ],
  ),
  surfshark: guide(
    "https://my.surfshark.com",
    "https://support.surfshark.com/hc/en-us/articles/360003069694-How-to-cancel-auto-renewal-for-your-Surfshark-subscription",
    [
      "Sign in to your Surfshark account and select Subscription from the account menu.",
      "Open Payments and choose Cancel auto-renewal.",
      "Confirm and check that automatic renewal is disabled.",
    ],
  ),
  duolingo: {
    ...guide("https://www.duolingo.com", "https://www.duolingo.com/help", [
      "Check the purchase receipt to see whether Duolingo, Apple, or Google Play bills you.",
      "For a website purchase, sign in to Duolingo and open your Super or Max subscription settings.",
      "Use the cancellation option and complete the prompts. For store purchases, follow the Apple or Google Play steps instead.",
    ]),
    general: true,
  },
  coursera: guide(
    "https://www.coursera.org",
    "https://www.coursera.support/s/article/learner-000001138?language=en_US",
    [
      "Sign in to Coursera and open My Purchases.",
      "Open Manage Subscriptions and locate the specific subscription or trial.",
      "Choose its cancellation option, confirm, and check the end date. Cancel each subscription you no longer need separately.",
    ],
  ),
  udemy: guide(
    "https://www.udemy.com",
    "https://support.udemy.com/hc/en-us/articles/20898372398999-Billing-for-Subscriptions-Frequently-Asked-Questions",
    [
      "Sign in to Udemy and open the Subscriptions page from your account menu.",
      "Find the active subscription and choose Cancel subscription.",
      "Complete the prompts and check when access ends. Individually purchased courses are separate from a recurring plan.",
    ],
  ),
  skillshare: guide(
    "https://www.skillshare.com",
    "https://help.skillshare.com/hc/en-us/articles/4402806767117-How-do-Skillshare-subscriptions-pricing-and-refunds-work",
    [
      "Sign in to Skillshare in a browser and open Account Settings.",
      "Open Membership & Payments and select Cancel membership.",
      "Complete all cancellation steps and save the confirmation.",
    ],
  ),
  pluralsight: {
    ...guide("https://www.pluralsight.com", "https://help.pluralsight.com", [
      "Sign in to Pluralsight and open Account settings from your avatar.",
      "Open Subscription & Billing and find the current plan’s management controls.",
      "Choose cancellation and complete the prompts. For a team subscription, contact your billing administrator.",
    ]),
    general: true,
  },
  strava: guide(
    "https://www.strava.com",
    "https://support.strava.com/en-us/articles/15401936-how-do-i-cancel-my-subscription",
    [
      "For a website purchase, sign in to Strava on the web.",
      "Open your profile menu, then Settings and My Account.",
      "Choose Cancel Subscription and confirm. If you subscribed in a mobile store, cancel through that store instead.",
    ],
  ),
  peloton: {
    ...guide("https://www.onepeloton.com", "https://support.onepeloton.com", [
      "Check whether Peloton or a third-party store bills the membership.",
      "For a direct purchase, sign in to your Peloton account and locate the membership in your subscription controls.",
      "Use the cancellation option or contact Peloton support for that membership type. Store purchases must be canceled with the store.",
    ]),
    general: true,
  },
  fitbit: {
    ...guide("https://www.fitbit.com", "https://support.google.com/fitbit", [
      "Check the Fitbit Premium purchase receipt to identify the billing provider.",
      "Open the subscription management controls in the Fitbit app or the store that bills you.",
      "Select the Premium subscription and complete the cancellation prompts. Use Fitbit’s help center if you cannot locate it.",
    ]),
    general: true,
  },
  headspace: guide(
    "https://www.headspace.com/subscription/manage",
    "https://help.headspace.com/hc/en-us/articles/115008364988",
    [
      "For a website purchase, sign in to Headspace in a browser.",
      "Open the subscription management page and choose to turn off automatic renewal.",
      "Complete the confirmation steps. If the option is unavailable, contact Headspace support.",
    ],
  ),
};

export const generalCancellationInstructions: CancellationInstructions = {
  websiteUrl: null,
  sourceUrl: null,
  general: true,
  steps: [
    "Check a receipt or statement to identify the company that bills this subscription.",
    "Sign in to that company’s official website or contact its customer support. Ask how to stop renewal and check any notice requirements.",
    "Complete the provider’s cancellation process and keep written confirmation and the date access ends.",
  ],
};

export function cancellationInstructions(
  serviceId: string | null,
): CancellationInstructions {
  if (serviceId === "gym")
    return {
      ...generalCancellationInstructions,
      note: "Gym cancellation depends on the specific club and your contract. Check its notice period and required method, such as an online request or written notice.",
    };
  return serviceId && serviceFor(serviceId) && Object.hasOwn(guides, serviceId)
    ? guides[serviceId]!
    : generalCancellationInstructions;
}

export const storeCancellationInstructions = {
  Apple: {
    sourceUrl: "https://support.apple.com/en-us/118428",
    manageUrl: "https://account.apple.com/account/manage/section/subscriptions",
    steps: [
      "On iPhone or iPad, open Settings and tap your name. Use the Apple Account that appears on the purchase receipt.",
      "Open Subscriptions and select the service you want to cancel.",
      "Tap Cancel Subscription or Cancel Free Trial, confirm, and check the expiry date. If there is no cancel button and an expiry date is shown, it is already canceled.",
    ],
  },
  "Google Play": {
    sourceUrl: "https://support.google.com/googleplay/answer/7018481?hl=en",
    manageUrl: "https://play.google.com/store/account/subscriptions",
    steps: [
      "Open Google Play using the Google Account that paid for the subscription.",
      "Tap your profile picture, then Payments & subscriptions, then Subscriptions. On the web, open the subscriptions page.",
      "Select the service, choose Cancel subscription, and finish the confirmation steps. Check the end date shown.",
    ],
  },
} as const;
