import { Webhook } from "svix";
import { endpoint } from "../_shared/http.ts";
import { acknowledgeRetiredReceipt } from "../_shared/retired-receipt.ts";

function assert(value: unknown): asserts value {
  if (!value) throw new Error("Assertion failed");
}

Deno.test(
  "retired receipt endpoint validates signatures then ignores delivery without fetching email",
  async () => {
    const previous = Deno.env.get("RESEND_WEBHOOK_SECRET");
    const originalFetch = globalThis.fetch;
    const secret = "whsec_" + btoa("retired-receipt-test-signing-key");
    const body = JSON.stringify({
      type: "email.received",
      data: { email_id: "legacy" },
    });
    const now = new Date();
    const id = "msg_retired_test";
    const signature = new Webhook(secret).sign(id, now, body);
    Deno.env.set("RESEND_WEBHOOK_SECRET", secret);
    globalThis.fetch = () => {
      throw new Error("Retired receipts must not call a provider or database");
    };
    try {
      const handler = endpoint(acknowledgeRetiredReceipt);
      function request(payload: string, signed = true) {
        return new Request("https://example.test/inbound-receipt", {
          method: "POST",
          body: payload,
          headers: signed
            ? {
                "svix-id": id,
                "svix-timestamp": String(Math.floor(now.getTime() / 1000)),
                "svix-signature": signature,
              }
            : {},
        });
      }
      const response = await handler(request(body));
      assert(response.status === 200);
      const result = await response.json();
      assert(
        result.ignored === true &&
          result.reason.includes("no longer available"),
      );
      assert((await handler(request(body + " "))).status === 401);
      assert((await handler(request(body, false))).status === 401);
      assert((await handler(request("x".repeat(250_001)))).status === 413);
    } finally {
      globalThis.fetch = originalFetch;
      if (previous === undefined) Deno.env.delete("RESEND_WEBHOOK_SECRET");
      else Deno.env.set("RESEND_WEBHOOK_SECRET", previous);
    }
  },
);
