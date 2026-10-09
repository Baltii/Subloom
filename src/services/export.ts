import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useApp } from "../store/app";
import { supabase } from "./supabase";
export async function exportData() {
  const state = useApp.getState();
  let archive: unknown = {
    exportedAt: new Date().toISOString(),
    scope:
      "Local subscriptions, receipt candidates, preferences, and cached activity",
    pendingSync: state.data.outbox.length > 0,
    ...state.data,
    outbox: undefined,
  };
  if (supabase && state.identity !== "guest") {
    if (state.data.outbox.length)
      throw new Error(
        "Sync your pending changes first to export your complete account.",
      );
    const { data, error } = await supabase.functions.invoke("export-data");
    if (error)
      throw new Error(
        "Could not export account data. Please try again when connected.",
      );
    archive = data;
  }
  const json = JSON.stringify(archive, null, 2),
    name = "subloom-export-" + new Date().toISOString().slice(0, 10) + ".json";
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    if (!(await Sharing.isAvailableAsync()))
      throw new Error("Sharing is not available on this device.");
    const file = new File(Paths.cache, name);
    file.create({ overwrite: true });
    file.write(json);
    try {
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/json",
        dialogTitle: "Export your Subloom data",
      });
    } finally {
      file.delete();
    }
  }
}
