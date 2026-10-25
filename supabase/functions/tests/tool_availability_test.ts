import {
  requireMailboxActionAvailable,
  mailboxCallbackUnavailable,
} from "../_shared/tool-availability.ts";
import { HttpError } from "../_shared/http.ts";
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Assertion failed");
}
Deno.test(
  "mailbox discovery blocks connections and scans but keeps status and disconnect available",
  () => {
    for (const action of ["connect", "scan"]) {
      let denied = false;
      try {
        requireMailboxActionAvailable(action);
      } catch (error) {
        assert(error instanceof HttpError && error.status === 503);
        denied = true;
      }
      assert(denied);
    }
    requireMailboxActionAvailable("status");
    requireMailboxActionAvailable("disconnect");
  },
);
Deno.test(
  "pending mailbox OAuth callbacks fail closed before accepting provider tokens",
  async () => {
    const response = mailboxCallbackUnavailable();
    assert(response?.status === 503);
    assert(response.headers.get("Cache-Control") === "no-store");
    assert((await response.text()).includes("coming soon"));
  },
);
