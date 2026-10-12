import { Platform } from "react-native";
import type { Snapshot } from "../domain/models";
import { macosBridge, macosRequest } from "./macosBridge";
import {
  pricePointSchema,
  candidateSchema,
  activitySchema,
  emptySnapshot,
  preferencesSchema,
  subscriptionSchema,
} from "../domain/models";

let database: Promise<import("expo-sqlite").SQLiteDatabase> | undefined;
function db() {
  database ??= import("expo-sqlite").then(async (sqlite) => {
    const connection = await sqlite.openDatabaseAsync("subloom.db");
    await connection.execAsync(
      "PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS snapshots (id TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);",
    );
    return connection;
  });
  return database;
}
export async function loadSnapshot(identity: string): Promise<Snapshot> {
  const native = Boolean(macosBridge());
  const stored = native
    ? await macosRequest<string | null>("snapshot.read", { identity })
    : null;
  const raw =
    native && stored !== null
      ? stored
      : Platform.OS === "web"
        ? globalThis.localStorage.getItem("subloom:v1:" + identity)
        : (
            await (
              await db()
            ).getFirstAsync<{ value: string }>(
              "SELECT value FROM snapshots WHERE id = ?",
              identity,
            )
          )?.value;
  if (!raw) return emptySnapshot();
  const value = JSON.parse(raw) as Snapshot;
  if (
    value.schemaVersion !== 1 ||
    !Array.isArray(value.outbox) ||
    !Array.isArray(value.activity)
  )
    throw new Error(
      "This local data needs a newer version of Subloom. Your data has been preserved.",
    );
  value.subscriptions = value.subscriptions.map((s) =>
    subscriptionSchema.parse(s),
  );
  value.candidates = value.candidates.map((c) => candidateSchema.parse(c));
  value.activity = value.activity.map((a) => activitySchema.parse(a));
  value.priceHistory = (value.priceHistory ?? []).map((point) =>
    pricePointSchema.parse(point),
  );
  value.preferences = preferencesSchema.parse(value.preferences);
  // Migrate the existing WebKit snapshot only after schema validation. Keep its
  // local copy until an explicit reset; a failed native write never loses it.
  if (native && stored === null)
    await macosRequest("snapshot.write", {
      identity,
      value: JSON.stringify(value),
    });
  return value;
}
export async function saveSnapshot(
  identity: string,
  snapshot: Snapshot,
): Promise<void> {
  const raw = JSON.stringify(snapshot);
  if (macosBridge())
    await macosRequest("snapshot.write", { identity, value: raw });
  else if (Platform.OS === "web")
    globalThis.localStorage.setItem("subloom:v1:" + identity, raw);
  else
    await (
      await db()
    ).runAsync(
      "INSERT INTO snapshots (id, value) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value",
      identity,
      raw,
    );
}
export async function removeSnapshot(identity: string) {
  // Remove the migration source first. If either deletion fails, the native
  // authoritative copy survives rather than resurrecting stale WebKit data.
  if (Platform.OS === "web")
    globalThis.localStorage.removeItem("subloom:v1:" + identity);
  else
    await (await db()).runAsync("DELETE FROM snapshots WHERE id = ?", identity);
  if (macosBridge()) await macosRequest("snapshot.remove", { identity });
}
