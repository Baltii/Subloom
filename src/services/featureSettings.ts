import { Platform } from "react-native";
import { accountClient } from "./supabase";
import { z } from "zod";
let db: Promise<import("expo-sqlite").SQLiteDatabase> | undefined;
async function database() {
  db ??= import("expo-sqlite").then(async (sqlite) => {
    const connection = await sqlite.openDatabaseAsync("subloom-features.db");
    await connection.execAsync(
      "CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)",
    );
    return connection;
  });
  return db;
}
export async function localSetting(
  identity: string,
  key: string,
  value?: string,
): Promise<string | null> {
  const id = "subloom:features:v1:" + identity + ":" + key;
  if (Platform.OS === "web") {
    if (value !== undefined) globalThis.localStorage.setItem(id, value);
    return globalThis.localStorage.getItem(id);
  }
  const connection = await database();
  if (value !== undefined)
    await connection.runAsync(
      "INSERT INTO settings(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
      id,
      value,
    );
  return (
    (
      await connection.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE id=?",
        id,
      )
    )?.value ?? null
  );
}
export async function readSetting<T>(
  identity: string,
  key: string,
  schema: z.ZodType<T>,
  initial: T,
) {
  if (identity === "guest") {
    const raw = await localSetting(identity, key);
    return { value: raw ? schema.parse(JSON.parse(raw)) : initial, version: 0 };
  }
  const client = await accountClient(identity);
  if (key === "finance") {
    const { data, error } = await client
      .from("finance_journals")
      .select("data,version")
      .eq("user_id", identity)
      .maybeSingle();
    if (error)
      throw new Error(
        "Could not load your financial records. Connect and reload.",
      );
    return {
      value: data ? schema.parse(data.data) : initial,
      version: data?.version ?? 0,
    };
  }
  const { data, error } = await client
    .from("feature_settings")
    .select("data,version")
    .eq("user_id", identity)
    .eq("key", key)
    .maybeSingle();
  if (error)
    throw new Error("Could not load these settings. Connect and try again.");
  return {
    value: data ? schema.parse(data.data) : initial,
    version: data?.version ?? 0,
  };
}
export async function writeSetting<T>(
  identity: string,
  key: string,
  schema: z.ZodType<T>,
  value: T,
  version: number,
) {
  const parsed = schema.parse(value);
  if (identity === "guest") {
    await localSetting(identity, key, JSON.stringify(parsed));
    return 0;
  }
  const client = await accountClient(identity);
  if (key === "finance") {
    const table = client.from("finance_journals");
    const query =
      version === 0
        ? table.insert({ user_id: identity, data: parsed, version: 1 })
        : table
            .update({ data: parsed, version: version + 1 })
            .eq("user_id", identity)
            .eq("version", version);
    const { data, error } = await query.select("version").single();
    if (error || !data)
      throw new Error(
        "Could not save your financial records. Connect and reload before retrying; your input is still here.",
      );
    return Number(data.version);
  }
  const { data, error } = await client.rpc("save_feature_setting", {
    setting_key: key,
    setting_data: parsed,
    expected_version: version,
  });
  if (error)
    throw new Error(
      "Could not save. Another device may have changed these settings. Reload before retrying.",
    );
  return Number(data);
}
export async function clearLocalFeatures(identity: string) {
  const prefix = "subloom:features:v1:" + identity + ":";
  if (Platform.OS === "web") {
    Object.keys(globalThis.localStorage)
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => globalThis.localStorage.removeItem(key));
  } else
    await (
      await database()
    ).runAsync("DELETE FROM settings WHERE id LIKE ?", prefix + "%");
}
