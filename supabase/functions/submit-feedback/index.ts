import { admin, endpoint, env } from "../_shared/http.ts";
import { receiveFeedback } from "../_shared/feedback.ts";
import { deliverFeedbackEmails } from "../_shared/feedback-email.ts";

// Intentionally available to guests. Validation and spam controls run server-side.
export const handler = endpoint((req) => {
  const client = admin();
  return receiveFeedback(
    req,
    client,
    env("SUPABASE_SERVICE_ROLE_KEY"),
    (id) => deliverFeedbackEmails(client, id),
  );
});
Deno.serve(handler);
