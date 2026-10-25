import { FunctionsHttpError } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { z } from "zod";
import { feedbackRequestSchema, type FeedbackDraft } from "../domain/feedback";
import { supabase } from "./supabase";
import { macosBridge } from "./macosBridge";
import { windowsBridge } from "./windowsBridge";

export async function sendFeedback(draft: FeedbackDraft, id: string) {
  if (!supabase)
    throw new Error("Feedback is not available in this build yet.");
  const body = feedbackRequestSchema.parse({
    ...draft,
    id,
    platform: macosBridge()
      ? "macos"
      : windowsBridge()
        ? "windows"
        : Platform.OS === "ios" || Platform.OS === "android"
          ? Platform.OS
          : "web",
    appVersion: Constants.expoConfig?.version || "unknown",
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const { data, error } = await supabase.functions.invoke("submit-feedback", {
      body,
      signal: controller.signal,
    });
    if (error) {
      let message =
        "Couldn’t send your feedback. Check your connection and try again.";
      if (error instanceof FunctionsHttpError) {
        try {
          const details = z
            .object({ error: z.string().min(1).max(240) })
            .parse(await error.context.json());
          message = details.error;
        } catch {
          /* Keep the recovery message if the server cannot be read. */
        }
      }
      throw new Error(message);
    }
    const result = z
      .object({ accepted: z.literal(true), id: z.literal(id) })
      .safeParse(data);
    if (!result.success)
      throw new Error(
        "Your submission could not be confirmed. Please try again.",
      );
  } finally {
    clearTimeout(timer);
  }
}
