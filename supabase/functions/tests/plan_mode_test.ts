import { type admin, HttpError } from "../_shared/http.ts";
import { requirePaidPlans } from "../_shared/plan-mode.ts";

function client(data: unknown, error: unknown = null) {
  return {
    rpc: (name: string) => {
      if (name !== "pro_plan_enabled") throw new Error("Unexpected RPC");
      return Promise.resolve({ data, error });
    },
  } as unknown as ReturnType<typeof admin>;
}
Deno.test("checkout is allowed only when paid plans are enabled", async () => {
  await requirePaidPlans(client(true));
  for (
    const [data, error, status] of [
      [false, null, 409],
      [null, null, 503],
      ["false", null, 503],
      [true, { message: "unavailable" }, 503],
    ] as const
  ) {
    try {
      await requirePaidPlans(client(data, error));
      throw new Error("Checkout should have been blocked");
    } catch (e) {
      if (!(e instanceof HttpError) || e.status !== status) throw e;
    }
  }
});
