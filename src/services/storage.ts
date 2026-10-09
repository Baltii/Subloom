import { Platform } from "react-native";
import type { Snapshot } from "../domain/models";
import {
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
  const raw =
    Platform.OS === "web"
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
  value.preferences = preferencesSchema.parse(value.preferences);
  return value;
}
export async function saveSnapshot(
  identity: string,
  snapshot: Snapshot,
): Promise<void> {
  const raw = JSON.stringify(snapshot);
  if (Platform.OS === "web")
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
  if (Platform.OS === "web")
    globalThis.localStorage.removeItem("subloom:v1:" + identity);
  else
    await (await db()).runAsync("DELETE FROM snapshots WHERE id = ?", identity);
}
