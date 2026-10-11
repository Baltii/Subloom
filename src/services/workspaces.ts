import { accountClient } from "./supabase";
import {
  workspaceSchema,
  memberSchema,
  sharedSubscriptionSchema,
} from "../domain/workspaces";
export async function workspaceData(identity: string) {
  const client = await accountClient(identity);
  async function rows(table: string) {
    const values: unknown[] = [];
    for (let start = 0; ; start += 500) {
      const { data, error } = await client
        .from(table)
        .select("*")
        .order(table === "workspace_members" ? "user_id" : "id")
        .range(start, start + 499);
      if (error)
        throw new Error(
          "Shared spaces could not load. Check connection and migration setup.",
        );
      values.push(...(data || []));
      if (!data || data.length < 500) return values;
    }
  }
  const [workspaces, members, subscriptions] = await Promise.all([
    rows("workspaces"),
    rows("workspace_members"),
    rows("workspace_subscriptions"),
  ]);
  return {
    workspaces: workspaces.map((row) => workspaceSchema.parse(row)),
    members: members.map((row) => memberSchema.parse(row)),
    subscriptions: subscriptions.map((row) =>
      sharedSubscriptionSchema.parse(row),
    ),
  };
}
export async function workspaceRpc(
  identity: string,
  name: string,
  args: Record<string, unknown>,
) {
  const client = await accountClient(identity);
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
