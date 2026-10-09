import { create } from "zustand";
import * as Crypto from "expo-crypto";
import type {
  Activity,
  Candidate,
  Operation,
  Preferences,
  Snapshot,
  Subscription,
} from "../domain/models";
import {
  candidateSchema,
  emptySnapshot,
  preferencesSchema,
  subscriptionSchema,
} from "../domain/models";
import { duplicateCandidate, possibleMatch } from "../domain/detection";
import { loadSnapshot, saveSnapshot } from "../services/storage";
import { demoSnapshot } from "../services/demo";
import { today } from "../domain/renewal";

type AppState = {
  data: Snapshot;
  identity: string;
  hydrated: boolean;
  error: string | null;
  toast: string | null;
  syncError: string | null;
  syncing: boolean;
  email: string | null;
  pushError: string | null;
  pushDeviceEnabled: boolean | null;
};
export const useApp = create<AppState>(() => ({
  data: emptySnapshot(),
  identity: "guest",
  hydrated: false,
  error: null,
  toast: null,
  syncError: null,
  syncing: false,
  email: null,
  pushError: null,
  pushDeviceEnabled: null,
}));
let writes: Promise<unknown> = Promise.resolve();
let hydrationGeneration = 0;
export function notify(message: string) {
  useApp.setState({ toast: message });
}
export function readableError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
export async function hydrate(identity = "guest") {
  const generation = ++hydrationGeneration;
  if (useApp.getState().identity !== identity)
    useApp.setState({ hydrated: false });
  await writes;
  try {
    const data = await loadSnapshot(identity);
    if (generation !== hydrationGeneration) return;
    useApp.setState({
      data,
      identity,
      hydrated: true,
      error: null,
      syncError: null,
      syncing: false,
      pushError: null,
      pushDeviceEnabled: null,
    });
  } catch (error) {
    if (generation !== hydrationGeneration) return;
    useApp.setState({ hydrated: false, error: readableError(error) });
  }
}
export function commit(
  update: (data: Snapshot) => Snapshot,
  identity = useApp.getState().identity,
): Promise<void> {
  const work = writes.then(async () => {
    const state = useApp.getState();
    if (state.identity !== identity)
      throw new Error(
        "The account changed. Please retry in the current workspace.",
      );
    const next = update(state.data);
    await saveSnapshot(state.identity, next);
    useApp.setState({ data: next, error: null });
  });
  writes = work.catch(() => {});
  return work.catch((error) => {
    if (useApp.getState().identity === identity)
      useApp.setState({ error: readableError(error) });
    throw error;
  });
}
function activity(
  type: Activity["type"],
  title: string,
  detail: string,
  targetId: string | null,
): Activity {
  return {
    id: Crypto.randomUUID(),
    type,
    title,
    detail,
    targetId,
    createdAt: new Date().toISOString(),
  };
}
function op(
  entity: Operation["entity"],
  entityId: string,
  payload: unknown,
  expectedVersion: number | null = null,
  action: Operation["action"] = "put",
): Operation {
  return {
    id: Crypto.randomUUID(),
    entity,
    entityId,
    payload,
    expectedVersion,
    action,
    createdAt: new Date().toISOString(),
  };
}
function queue(data: Snapshot, operation: Operation): Operation[] {
  return useApp.getState().identity === "guest" || data.demo
    ? data.outbox
    : [...data.outbox, operation];
}
export async function finishOnboarding(preferences: Preferences, demo = false) {
  await commit((data) =>
    demo
      ? { ...demoSnapshot(preferences), onboarded: true }
      : {
          ...data,
          preferences: preferencesSchema.parse(preferences),
          onboarded: true,
          outbox: queue(data, op("preferences", "preferences", preferences)),
        },
  );
}
export async function leaveDemo() {
  await commit((data) => ({
    ...emptySnapshot(),
    onboarded: true,
    preferences: data.preferences,
  }));
  notify("Your own space is ready.");
}
export async function saveSubscription(
  input: Subscription,
  candidateId?: string,
) {
  await commit((data) => {
    const previous = data.subscriptions.find((s) => s.id === input.id),
      now = new Date().toISOString();
    const subscription = subscriptionSchema.parse({
      ...input,
      userId: useApp.getState().identity,
      updatedAt: now,
      version: (previous?.version ?? 0) + 1,
    });
    const candidate = candidateId
      ? data.candidates.find((c) => c.id === candidateId)
      : null;
    if (candidateId && (!candidate || candidate.state !== "pending"))
      throw new Error("This candidate has already been reviewed.");
    const statusChanged = previous && previous.status !== subscription.status;
    const type: Activity["type"] = candidate
      ? "confirmed"
      : !previous
        ? "created"
        : statusChanged
          ? subscription.status === "canceled"
            ? "canceled"
            : subscription.status === "paused"
              ? "paused"
              : "resumed"
          : "edited";
    const titles: Record<Activity["type"], string> = {
      created: "Subscription added",
      edited: "Subscription updated",
      canceled: "Cancellation recorded in Subloom",
      paused: "Tracking paused",
      resumed: "Tracking resumed",
      deleted: "Subscription deleted",
      detected: "New receipt to review",
      dismissed: "Receipt dismissed",
      confirmed: "Receipt confirmed",
      reminder: "Reminder update",
    };
    const event = activity(
      type,
      titles[type],
      subscription.name,
      subscription.id,
    );
    const confirmed = candidate
      ? {
          ...candidate,
          state: "confirmed" as const,
          matchedSubscriptionId: subscription.id,
        }
      : null;
    const operation = confirmed
      ? op(
          "confirmation",
          subscription.id,
          { subscription, candidate: confirmed, activity: event },
          previous?.version ?? null,
        )
      : op(
          "subscription",
          subscription.id,
          { subscription, activity: event },
          previous?.version ?? null,
        );
    return {
      ...data,
      subscriptions: [
        subscription,
        ...data.subscriptions.filter((s) => s.id !== subscription.id),
      ],
      candidates: confirmed
        ? data.candidates.map((c) => (c.id === candidateId ? confirmed : c))
        : data.candidates,
      activity: [event, ...data.activity].slice(0, 500),
      outbox: queue(data, operation),
    };
  });
  notify(
    candidateId ? "Receipt confirmed. You’re all set." : "Subscription saved.",
  );
}
export async function changeStatus(
  id: string,
  status: Subscription["status"],
  paidThrough: string | null = null,
) {
  const subscription = useApp
    .getState()
    .data.subscriptions.find((s) => s.id === id);
  if (!subscription) return;
  await saveSubscription({
    ...subscription,
    status,
    canceledAt:
      status === "canceled"
        ? today(useApp.getState().data.preferences.timezone)
        : null,
    paidThrough,
  });
  notify(
    status === "canceled"
      ? "Cancellation recorded in Subloom."
      : status === "paused"
        ? "Tracking paused."
        : "Tracking resumed.",
  );
}
export async function deleteSubscription(id: string) {
  await commit((data) => {
    const subscription = data.subscriptions.find((s) => s.id === id);
    if (!subscription) return data;
    const event = activity(
      "deleted",
      "Subscription deleted",
      subscription.name,
      null,
    );
    return {
      ...data,
      subscriptions: data.subscriptions.filter((s) => s.id !== id),
      activity: [event, ...data.activity],
      outbox: queue(
        data,
        op(
          "subscription",
          id,
          { activity: event },
          subscription.version,
          "delete",
        ),
      ),
    };
  });
  notify("Subscription deleted.");
}
export async function updatePreferences(changes: Partial<Preferences>) {
  await commit((data) => {
    const preferences = preferencesSchema.parse({
      ...data.preferences,
      ...changes,
    });
    return {
      ...data,
      preferences,
      outbox: queue(data, op("preferences", "preferences", preferences)),
    };
  });
}
export async function addCandidate(input: Candidate): Promise<string> {
  let id = input.id;
  await commit((data) => {
    const candidate = candidateSchema.parse(input),
      duplicate = duplicateCandidate(candidate, data.candidates);
    if (duplicate) {
      id = duplicate.id;
      notify("This receipt has already been imported.");
      return data;
    }
    const matched = {
      ...candidate,
      matchedSubscriptionId: possibleMatch(candidate, data.subscriptions),
    };
    const event = activity(
      "detected",
      "New receipt to review",
      matched.merchant,
      matched.id,
    );
    return {
      ...data,
      candidates: [matched, ...data.candidates],
      activity: [event, ...data.activity],
      outbox: queue(
        data,
        op("candidate", matched.id, { candidate: matched, activity: event }),
      ),
    };
  });
  return id;
}
export async function dismissCandidate(id: string) {
  await commit((data) => {
    const candidate = data.candidates.find((c) => c.id === id);
    if (!candidate || candidate.state !== "pending") return data;
    const dismissed = { ...candidate, state: "dismissed" as const },
      event = activity(
        "dismissed",
        "Receipt dismissed",
        candidate.merchant,
        null,
      );
    return {
      ...data,
      candidates: data.candidates.map((c) => (c.id === id ? dismissed : c)),
      activity: [event, ...data.activity],
      outbox: queue(
        data,
        op("candidate", id, { candidate: dismissed, activity: event }),
      ),
    };
  });
  notify("Receipt dismissed.");
}
export async function importGuestData() {
  const guest = await loadSnapshot("guest");
  if (guest.demo)
    throw new Error(
      "Leave the sample workspace before importing your own data.",
    );
  await commit((data) => {
    const existing = new Set(data.subscriptions.map((s) => s.id));
    const imported = guest.subscriptions
      .filter((s) => !existing.has(s.id))
      .map((s) => ({ ...s, userId: useApp.getState().identity, version: 1 }));
    const candidateIds = new Set(data.candidates.map((c) => c.id));
    const candidates = guest.candidates.filter((c) => !candidateIds.has(c.id));
    return {
      ...data,
      onboarded: true,
      subscriptions: [...data.subscriptions, ...imported],
      candidates: [...data.candidates, ...candidates],
      outbox: [
        ...data.outbox,
        ...imported.map((s) =>
          op("subscription", s.id, {
            subscription: s,
            activity: activity(
              "created",
              "Guest subscription imported",
              s.name,
              s.id,
            ),
          }),
        ),
        ...candidates.map((c) =>
          op("candidate", c.id, {
            candidate: c,
            activity: activity(
              "detected",
              "Guest receipt imported",
              c.merchant,
              c.id,
            ),
          }),
        ),
      ],
    };
  });
  notify("Guest subscriptions imported. Your local copy is preserved.");
}
