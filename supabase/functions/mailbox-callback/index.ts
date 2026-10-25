import { z } from "zod";
import { admin, sha256 } from "../_shared/http.ts";
import {
  callbackUrl,
  returnUrl,
  tokenRequest,
} from "../_shared/mailbox-providers.ts";
import { seal, unseal } from "../_shared/mailbox-crypto.ts";
import { mailboxCallbackUnavailable } from "../_shared/tool-availability.ts";
export async function handler(req: Request) {
  if (req.method !== "GET")
    return new Response("Method not allowed", { status: 405 });
  const unavailable = mailboxCallbackUnavailable();
  if (unavailable) return unavailable;
  const client = admin();
  let claimed:
    | {
        id: string;
        userId: string;
        provider: "gmail" | "outlook";
        generation: number;
        verifier: string;
        returnKind: "web" | "native";
      }
    | undefined;
  try {
    const url = new URL(req.url),
      state = z.string().min(40).max(128).parse(url.searchParams.get("state"));
    const { data, error } = await client.rpc("claim_mailbox_oauth", {
      hash: await sha256(state),
    });
    if (error) throw new Error("Expired state");
    claimed = z
      .object({
        id: z.string().uuid(),
        userId: z.string().uuid(),
        provider: z.enum(["gmail", "outlook"]),
        generation: z.number().int(),
        verifier: z.string(),
        returnKind: z.enum(["web", "native"]),
      })
      .parse(data);
    if (url.searchParams.has("error")) throw new Error("Consent declined");
    const code = z
      .string()
      .min(1)
      .max(4096)
      .parse(url.searchParams.get("code"));
    const verifier = await unseal(
      claimed.verifier,
      "verifier:" + claimed.userId + ":" + claimed.provider,
    );
    const tokens = await tokenRequest(claimed.provider, {
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl(),
      code_verifier: verifier,
    });
    if (!tokens.refresh_token) throw new Error("Offline consent required");
    const { error: saveError } = await client.rpc("finish_mailbox_connection", {
      connection: claimed.id,
      expected_generation: claimed.generation,
      tokens: await seal(
        JSON.stringify(tokens),
        "tokens:" + claimed.userId + ":" + claimed.provider,
      ),
    });
    if (saveError) throw new Error("Connection changed");
    return new Response(null, {
      status: 302,
      headers: {
        Location: returnUrl(claimed.returnKind),
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    if (claimed)
      await client
        .from("mailbox_connections")
        .update({ status: "disconnected" })
        .eq("id", claimed.id)
        .eq("generation", claimed.generation)
        .eq("status", "pending");
    return new Response(
      "Mailbox connection could not complete. Close this window and reconnect from Subloom.",
      {
        status: 400,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  }
}
Deno.serve(handler);
