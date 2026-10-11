import { z } from "zod";
import {
  authenticated,
  endpoint,
  HttpError,
  json,
  limited,
  rateLimit,
  sha256,
} from "../_shared/http.ts";
import {
  authorizationUrl,
  returnUrl,
  receiptMessages,
  tokensSchema,
  tokenRequest,
} from "../_shared/mailbox-providers.ts";
import {
  seal,
  unseal,
  base64url,
  challenge,
} from "../_shared/mailbox-crypto.ts";
import { ingestReceipt } from "../_shared/ingestion.ts";
export const handler = endpoint(async (req) => {
  const { client, user } = await authenticated(req);
  const body = z
    .object({
      action: z.enum(["status", "connect", "scan", "disconnect"]),
      provider: z.enum(["gmail", "outlook"]).optional(),
      consent: z.boolean().optional(),
      returnKind: z.enum(["web", "native"]).default("web"),
    })
    .parse(JSON.parse(await limited(req, 4096)));
  await rateLimit(client, "mailbox:" + user.id, 40, 3600, user.id);
  if (body.action === "status") {
    const { data, error } = await client
      .from("mailbox_connections")
      .select("id,provider,status,connected_at,last_scanned_at")
      .eq("user_id", user.id);
    if (error) throw new HttpError(500, "Mailbox connections could not load.");
    return json({ connections: data });
  }
  const provider = body.provider;
  if (!provider) throw new HttpError(400, "Choose a mailbox provider.");
  const context = "tokens:" + user.id + ":" + provider;
  if (body.action === "connect") {
    if (!body.consent || !user.email_confirmed_at)
      throw new HttpError(
        403,
        "Verify your account and explicitly consent to read-only mailbox access.",
      );
    await rateLimit(client, "mailbox-connect:" + user.id, 10, 3600, user.id);
    returnUrl(body.returnKind);
    const state = base64url(crypto.getRandomValues(new Uint8Array(32))),
      verifier = base64url(crypto.getRandomValues(new Uint8Array(32))),
      url = authorizationUrl(provider, state, await challenge(verifier));
    const { error } = await client.rpc("begin_mailbox_connection", {
      owner: user.id,
      mail_provider: provider,
      hash: await sha256(state),
      verifier: await seal(verifier, "verifier:" + user.id + ":" + provider),
      target: body.returnKind,
    });
    if (error)
      throw new HttpError(
        409,
        "Disconnect the existing connection or retry this connection.",
      );
    return json({ url });
  }
  if (body.action === "disconnect") {
    const { data, error } = await client.rpc("disconnect_mailbox", {
      owner: user.id,
      mail_provider: provider,
    });
    if (error)
      throw new HttpError(500, "Mailbox disconnect failed. Try again.");
    let providerRevoked = false;
    if (provider === "gmail" && typeof data === "string") {
      try {
        const tokens = tokensSchema.parse(
          JSON.parse(await unseal(data, context)),
        );
        const response = await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            token: tokens.refresh_token || tokens.access_token,
          }),
          signal: AbortSignal.timeout(15000),
        });
        providerRevoked = response.ok;
      } catch {
        /* Stored access is already removed. The user can revoke provider consent separately. */
      }
    }
    return json({ ok: true, providerRevoked });
  }
  await rateLimit(client, "mailbox-scan:" + user.id, 4, 3600, user.id);
  const { data: lease, error: leaseError } = await client.rpc(
    "claim_mailbox_scan",
    { owner: user.id, mail_provider: provider },
  );
  if (leaseError || !lease)
    throw new HttpError(
      409,
      "This mailbox is disconnected or a scan is already running.",
    );
  let reviewed = 0;
  const ids: string[] = [];
  try {
    let tokens = tokensSchema.parse(
      JSON.parse(await unseal(lease.tokens, context)),
    );
    if (tokens.expires_at <= Date.now() + 60000) {
      if (!tokens.refresh_token)
        throw new HttpError(401, "Reconnect this mailbox to scan again.");
      tokens = await tokenRequest(
        provider,
        { grant_type: "refresh_token", refresh_token: tokens.refresh_token },
        tokens,
      );
      const { error } = await client.rpc("store_mailbox_tokens", {
        connection: lease.id,
        expected_generation: lease.generation,
        tokens: await seal(JSON.stringify(tokens), context),
      });
      if (error)
        throw new HttpError(409, "Mailbox connection changed during refresh.");
    }
    const messages = await receiptMessages(provider, tokens.access_token);
    for (const message of messages) {
      const { data: connection, error } = await client
        .from("mailbox_connections")
        .select("status,generation")
        .eq("id", lease.id)
        .eq("user_id", user.id)
        .single();
      if (
        error ||
        connection.status !== "connected" ||
        connection.generation !== lease.generation
      )
        throw new HttpError(
          409,
          "Mailbox disconnected during scan. Earlier detections remain available for review.",
        );
      if (!/subscription|renewal|invoice|receipt|billing/i.test(message.text))
        continue;
      ids.push(
        await ingestReceipt(
          client,
          user.id,
          message.text,
          provider + ":" + lease.id + ":" + message.id,
          await sha256(message.sender.toLowerCase()),
          "connected_email",
        ),
      );
      reviewed++;
    }
    const { error } = await client
      .from("mailbox_connections")
      .update({ last_scanned_at: new Date().toISOString() })
      .eq("id", lease.id)
      .eq("generation", lease.generation)
      .eq("status", "connected");
    if (error)
      throw new HttpError(
        500,
        "Scan completed but its status could not be saved.",
      );
    return json({ reviewed, candidateIds: [...new Set(ids)] });
  } finally {
    await client
      .from("mailbox_connections")
      .update({ scan_until: null })
      .eq("id", lease.id)
      .eq("generation", lease.generation);
  }
});
Deno.serve(handler);
