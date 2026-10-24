import { z } from "zod";
export const updateStateSchema = z.object({
  supported: z.boolean(),
  status: z.enum([
    "idle",
    "checking",
    "current",
    "available",
    "downloading",
    "ready",
    "installing",
    "error",
    "unavailable",
  ]),
  currentVersion: z.string().max(80),
  availableVersion: z.string().max(80).nullable(),
  progress: z.number().min(0).max(100).nullable(),
  error: z.string().max(1000).nullable(),
});
export type AppUpdateState = z.infer<typeof updateStateSchema>;
