import { admin, HttpError, json, limited } from "../_shared/http.ts";
import { verifyPreferencesToken } from "../_shared/preferences-token.ts";
export async function handler(req: Request): Promise<Response> {
  try {
    if (!["GET", "POST"].includes(req.method))
      return json({ error: "Method not allowed." }, 405);
    const token = new URL(req.url).searchParams.get("token") || "",
      userId = await verifyPreferencesToken(token);
    if (req.method === "GET")
      return new Response(
        '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Subloom email preferences</title><body style="font-family:system-ui;background:#F8FAF8;padding:32px;color:#182D25"><h1>Your inbox, your choice.</h1><p>Turn off the optional Subloom weekly digest. Your renewal reminder preferences will stay as you set them.</p><form method="post"><button style="background:#087F68;color:white;border:0;border-radius:12px;padding:16px;font-size:16px">Stop weekly digests</button></form></body></html>',
        {
          headers: {
            "Content-Type": "text/html",
            "Content-Security-Policy":
              "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
            "Referrer-Policy": "no-referrer",
            "Cache-Control": "no-store",
          },
        },
      );
    await limited(req, 4096);
    const client = admin(),
      { data, error } = await client
        .from("user_preferences")
        .select("data")
        .eq("user_id", userId)
        .maybeSingle();
    if (error) throw new HttpError(500, "Could not update preferences.");
    if (data) {
      const { error } = await client
        .from("user_preferences")
        .update({
          data: { ...data.data, weeklyDigest: false },
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      if (error) throw new HttpError(500, "Could not update preferences.");
    }
    return json({
      ok: true,
      message:
        "Weekly digests are off. You can turn them on again in Subloom Settings.",
    });
  } catch (error) {
    return json(
      {
        error:
          error instanceof HttpError
            ? error.message
            : "Could not update preferences.",
      },
      error instanceof HttpError ? error.status : 500,
    );
  }
}
Deno.serve(handler);
