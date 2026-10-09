import { z } from "zod";
import {
  authenticated,
  endpoint,
  env,
  HttpError,
  json,
  limited,
  providerJson,
  rateLimit,
} from "../_shared/http.ts";
const imageSchema = z.object({
  image: z
    .string()
    .min(1)
    .max(7_000_000)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
});
const visionSchema = z.object({
  responses: z
    .array(
      z.object({
        fullTextAnnotation: z
          .object({ text: z.string().max(100_000) })
          .optional(),
        error: z.unknown().optional(),
      }),
    )
    .max(1),
});
export const handler = endpoint(async (req) => {
  const { client, user } = await authenticated(req);
  await rateLimit(client, "ocr:" + user.id, 20, 3600, user.id);
  const image = imageSchema.parse(JSON.parse(await limited(req, 7_100_000)));
  const bytes = Uint8Array.from(atob(image.image.slice(0, 64)), (c) =>
    c.charCodeAt(0),
  );
  const valid =
    image.mime === "image/png"
      ? bytes[0] === 137 &&
        bytes[1] === 80 &&
        bytes[2] === 78 &&
        bytes[3] === 71
      : image.mime === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : bytes[0] === 82 &&
          bytes[1] === 73 &&
          bytes[8] === 87 &&
          bytes[9] === 69;
  if (!valid || (image.image.length * 3) / 4 > 5_000_000)
    throw new HttpError(415, "Unsupported image.");
  const result = visionSchema.parse(
    await providerJson(
      "https://vision.googleapis.com/v1/images:annotate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": env("GOOGLE_VISION_API_KEY"),
        },
        body: JSON.stringify({
          requests: [
            {
              image: { content: image.image },
              features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
            },
          ],
        }),
      },
      250_000,
    ),
  );
  const text = result.responses[0]?.fullTextAnnotation?.text;
  if (!text || result.responses[0]?.error)
    throw new HttpError(422, "No readable receipt text was found.");
  return json({ text });
});
Deno.serve(handler);
