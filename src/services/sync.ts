import { supabase } from "./supabase";
import { commit, useApp } from "../store/app";
import {
  candidateSchema,
  activitySchema,
  preferencesSchema,
  subscriptionSchema,
} from "../domain/models";
let active: Promise<void> | null = null;
async function pages(table: string): Promise<unknown[]> {
  if (!supabase) return [];
  const result: unknown[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from(table)
      .select("data")
      .order("id")
      .range(offset, offset + 499);
    if (error) throw new Error(error.message);
    result.push(...(data || []).map((row) => row.data));
    if (!data || data.length < 500) break;
  }
  return result;
}
export function syncNow(): Promise<void> {
  if (active) return active;
  active = performSync().finally(() => {
    active = null;
  });
  return active;
}
async function performSync() {
  const identity = useApp.getState().identity;
  if (!supabase || identity === "guest" || useApp.getState().data.demo) return;
  useApp.setState({ syncing: true, syncError: null });
  try {
    while (useApp.getState().identity === identity) {
      const operation = useApp.getState().data.outbox[0];
      if (!operation) break;
      const { error } = await supabase.rpc("apply_operation", { operation });
      if (error)
        throw new Error(
          error.message.includes("conflict")
            ? "A subscription changed on another device. Resolve the sync conflict in Settings; your local changes are safe."
            : error.message,
        );
      if (useApp.getState().identity !== identity) return;
      await commit((data) => ({
        ...data,
        outbox: data.outbox.filter((op) => op.id !== operation.id),
      }));
    }
    const before = useApp.getState().data;
    const [subscriptionData, candidateData, activityData, preferenceResult] =
      await Promise.all([
        pages("subscriptions"),
        pages("detected_candidates"),
        pages("subscription_activity"),
        supabase
          .from("user_preferences")
          .select("data")
          .eq("user_id", identity)
          .maybeSingle(),
      ]);
    if (preferenceResult.error) throw new Error(preferenceResult.error.message);
    if (
      useApp.getState().identity !== identity ||
      useApp.getState().data !== before
    )
      return;
    const subscriptions = subscriptionData.map((s) =>
      subscriptionSchema.parse(s),
    );
    const candidates = candidateData.map((c) => candidateSchema.parse(c));
    const preferences = preferenceResult.data
      ? preferencesSchema.parse(preferenceResult.data.data)
      : before.preferences;
    await commit((data) =>
      data === before
        ? {
            ...data,
            subscriptions,
            candidates,
            preferences,
            activity: activityData
              .map((a) => activitySchema.parse(a))
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .slice(0, 500),
            lastSyncedAt: new Date().toISOString(),
          }
        : data,
    );
  } catch (error) {
    useApp.setState({
      syncError:
        error instanceof Error
          ? error.message
          : "Sync is unavailable. Your changes are saved on this device.",
    });
    throw error;
  } finally {
    useApp.setState({ syncing: false });
  }
}
export async function resolveConflict(strategy: "remote" | "local") {
  if (!supabase) return;
  const operation = useApp.getState().data.outbox[0];
  if (!operation) return;
  if (
    operation.entity !== "subscription" &&
    operation.entity !== "confirmation"
  )
    throw new Error("Retry sync after checking your connection.");
  const { data, error } = await supabase
    .from("subscriptions")
    .select("version")
    .eq("id", operation.entityId)
    .maybeSingle();
  if (error) throw error;
  await commit((snapshot) => {
    if (strategy === "remote")
      return {
        ...snapshot,
        outbox: snapshot.outbox.filter(
          (op) => op.entityId !== operation.entityId,
        ),
      };
    const remoteVersion = (data?.version as number | undefined) ?? null;
    let version = remoteVersion ?? 0;
    const outbox = snapshot.outbox.map((op) => {
      if (op.entityId !== operation.entityId) return op;
      const expectedVersion = version || null;
      version++;
      const payload = op.payload as {
        subscription?: import("../domain/models").Subscription;
      };
      return {
        ...op,
        expectedVersion,
        payload: payload.subscription
          ? { ...payload, subscription: { ...payload.subscription, version } }
          : payload,
      };
    });
    return {
      ...snapshot,
      outbox,
      subscriptions: snapshot.subscriptions.map((s) =>
        s.id === operation.entityId ? { ...s, version } : s,
      ),
    };
  });
  await syncNow();
}
