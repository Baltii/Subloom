import { createClient } from "@supabase/supabase-js";
export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function env(name: string) {
  const value = Deno.env.get(name);
  if (!value)
    throw new HttpError(503, "The requested integration is not configured.");
  return value;
}
export function admin() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
export async function authenticated(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) throw new HttpError(401, "Sign in to continue.");
  const client = admin(),
    { data, error } = await client.auth.getUser(token);
  if (error || !data.user)
    throw new HttpError(401, "Your session has expired. Please sign in again.");
  return { user: data.user, client };
}
export function requireCron(req: Request) {
  const expected = env("CRON_SECRET"),
    actual = req.headers.get("x-cron-secret") || "";
  let mismatch = expected.length ^ actual.length;
  for (let i = 0; i < expected.length; i++)
    mismatch |= expected.charCodeAt(i) ^ (actual.charCodeAt(i) || 0);
  if (mismatch) throw new HttpError(401, "Unauthorized.");
}
export async function limited(
  req: Request,
  maximumBytes: number,
): Promise<string> {
  const claimed = Number(req.headers.get("content-length") || 0);
  if (claimed > maximumBytes) throw new HttpError(413, "Payload too large.");
  const reader = req.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new HttpError(413, "Payload too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(total);
  let position = 0;
  for (const chunk of chunks) {
    joined.set(chunk, position);
    position += chunk.length;
  }
  return new TextDecoder().decode(joined);
}
export async function rateLimit(
  client: ReturnType<typeof admin>,
  key: string,
  maximum: number,
  seconds: number,
  userId?: string,
) {
  const { data, error } = await client.rpc("take_rate_limit", {
    key,
    maximum,
    window_seconds: seconds,
    owner: userId || null,
  });
  if (error) throw new HttpError(503, "Rate limit service unavailable.");
  if (!data) throw new HttpError(429, "Please try again later.");
}
export async function sha256(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
export function endpoint(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST")
      return json({ error: "Method not allowed." }, 405);
    try {
      return await handler(req);
    } catch (error) {
      return json(
        {
          error:
            error instanceof HttpError
              ? error.message
              : "The operation could not be completed.",
        },
        error instanceof HttpError ? error.status : 500,
      );
    }
  };
}
export async function providerJson(
  url: string,
  init: RequestInit,
  limit = 200_000,
): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new HttpError(
      response.status === 429 ? 429 : 502,
      "The provider could not complete the request.",
    );
  return JSON.parse(
    await limited(
      new Request("https://internal.invalid", {
        method: "POST",
        body: response.body,
        duplex: "half",
      } as RequestInit),
      limit,
    ),
  );
}
