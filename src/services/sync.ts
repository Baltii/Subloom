import { accountClient, supabase } from "./supabase";
import { commit, useApp } from "../store/app";
import {
  candidateSchema,
  activitySchema,
  preferencesSchema,
  subscriptionSchema,
} from "../domain/models";

let active: Promise<void> | null = null;
let requested = false;
type Client = Awaited<ReturnType<typeof accountClient>>;
function current(identity: string) {
  const state = useApp.getState();
  return state.identity === identity && state.hydrated && !state.data.demo;
}
async function pages(
  client: Client,
  table: string,
  identity: string,
): Promise<unknown[]> {
  const result: unknown[] = [];
  for (let offset = 0; ; offset += 500) {
    if (!current(identity)) return [];
    const { data, error } = await client
      .from(table)
      .select("data")
      .eq("user_id", identity)
      .order("id")
      .range(offset, offset + 499);
    if (error) throw new Error(error.message);
    result.push(...(data || []).map((row) => row.data));
    if (!data || data.length < 500) break;
  }
  return result;
}
async function revision(client: Client, identity: string) {
  const { data, error } = await client
    .from("account_sync_state")
    .select("revision")
    .eq("user_id", identity)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return String(data?.revision ?? "0");
}
export function syncNow(): Promise<void> {
  requested = true;
  if (active) return active;
  active = (async () => {
    while (requested) {
      requested = false;
      const identity = useApp.getState().identity;
      if (supabase && identity !== "guest" && current(identity))
        await performSync(identity);
    }
  })().finally(() => {
    active = null;
  });
  return active;
}
async function performSync(identity: string) {
  useApp.setState({ syncing: true, syncError: null });
  try {
    const client = await accountClient(identity);
    for (let attempt = 0; attempt < 5 && current(identity); attempt++) {
      while (current(identity)) {
        const operation = useApp.getState().data.outbox[0];
        if (!operation) break;
        const { error } = await client.rpc("apply_operation", { operation });
        if (!current(identity)) return;
        if (error)
          throw new Error(
            error.message.toLowerCase().includes("conflict")
              ? "A subscription changed on another device. Resolve the sync conflict in Settings; your local changes are safe."
              : error.message,
          );
        await commit(
          (data) => ({
            ...data,
            outbox: data.outbox.filter((op) => op.id !== operation.id),
          }),
          identity,
        );
      }
      if (!current(identity)) return;
      const before = useApp.getState().data;
      const startRevision = await revision(client, identity);
      const [subscriptionData, candidateData, activityData, preferenceResult] =
        await Promise.all([
          pages(client, "subscriptions", identity),
          pages(client, "detected_candidates", identity),
          pages(client, "subscription_activity", identity),
          client
            .from("user_preferences")
            .select("data")
            .eq("user_id", identity)
            .maybeSingle(),
        ]);
      if (!current(identity)) return;
      if (preferenceResult.error)
        throw new Error(preferenceResult.error.message);
      const endRevision = await revision(client, identity);
      if (!current(identity)) return;
      // A paginated pull is accepted only when the cloud revision and local snapshot stayed stable.
      if (startRevision !== endRevision || useApp.getState().data !== before)
        continue;
      const subscriptions = subscriptionData.map((s) =>
        subscriptionSchema.parse(s),
      );
      const candidates = candidateData.map((c) => candidateSchema.parse(c));
      const preferences = preferenceResult.data
        ? preferencesSchema.parse(preferenceResult.data.data)
        : before.preferences;
      await commit(
        (data) =>
          data === before
            ? {
                ...data,
                subscriptions,
                candidates,
                preferences,
                onboarded:
                  data.onboarded ||
                  Boolean(preferenceResult.data) ||
                  subscriptions.length > 0 ||
                  candidates.length > 0,
                activity: activityData
                  .map((a) => activitySchema.parse(a))
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .slice(0, 500),
                lastSyncedAt: new Date().toISOString(),
              }
            : data,
        identity,
      );
      if (useApp.getState().data.outbox.length) continue;
      return;
    }
    if (current(identity))
      throw new Error(
        "Your account is changing on another device. Sync will retry; local changes are saved.",
      );
  } catch (error) {
    if (!current(identity)) return;
    useApp.setState({
      syncError:
        error instanceof Error
          ? error.message
          : "Sync is unavailable. Your changes are saved on this device.",
    });
    throw error;
  } finally {
    if (current(identity)) useApp.setState({ syncing: false });
  }
}

export function watchAccountChanges(
  identity: string,
  refresh: () => void,
): () => void {
  if (!supabase || identity === "guest") return () => {};
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const changed = () => {
    if (disposed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (!disposed && current(identity)) refresh();
    }, 250);
  };
  const channel = supabase
    .channel("account-sync:" + identity)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "account_sync_state",
        filter: "user_id=eq." + identity,
      },
      changed,
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "account_sync_state",
        filter: "user_id=eq." + identity,
      },
      changed,
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") changed();
    });
  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    void supabase?.removeChannel(channel);
  };
}

export async function resolveConflict(strategy: "remote" | "local") {
  if (active) await active.catch(() => {});
  const identity = useApp.getState().identity;
  if (!current(identity) || identity === "guest") return;
  const operation = useApp.getState().data.outbox[0];
  if (!operation) return;
  if (
    operation.entity !== "subscription" &&
    operation.entity !== "confirmation"
  )
    throw new Error("Retry sync after checking your connection.");
  const client = await accountClient(identity);
  const { data, error } = await client
    .from("subscriptions")
    .select("version")
    .eq("user_id", identity)
    .eq("id", operation.entityId)
    .maybeSingle();
  if (error) throw error;
  if (!current(identity)) return;
  await commit((snapshot) => {
    if (snapshot.outbox[0]?.id !== operation.id) return snapshot;
    if (strategy === "remote")
      return {
        ...snapshot,
        outbox: snapshot.outbox.filter(
          (op) => op.entityId !== operation.entityId,
        ),
      };
    let version: number | null = data?.version ?? null;
    const outbox = snapshot.outbox.map((op) => {
      if (op.entityId !== operation.entityId) return op;
      const expectedVersion = version;
      version = op.action === "delete" ? null : (version ?? 0) + 1;
      const payload = op.payload as {
        subscription?: import("../domain/models").Subscription;
      };
      return {
        ...op,
        expectedVersion,
        payload: payload.subscription
          ? {
              ...payload,
              subscription: { ...payload.subscription, version: version ?? 1 },
            }
          : payload,
      };
    });
    return {
      ...snapshot,
      outbox,
      subscriptions: snapshot.subscriptions.map((s) =>
        s.id === operation.entityId ? { ...s, version: version ?? 1 } : s,
      ),
    };
  }, identity);
  await syncNow();
}
