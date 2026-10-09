import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

const authStorage = {
  async getItem(key: string) {
    if (Platform.OS === "web") return globalThis.localStorage.getItem(key);
    const metadata = await SecureStore.getItemAsync(key + ".meta");
    if (!metadata) return null;
    const { generation, count } = JSON.parse(metadata) as {
      generation: string;
      count: number;
    };
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.getItemAsync(key + "." + generation + "." + i),
      ),
    );
    return chunks.every((v) => v !== null) ? chunks.join("") : null;
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === "web") {
      globalThis.localStorage.setItem(key, value);
      return;
    }
    const previous = await SecureStore.getItemAsync(key + ".meta");
    const generation = Crypto.randomUUID(),
      chunks = value.match(/.{1,1500}/gs) || [];
    for (const [i, chunk] of chunks.entries())
      await SecureStore.setItemAsync(key + "." + generation + "." + i, chunk);
    await SecureStore.setItemAsync(
      key + ".meta",
      JSON.stringify({ generation, count: chunks.length }),
    );
    if (previous) {
      const old = JSON.parse(previous) as { generation: string; count: number };
      await Promise.all(
        Array.from({ length: old.count }, (_, i) =>
          SecureStore.deleteItemAsync(key + "." + old.generation + "." + i),
        ),
      );
    }
  },
  async removeItem(key: string) {
    if (Platform.OS === "web") {
      globalThis.localStorage.removeItem(key);
      return;
    }
    const metadata = await SecureStore.getItemAsync(key + ".meta");
    await SecureStore.deleteItemAsync(key + ".meta");
    if (metadata) {
      const old = JSON.parse(metadata) as { generation: string; count: number };
      await Promise.all(
        Array.from({ length: old.count }, (_, i) =>
          SecureStore.deleteItemAsync(key + "." + old.generation + "." + i),
        ),
      );
    }
  },
};
const url = process.env.EXPO_PUBLIC_SUPABASE_URL,
  key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const backendConfigured = Boolean(url && key);
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: authStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;
export function startSessionRefresh() {
  if (!supabase || Platform.OS === "web") return () => {};
  if (AppState.currentState === "active") supabase.auth.startAutoRefresh();
  const listener = AppState.addEventListener("change", (state) =>
    state === "active"
      ? supabase.auth.startAutoRefresh()
      : supabase.auth.stopAutoRefresh(),
  );
  return () => {
    listener.remove();
    supabase.auth.stopAutoRefresh();
  };
}
