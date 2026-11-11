import { beforeEach, expect, it, vi } from "vitest";
import {
  assistantLegacyResponseSchema,
  assistantResponseSchema,
  containsCardNumber,
  mergeAssistantDraft,
} from "../../src/domain/assistantProtocol";
import { interpretLocalAssistant } from "../../src/domain/localAssistant";
import {
  emptySnapshot,
  type Snapshot,
  type Subscription,
} from "../../src/domain/models";
import { resolveAssistantAction } from "../../src/services/assistantActions";

const mocks = vi.hoisted(() => ({
  getState: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  preferences: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
}));
vi.mock("expo-crypto", () => ({
  randomUUID: () => "520ebabe-b585-49a0-b967-c09b2a56cce5",
}));
vi.mock("../../src/store/app", () => ({
  useApp: { getState: mocks.getState },
  saveSubscription: mocks.save,
  deleteSubscription: mocks.remove,
  updatePreferences: mocks.preferences,
}));
vi.mock("../../src/services/featureSettings", () => ({
  readSetting: mocks.read,
  writeSetting: mocks.write,
}));

const identity = "94a5ae49-a5b8-4076-acc5-16e47da52116";
let snapshot: Snapshot;
const spotify: Subscription = {
  id: "e0ade757-ecc4-4a0b-ae37-90537d84db0c",
  userId: identity,
  serviceId: "spotify",
  name: "Spotify",
  category: "Music",
  amountMinor: 1099,
  currency: "USD",
  interval: "monthly",
  intervalCount: 1,
  customUnit: "day",
  startDate: "2026-01-01",
  nextRenewal: "2026-12-08",
  anchorDay: 8,
  status: "active",
  trialEnd: null,
  canceledAt: null,
  paidThrough: null,
  paymentMethod: "",
  notes: "",
  source: "manual",
  reminders: null,
  version: 2,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};
beforeEach(() => {
  vi.resetAllMocks();
  snapshot = emptySnapshot();
  snapshot.subscriptions = [spotify];
  mocks.getState.mockImplementation(() => ({
    identity,
    hydrated: true,
    data: snapshot,
  }));
});
it("keeps the provider response limited to recognized actions and catches card numbers", () => {
  expect(
    assistantResponseSchema.safeParse({
      action: { kind: "sql", sql: "update..." },
    }).success,
  ).toBe(false);
  expect(
    assistantResponseSchema.safeParse({
      action: { kind: "subscription", name: "Spotify", hidden: true },
    }).success,
  ).toBe(false);
  expect(containsCardNumber("Add 4111-1111-1111-1111")).toBe(true);
  expect(containsCardNumber("Visa ending in 1234")).toBe(false);
});
it("shows saved subscription data and leaves ambiguous matches read-only", async () => {
  const result = await resolveAssistantAction(
    { kind: "subscription", name: "Spotify" },
    identity,
  );
  expect(result.title).toBe("Spotify");
  expect(result.rows?.find((row) => row.label === "Price")?.value).toContain(
    "10.99",
  );
  snapshot.subscriptions.push({ ...spotify, id: "other" });
  const ambiguous = await resolveAssistantAction(
    { kind: "subscription", name: "Spotify" },
    identity,
  );
  expect(ambiguous.awaitingDetails).toBe(true);
  expect(ambiguous.rows).toHaveLength(2);
  expect(ambiguous.title).toBe("Matching records");
  expect(mocks.save).not.toHaveBeenCalled();
});
it("asks for missing purchase details, then saves only a confirmed draft", async () => {
  const request = {
    kind: "add_subscription",
    name: "Netflix",
    amount: "15.49",
    currency: null,
    interval: "monthly",
    start: null,
    renewal: "2026-12-20",
    method: null,
  } as const;
  const incomplete = await resolveAssistantAction(request, identity);
  expect(incomplete.text).toContain("currency code");
  expect(incomplete.next).toBeUndefined();
  const draft = await resolveAssistantAction(
    { ...request, currency: "USD" },
    identity,
  );
  expect(mocks.save).not.toHaveBeenCalled();
  if (!draft.next || !("run" in draft.next))
    throw new Error("Expected a confirmation action.");
  await draft.next.run();
  expect(mocks.save).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: identity,
      name: "Netflix",
      amountMinor: 1549,
      currency: "USD",
      nextRenewal: "2026-12-20",
      anchorDay: 20,
    }),
    undefined,
    undefined,
    identity,
  );
});
it("previews preference changes and refuses to apply them in another workspace", async () => {
  const draft = await resolveAssistantAction(
    { kind: "preferences", appearance: "dark", accent: null, currency: "TND" },
    identity,
  );
  expect(mocks.preferences).not.toHaveBeenCalled();
  if (!draft.next || !("run" in draft.next))
    throw new Error("Expected a confirmation action.");
  await draft.next.run();
  expect(mocks.preferences).toHaveBeenCalledWith(
    {
      appearance: "dark",
      currency: "TND",
      highRenewalThresholdMinor: null,
    },
    identity,
  );
  mocks.getState.mockReturnValue({
    identity: "guest",
    hydrated: true,
    data: snapshot,
  });
  await expect(draft.next.run()).rejects.toThrow(/workspace changed/);
  expect(mocks.preferences).toHaveBeenCalledTimes(1);
});
it("checks the current payment label and subscription version at confirmation", async () => {
  const wallet = {
    id: "c1e5099a-8bc0-4df4-b62a-28dcd020bb58",
    kind: "wallet",
    name: "Everyday",
    walletProvider: "Apple Wallet",
  };
  mocks.read.mockResolvedValue({ value: { sources: [wallet], links: [] } });
  const draft = await resolveAssistantAction(
    { kind: "assign_billing", subscription: "Spotify", method: "Everyday" },
    identity,
  );
  expect(mocks.save).not.toHaveBeenCalled();
  if (!draft.next || !("run" in draft.next))
    throw new Error("Expected a confirmation action.");
  await draft.next.run();
  expect(mocks.save).toHaveBeenCalledWith(
    expect.objectContaining({ paymentMethod: "billing:" + wallet.id }),
    undefined,
    2,
    identity,
  );
  snapshot.subscriptions[0] = { ...spotify, version: 3 };
  await expect(draft.next.run()).rejects.toThrow(/subscription changed/);
  expect(mocks.save).toHaveBeenCalledTimes(1);
});

