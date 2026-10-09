import {
  authenticated,
  endpoint,
  HttpError,
  json,
  rateLimit,
} from "../_shared/http.ts";
export const handler = endpoint(async (req) => {
  const { client, user } = await authenticated(req);
  await rateLimit(client, "delete:" + user.id, 3, 3600, user.id);
  // All user-owned rows, aliases, events, and deliveries cascade from auth.users.
  // No files or OAuth credentials are retained in this MVP.
  const { error } = await client.auth.admin.deleteUser(user.id, false);
  if (error)
    throw new HttpError(500, "Account deletion could not be completed.");
  return json({ deleted: true });
});
Deno.serve(handler);
