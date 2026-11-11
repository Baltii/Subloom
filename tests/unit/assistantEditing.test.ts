import { expect, it } from "vitest";
import { interpretLocalAssistant } from "../../src/domain/localAssistant";
import {
  mergeAssistantDraft,
  type AssistantDraft,
} from "../../src/domain/assistantProtocol";
import { editAssistantSubscription } from "../../src/domain/assistantSubscriptionEdits";
import { subscription } from "../fixtures";

it("keeps dates and prices inside notes from changing billing fields", () => {
  const result = interpretLocalAssistant(
    "change Spotify notes to Family budget 15 EUR monthly",
    false,
  );
  expect(result).toEqual({
    kind: "edit_subscription",
    subscription: "Spotify",
    changes: [{ field: "notes", value: "Family budget 15 EUR monthly" }],
  });
});
it("uses the last plan for a direct correction but never converts a question into an edit", () => {
  expect(
    interpretLocalAssistant("change it to 5 euro", false, {
      subscription: "Spotify",
    }),
  ).toEqual({
    kind: "edit_subscription",
    subscription: "Spotify",
    changes: [
      { field: "price", value: "5" },
      { field: "currency", value: "EUR" },
    ],
  });
  expect(
    interpretLocalAssistant("delete it", false, { subscription: "Spotify" }),
  ).toEqual({ kind: "delete_subscription", subscription: "Spotify" });
  expect(
    interpretLocalAssistant("is it 5 euro?", false, {
      subscription: "Spotify",
    }),
  ).toEqual({ kind: "help" });
});
it("edits trial, custom schedule, notes, category and per-plan reminders without overwriting unrelated data", () => {
  const original = subscription();
  const edited = editAssistantSubscription(
    original,
    [
      { field: "status", value: "trial" },
      { field: "trialEnd", value: "2026-02-14" },
      { field: "nextRenewal", value: "2026-02-14" },
      { field: "interval", value: "custom" },
      { field: "intervalCount", value: "2" },
      { field: "customUnit", value: "week" },
      { field: "category", value: "Education" },
      { field: "notes", value: "Family plan" },
      { field: "reminderDays", value: "3,1" },
      { field: "remindersEnabled", value: "true" },
    ],
    "2026-02-01",
  );
  expect(edited).toMatchObject({
    status: "trial",
    trialEnd: "2026-02-14",
    nextRenewal: "2026-02-14",
    anchorDay: 14,
    interval: "custom",
    intervalCount: 2,
    customUnit: "week",
    category: "Education",
    notes: "Family plan",
    reminders: { enabled: true, days: [3, 1] },
  });
  expect(edited.amountMinor).toBe(original.amountMinor);
  expect(edited.userId).toBe(original.userId);
});
it("retains extra draft details through follow-ups and resets a custom cadence when changed to monthly", () => {
  const initial = interpretLocalAssistant(
    "add Spotify for 5 euro every 2 weeks started on 7 November 2026",
    false,
    { today: "2026-11-11" },
  ) as AssistantDraft;
  expect(initial.details).toContainEqual({
    field: "intervalCount",
    value: "2",
  });
  const next = mergeAssistantDraft(
    interpretLocalAssistant("notes to Family plan", true, { pending: initial }),
    initial,
  ) as AssistantDraft;
  expect(next.details).toContainEqual({ field: "notes", value: "Family plan" });
  const monthly = mergeAssistantDraft(
    {
      kind: "edit_subscription",
      subscription: "Spotify",
      changes: [{ field: "interval", value: "monthly" }],
    },
    next,
  ) as AssistantDraft;
  expect(monthly.interval).toBe("monthly");
  expect(monthly.details).toEqual([{ field: "notes", value: "Family plan" }]);
});