it("opens reminder controls for the named subscription", async () => {
  const reply = await resolveAssistantAction(
    { kind: "open_reminders", subscription: "Spotify" },
    identity,
  );
  expect(reply.next).toMatchObject({
    route: { pathname: "/subscription/[id]", params: { id: spotify.id } },
  });
});

it("keeps the on-device draft across a price follow-up and previews the saved wallet", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-10T12:00:00Z"));
  try {
    snapshot.preferences.timezone = "UTC";
    snapshot.subscriptions = [];
    mocks.getState.mockReturnValue({
      identity: "guest",
      hydrated: true,
      data: snapshot,
    });
    const wallet = {
      id: "c1e5099a-8bc0-4df4-b62a-28dcd020bb58",
      kind: "wallet",
      name: "RedotPay",
      walletProvider: "RedotPay",
    };
    mocks.read.mockResolvedValue({ value: { sources: [wallet], links: [] } });
    const action = interpretLocalAssistant(
      "i want to add netflix subscription started on 7 november 2026 and it's an auto renewal every month, i linked it to my redotpay wallet",
      false,
    );
    if (action.kind !== "add_subscription")
      throw new Error("Expected a draft.");
    const initial = await resolveAssistantAction(action, "guest");
    expect(initial.text).toMatch(/price, currency code/);
    expect(initial.text).not.toContain("next renewal");
    const complete = mergeAssistantDraft(
      interpretLocalAssistant("it's 5 euro", true),
      action,
    );
    const preview = await resolveAssistantAction(complete, "guest");
    expect(preview.rows).toContainEqual({
      label: "Payment method",
      value: "RedotPay",
    });
    expect(mocks.read).toHaveBeenCalledWith(
      "guest",
      "payment_sources",
      expect.anything(),
      expect.anything(),
    );
    expect(mocks.save).not.toHaveBeenCalled();
    if (!preview.next || !("run" in preview.next))
      throw new Error("Expected confirmation.");
    await preview.next.run();
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "guest",
        name: "netflix",
        currency: "EUR",
        amountMinor: 500,
        startDate: "2026-11-07",
        nextRenewal: "2026-12-07",
        paymentMethod: "billing:" + wallet.id,
      }),
      undefined,
      undefined,
      "guest",
    );
  } finally {
    vi.useRealTimers();
  }
});

