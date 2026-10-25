import { type admin, HttpError } from "./http.ts";

export async function requirePaidPlans(client: ReturnType<typeof admin>) {
  const { data, error } = await client.rpc("pro_plan_enabled");
  if (error || typeof data !== "boolean") {
    throw new HttpError(
      503,
      "Plan configuration is unavailable. Try again later.",
    );
  }
  if (!data) {
    throw new HttpError(409, "Subloom is free to use. No paid plan is needed.");
  }
}
