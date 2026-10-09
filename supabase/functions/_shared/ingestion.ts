import {
  extractReceipt,
  duplicateCandidate,
  possibleMatch,
} from "../../../src/domain/detection.ts";
import {
  subscriptionSchema,
  candidateSchema,
  preferencesSchema,
} from "../../../src/domain/models.ts";
import { admin, HttpError } from "./http.ts";
import { enqueue } from "./delivery.ts";
export async function ingestReceipt(
  client: ReturnType<typeof admin>,
  owner: string,
  text: string,
  providerId: string,
  senderHash: string,
) {
  const candidate = extractReceipt(
    text,
    crypto.randomUUID(),
    "connected_email",
  );
  // The source is a forwarded email, not a mailbox connection. The evidence explains it explicitly.
  candidate.source = "receipt";
  const [
    { data: existing, error: candidateError },
    { data: subscriptions, error: subscriptionError },
  ] = await Promise.all([
    client
      .from("detected_candidates")
      .select("data")
      .eq("user_id", owner)
      .order("created_at", { ascending: false })
      .limit(500),
    client
      .from("subscriptions")
      .select("data")
      .eq("user_id", owner)
      .limit(1000),
  ]);
  if (candidateError || subscriptionError)
    throw new HttpError(500, "Could not compare receipt evidence.");
  const duplicate = duplicateCandidate(
    candidate,
    (existing || []).map((row) => candidateSchema.parse(row.data)),
  );
  let id = duplicate?.id;
  if (!id) {
    candidate.matchedSubscriptionId = possibleMatch(
      candidate,
      (subscriptions || []).map((row) => subscriptionSchema.parse(row.data)),
    );
    const { error } = await client
      .from("detected_candidates")
      .insert({ id: candidate.id, user_id: owner, data: candidate });
    if (error && error.code !== "23505")
      throw new HttpError(500, "Could not save receipt detection.");
    if (error) {
      const { data } = await client
        .from("detected_candidates")
        .select("id")
        .eq("user_id", owner)
        .eq("fingerprint", candidate.fingerprint)
        .single();
      if (!data)
        throw new HttpError(500, "Could not recover receipt detection.");
      id = data.id;
    } else {
      id = candidate.id;
      const activity = {
        id: crypto.randomUUID(),
        type: "detected",
        title: "Forwarded receipt to review",
        detail: candidate.merchant,
        targetId: id,
        createdAt: new Date().toISOString(),
      };
      const { error } = await client
        .from("subscription_activity")
        .insert({ id: activity.id, user_id: owner, data: activity });
      if (error)
        throw new HttpError(500, "Could not record detection activity.");
    }
  }
  const { error: evidenceError } = await client
    .from("detection_evidence_metadata")
    .upsert(
      {
        user_id: owner,
        candidate_id: id,
        provider_message_id: providerId,
        sender_hash: senderHash,
        fingerprint: candidate.fingerprint,
      },
      { onConflict: "user_id,provider_message_id", ignoreDuplicates: true },
    );
  if (evidenceError)
    throw new HttpError(500, "Could not record receipt evidence.");
  const { data: preferences } = await client
    .from("user_preferences")
    .select("data")
    .eq("user_id", owner)
    .maybeSingle();
  if (preferences && (!duplicate || duplicate.state === "pending")) {
    const p = preferencesSchema.parse(preferences.data);
    const { data: user } = await client.auth.admin.getUserById(owner);
    const { data: devices } = await client
      .from("push_devices")
      .select("token")
      .eq("user_id", owner)
      .eq("enabled", true);
    await enqueue(
      client,
      {
        userId: owner,
        key: "candidate:" + id,
        kind: "candidate",
        dueAt: new Date().toISOString(),
        payload: {
          title: "A receipt worth a look.",
          body:
            "Potential subscription detected: " +
            candidate.merchant +
            ". Review before adding it.",
          path: "/detection/" + id,
        },
      },
      {
        email:
          p.emailEnabled && user.user?.email_confirmed_at
            ? user.user.email
            : undefined,
        tokens: p.pushEnabled
          ? (devices || []).map((d) => d.token as string)
          : [],
      },
    );
  }
  return id;
}