it("lists only the active workspace owner’s saved subscriptions", async () => {
  const other = {
    ...spotify,
    id: "other",
    userId: "another-account",
    name: "Other account plan",
  };
  const guest = {
    ...spotify,
    id: "guest",
    userId: "guest",
    name: "Local plan",
  };
  snapshot.subscriptions.push(other, guest);
  const list = await resolveAssistantAction(
    { kind: "list_subscriptions" },
    identity,
  );
  expect(list.rows?.map((row) => row.label)).toEqual(["Spotify"]);
  const missing = await resolveAssistantAction(
    { kind: "subscription", name: other.name },
    identity,
  );
  expect(missing.text).toMatch(/couldn’t find/);
  expect(missing.rows).toBeUndefined();
  mocks.getState.mockReturnValue({
    identity: "guest",
    hydrated: true,
    data: snapshot,
  });
  const localList = await resolveAssistantAction(
    interpretLocalAssistant("List my subscriptions", false),
    "guest",
  );
  expect(localList.rows?.map((row) => row.label)).toEqual(["Local plan"]);
  await expect(
    resolveAssistantAction({ kind: "list_subscriptions" }, identity),
  ).rejects.toThrow(/workspace changed/);
});

it("rejects model-generated prose and stops payment lookups when the account changes", async () => {
  expect(
    assistantResponseSchema.safeParse({
      action: {
        kind: "clarify",
        question: "This model cannot speak directly to users",
      },
    }).success,
  ).toBe(false);
  mocks.read.mockImplementation(async () => {
    mocks.getState.mockReturnValue({
      identity: "another-account",
      hydrated: true,
      data: snapshot,
    });
    return { value: { sources: [], links: [] } };
  });
  await expect(
    resolveAssistantAction({ kind: "list_billing" }, identity),
  ).rejects.toThrow(/workspace changed/);
  expect(mocks.save).not.toHaveBeenCalled();
});

it("keeps reminder timing separate from delivery settings", async () => {
  const timing = {
    kind: "reminders",
    days: [3, 1],
    hour: 10,
    quietStart: null,
    quietEnd: null,
  } as const;
  expect(
    interpretLocalAssistant(
      "Remind me 3 days and 1 day before renewal at 10 am.",
      false,
    ),
  ).toMatchObject({ kind: "reminders", days: [1, 3], hour: 10 });
  expect(
    assistantResponseSchema.safeParse({ action: { ...timing, email: true } })
      .success,
  ).toBe(false);
  const draft = await resolveAssistantAction(
    { ...timing, days: [...timing.days] },
    identity,
  );
  if (!draft.next || !("run" in draft.next))
    throw new Error("Expected a confirmation action.");
  await draft.next.run();
  expect(mocks.preferences).toHaveBeenCalledWith(
    {
      reminderDays: [3, 1],
      reminderHour: 10,
    },
    identity,
  );
});

it("totals the next calendar month without including the current month’s charges", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-10T12:00:00Z"));
  try {
    snapshot.preferences.timezone = "Africa/Tunis";
    snapshot.subscriptions = [
      {
        ...spotify,
        name: "Gym membership",
        interval: "yearly",
        amountMinor: 3000,
        nextRenewal: "2026-11-28",
        anchorDay: 28,
      },
      {
        ...spotify,
        name: "ChatGPT",
        amountMinor: 2000,
        nextRenewal: "2026-12-02",
        anchorDay: 2,
      },
      {
        ...spotify,
        name: "Netflix",
        amountMinor: 500,
        currency: "EUR",
        nextRenewal: "2026-12-09",
        anchorDay: 9,
      },
      {
        ...spotify,
        userId: "foreign",
        name: "Foreign plan",
        nextRenewal: "2026-12-12",
        anchorDay: 12,
      },
    ];
    const action = interpretLocalAssistant(
      "tell me how much i will spend next month",
      false,
    );
    const reply = await resolveAssistantAction(action, identity);
    expect(reply.title).toBe("Estimated spending · December 2026");
    expect(reply.rows).toEqual([
      { label: "EUR total", value: "€5.00" },
      { label: "USD total", value: "$20.00" },
      { label: "ChatGPT", value: "Dec 2, 2026 · $20.00" },
      { label: "Netflix", value: "Dec 9, 2026 · €5.00" },
    ]);
    expect(assistantLegacyResponseSchema.safeParse({ action }).success).toBe(
      false,
    );
    expect(assistantResponseSchema.safeParse({ action }).success).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});

