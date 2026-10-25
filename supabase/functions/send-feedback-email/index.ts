import { admin, endpoint, json, requireCron } from "../_shared/http.ts";
import { deliverFeedbackEmails } from "../_shared/feedback-email.ts";

export const handler = endpoint(async (req) => {
  requireCron(req);
  return json(await deliverFeedbackEmails(admin()));
});
Deno.serve(handler);
