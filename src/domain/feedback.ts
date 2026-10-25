import { z } from "zod";

export const feedbackKinds = ["idea", "problem", "feedback"] as const;
export function feedbackTitle(message: string) {
  return Array.from(message.trim().replace(/\s+/g, " ")).slice(0, 60).join("");
}
export const feedbackDraftSchema = z
  .object({
    kind: z.enum(feedbackKinds),
    title: z
      .string()
      .trim()
      .min(3, "Add a short title (at least 3 characters).")
      .max(120),
    message: z
      .string()
      .trim()
      .min(10, "Tell us a little more (at least 10 characters).")
      .max(4000),
    replyEmail: z
      .string()
      .trim()
      .email("Enter a valid email, or leave it empty.")
      .max(254)
      .nullable(),
  })
  .strict();
export const feedbackRequestSchema = feedbackDraftSchema
  .extend({
    id: z.string().uuid(),
    platform: z.enum(["web", "ios", "android", "macos", "windows"]),
    appVersion: z.string().trim().min(1).max(40),
  })
  .strict();
export type FeedbackDraft = z.infer<typeof feedbackDraftSchema>;
export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>;