it("reviews a Spotify price edit and deletion before writing the exact saved version", async () => {
  const edit = await resolveAssistantAction(
    interpretLocalAssistant("change the price of Spotify to 8 euro", false),
    identity,
  );
  expect(edit.rows).toEqual([{ label: "Price", value: "€8.00 · EUR" }]);
  expect(mocks.save).not.toHaveBeenCalled();
  if (!edit.next || !("run" in edit.next))
    throw new Error("Expected edit confirmation.");
  await edit.next.run();
  expect(mocks.save).toHaveBeenCalledWith(
    expect.objectContaining({
      id: spotify.id,
      amountMinor: 800,
      currency: "EUR",
      nextRenewal: spotify.nextRenewal,
    }),
    undefined,
    spotify.version,
    identity,
  );
  const removal = await resolveAssistantAction(
    interpretLocalAssistant("delete my Spotify subscription", false),
    identity,
  );
  expect(mocks.remove).not.toHaveBeenCalled();
  if (!removal.next || !("run" in removal.next))
    throw new Error("Expected delete confirmation.");
  expect(removal.next.danger).toBe(true);
  await removal.next.run();
  expect(mocks.remove).toHaveBeenCalledWith(
    spotify.id,
    spotify.version,
    identity,
  );
});

it("revises an already-complete add draft when the user corrects its start date", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-10T12:00:00Z"));
  try {
    snapshot.preferences.timezone = "UTC";
    snapshot.subscriptions = [];
    const initial = interpretLocalAssistant(
      "Add Spotify for 5 euro per month, started on 10 November 2026",
      false,
    );
    if (initial.kind !== "add_subscription")
      throw new Error("Expected a new draft.");
    const before = await resolveAssistantAction(initial, identity);
    expect(before.rows).toContainEqual({
      label: "Start date",
      value: "Nov 10, 2026",
    });
    const update = interpretLocalAssistant("it been started from 7 nov", true, {
      today: "2026-11-10",
      pending: initial,
    });
    const revised = await resolveAssistantAction(
      mergeAssistantDraft(update, initial),
      identity,
    );
    expect(revised.rows).toContainEqual({
      label: "Start date",
      value: "Nov 7, 2026",
    });
    expect(revised.rows).toContainEqual({
      label: "Next renewal",
      value: "Dec 7, 2026",
    });
    expect(revised.rows).toContainEqual({
      label: "Price",
      value: "€5.00 · monthly",
    });
    expect(mocks.save).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

it("adds, edits, and removes payment labels through reviewed, versioned saves", async () => {
  let record = { value: { sources: [], links: [] }, version: 0 };
  mocks.read.mockImplementation(async () => record);
  mocks.write.mockImplementation(
    async (_identity, _key, _schema, value, version) => {
      expect(version).toBe(record.version);
      record = { value, version: version + 1 };
      return record.version;
    },
  );
  const confirm = async (command: string, label: string) => {
    const reply = await resolveAssistantAction(
      interpretLocalAssistant(command, false),
      identity,
    );
    if (!reply.next || !("run" in reply.next))
      throw new Error("Expected payment confirmation: " + reply.text);
    expect(reply.next.label).toBe(label);
    await reply.next.run();
  };
  await confirm(
    "add a Visa card ending in 1234 called Travel",
    "Add payment method",
  );
  expect(record.value.sources).toEqual([
    expect.objectContaining({
      name: "Travel",
      cardBrand: "Visa",
      last4: "1234",
    }),
  ]);
  await confirm("rename my Travel card to Daily", "Save payment method");
  expect(record.value.sources).toEqual([
    expect.objectContaining({ name: "Daily", last4: "1234" }),
  ]);
  await confirm("remove my Daily card", "Remove payment method");
  expect(record.value.sources).toEqual([]);
  expect(mocks.write).toHaveBeenCalledTimes(3);
});
