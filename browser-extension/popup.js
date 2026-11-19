const appMatch = chrome.runtime.getManifest().host_permissions[0];
const appOrigin = new URL(appMatch).origin;
const content = document.getElementById("content");
const refresh = document.getElementById("refresh");
const appButton = document.getElementById("app");
let sourceTabId;

function element(tag, className, label) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (label !== undefined) item.textContent = label;
  return item;
}

function showMessage(title, description) {
  const card = element("section", "empty");
  card.append(element("h2", "", title), element("p", "", description));
  content.replaceChildren(card);
}

async function appTabs() {
  const current = await chrome.tabs.query({
    url: appMatch,
    currentWindow: true,
  });
  const tabs = current.length
    ? current
    : await chrome.tabs.query({ url: appMatch });
  return tabs.sort((a, b) => Number(b.active) - Number(a.active));
}

async function openApp(subscriptionId) {
  const tabs = await appTabs();
  const tab = tabs.find(({ id }) => id === sourceTabId) ?? tabs[0];
  const url = subscriptionId
    ? new URL(`/subscription/${subscriptionId}`, appOrigin).href
    : undefined;
  if (!tab) {
    await chrome.tabs.create({ url: url ?? appOrigin });
    return;
  }
  await chrome.tabs.update(tab.id, { active: true, ...(url && { url }) });
  await chrome.windows.update(tab.windowId, { focused: true });
}

function navigate(subscriptionId) {
  void openApp(subscriptionId).catch(() => {
    showMessage("Couldn’t open Subloom", "Try opening the app again.");
  });
}

function validEvent(event) {
  return (
    event &&
    typeof event.id === "string" &&
    /^[0-9a-f-]{36}$/i.test(event.id) &&
    (event.type === "renewal" || event.type === "trial") &&
    Number.isInteger(event.days) &&
    event.days >= 0 &&
    typeof event.name === "string" &&
    typeof event.date === "string" &&
    typeof event.amount === "string"
  );
}

function eventButton(event) {
  const button = element("button", "event");
  button.type = "button";
  const detail = element("span", "detail");
  const title = element("span", "name", event.name);
  title.title = event.name;
  const label = event.type === "trial" ? "Trial ends" : "Renews";
  detail.append(title, element("span", "meta", `${label} · ${event.date}`));
  const amount = element("span", "amount", event.amount);
  if (event.type === "trial") amount.title = "Price after trial";
  button.append(detail, amount);
  button.addEventListener("click", () => navigate(event.id));
  return button;
}

function showRenewals({ next, week, weekLabel }) {
  const hero = element("section", next ? "hero" : "empty");
  if (next) {
    const when =
      next.days === 0
        ? "Today"
        : next.days === 1
          ? "Tomorrow"
          : `In ${next.days} days`;
    hero.append(
      element("h2", "", "Up next"),
      eventButton(next),
      element("span", "when", when),
    );
  } else {
    hero.append(
      element("h2", "", "You’re all clear"),
      element("p", "", "No upcoming renewals or trial endings."),
    );
  }
  const section = element("section", "week");
  const heading = element("div", "week-head");
  heading.append(
    element("h2", "", "This week"),
    element("span", "range", weekLabel),
  );
  section.append(heading);
  if (week.length) {
    const list = element("ul", "events");
    for (const event of week) {
      const item = element("li");
      item.append(eventButton(event));
      list.append(item);
    }
    section.append(list);
  } else {
    section.append(element("p", "empty", "Nothing due this week."));
  }
  content.replaceChildren(hero, section);
}

async function load() {
  refresh.disabled = true;
  content.setAttribute("aria-busy", "true");
  content.replaceChildren(element("p", "message", "Loading renewals…"));
  sourceTabId = undefined;
  try {
    const tabs = await appTabs();
    refresh.hidden = tabs.length === 0;
    if (!tabs.length) {
      showMessage(
        "Open Subloom to get started",
        "Keep the Subloom tab open to see your renewals here.",
      );
      return;
    }

    sourceTabId = tabs[0].id;
    const read = () =>
      chrome.tabs
        .sendMessage(
          sourceTabId,
          { type: "subloom:extension:read" },
          { frameId: 0 },
        )
        .catch(() => null);
    let data = await read();
    if (data?.status === "loading") {
      await new Promise((resolve) => setTimeout(resolve, 450));
      data = await read();
    }
    if (
      data?.status === "ready" &&
      (data.next === null || validEvent(data.next)) &&
      Array.isArray(data.week) &&
      data.week.every(validEvent) &&
      typeof data.weekLabel === "string"
    ) {
      showRenewals(data);
    } else if (data?.status === "locked") {
      showMessage(
        "Subloom is locked",
        "Unlock the Subloom tab, then reopen this popup.",
      );
    } else if (data?.status === "demo") {
      showMessage(
        "You’re viewing the demo",
        "Switch to your own workspace in Subloom to see your renewals.",
      );
    } else if (data?.status === "loading") {
      showMessage(
        "Subloom is still loading",
        "Give the tab a moment, then refresh here.",
      );
    } else if (!data || data.status === "unavailable") {
      showMessage(
        "Couldn’t connect to Subloom",
        "Reload the Subloom tab, then reopen this popup.",
      );
    } else {
      showMessage(
        "Couldn’t load renewals",
        "Try refreshing or open Subloom to see your subscriptions.",
      );
    }
  } catch {
    showMessage(
      "Couldn’t load renewals",
      "Try refreshing or open Subloom to see your subscriptions.",
    );
  } finally {
    refresh.disabled = false;
    content.setAttribute("aria-busy", "false");
  }
}

refresh.addEventListener("click", load);
appButton.addEventListener("click", () => navigate());
void load();
