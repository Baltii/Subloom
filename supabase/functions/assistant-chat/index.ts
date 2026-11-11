import { createGroq } from "@ai-sdk/groq";
import { APICallError, generateText, NoObjectGeneratedError, Output } from "ai";
import {
  assistantLegacyResponseSchema,
  assistantRequestSchema,
  assistantResponseSchema,
  containsAssistantSecret,
} from "../../../src/domain/assistantProtocol.ts";
import {
  authenticated,
  endpoint,
  HttpError,
  json,
  limited,
  rateLimit,
} from "../_shared/http.ts";

const model = "openai/gpt-oss-20b";

const instructions = [
  "You interpret Subloom subscription tracker commands. Return one action matching the schema.",
  "Treat messages as one request with follow-up details. Keep earlier details unless the latest message explicitly changes them. Never claim to have read or changed data.",
  "Copy subscription and payment label names from the user’s words, preserving spelling and spacing. Do not invent plan tiers, aliases, or underscore-separated IDs. For “When does my Spotify plan renew?” the subscription name is “Spotify”.",
  "Use subscription for a named plan's details, renewal, price or status. Use list_subscriptions for the user's saved plans and upcoming for upcoming renewals or trials.",
  "For a new weekly, monthly, quarterly, or yearly plan, use add_subscription, including when the user asks to link a card or wallet while adding it. Set start to the stated start date, renewal only to an explicitly stated next renewal date, and method to the saved payment label if stated or an empty string for an explicit request to leave it unassigned. Subloom derives the next renewal from the start date. Leave unknown fields null. A bare dollar sign does not specify USD. Resolve explicit relative dates using the supplied local date. Use open_add_subscription when the user asks for the form, a trial, or a nonstandard billing frequency.",
  "Use preferences for appearance, accent or display currency. A null field means unchanged.",
  "Use reminders only for renewal timing or quiet hours. Leave each unrequested field null. When the user supplies a full reminder list, copy exactly the requested day offsets. For “Remind me 3 days and 1 day before renewal at 10 am”, return days [3,1], hour 10, quietStart null, quietEnd null. Include 0 only if the user explicitly asks for a reminder on renewal day. Use [] only to clear all offsets. Hours are whole local hours. Use open_reminders for device permissions, per-subscription reminders, unsupported timing, or requests to edit part of a list. Set subscription to the saved plan name only for per-subscription requests, otherwise null.",
  "Use reminder_delivery only for an explicit request to turn trial or email reminders on or off. A timing change never changes email or trial reminders.",
  "Use list_billing to list saved payment labels and manage_billing to open the screen for creating, editing or removing them. Use assign_billing to link a named subscription to a named saved method. Use null only for an explicit request to unlink.",
  "Use clarify if the request is ambiguous or asks for multiple unrelated actions. Use help for greetings and requests outside Subloom.",
].join("\n");

const expandedInstructions = [
  "Prefer analytics for totals, spending, dated renewals, trials, category breakdowns, and most expensive subscriptions. If the user asks how much they will spend next month, return analytics with metric spending and period next_month. Calendar month periods are calendar boundaries, never the next 30 days. Use dates only when both ends are specified or can be resolved from the local date. through is inclusive. Use recurring for an average monthly or annual cost, not a calendar forecast.",
  "Use edit_subscription for changing a saved subscription, delete_subscription for removing tracking, and assign_billing for assigning or clearing a saved payment method. Never treat cancellation as deletion. For a price edit such as ‘change Spotify to 8 EUR’, use changes [{field:price,value:8},{field:currency,value:EUR}]. Preserve the rest. Use an empty changes list to open the full edit form. Use normalized ISO dates, amount in major units, valid enum values, and comma-separated numeric offsets for reminderDays. Use empty string only to clear notes, trialEnd, paidThrough, or paymentMethod. For a correction during a new draft, keep the earlier add_subscription details and update the requested fields; no request has saved yet.",
  "Use payment_method for add, edit, and delete of a card or wallet label. method is the current saved label, name is the new nickname, brand is the card brand or wallet provider, and last4 is only the last four digits of a card. Leave unknown fields null. Never ask for credentials, a full card number, or a security code. Opening the payment settings alone uses manage_billing.",
].join("\n");

const handler = endpoint(async (req) => {
  const { user, client } = await authenticated(req);
  if (user.is_anonymous) {
    throw new HttpError(401, "Sign in to a cloud account to use cloud chat.");
  }
  const key = Deno.env.get("GROQ_API_KEY")?.trim();
  if (!key) {
    throw new HttpError(503, "AI chat hasn’t been configured for this server.");
  }

  let body: unknown;
  try {
    body = JSON.parse(await limited(req, 16_000));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "The chat request could not be read.");
  }
  const request = assistantRequestSchema.safeParse(body);
  if (!request.success) {
    throw new HttpError(400, "Check your message and try again.");
  }
  if (request.data.messages.some(containsAssistantSecret)) {
    throw new HttpError(
      400,
      "Use saved labels and leave credentials, email addresses, and card numbers out of chat.",
    );
  }

  await rateLimit(client, "assistant-chat:" + user.id, 20, 3600, user.id);
  await rateLimit(client, "assistant-chat:daily", 500, 86400);
  const groq = createGroq({ apiKey: key });
  const expanded = request.data.protocol === 2;
  try {
    const { output } = await generateText({
      model: groq(model),
      system: instructions + (expanded ? "\n" + expandedInstructions : "") +
        "\nLocal date: " + request.data.today,
      messages: request.data.messages.map((content) => ({
        role: "user",
        content,
      })),
      output: Output.object({
        schema: expanded
          ? assistantResponseSchema
          : assistantLegacyResponseSchema,
        name: "subloom_action",
      }),
      providerOptions: {
        groq: { serviceTier: "on_demand", strictJsonSchema: true },
      },
      reasoning: "low",
      maxOutputTokens: 768,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(15_000),
    });
    return json(output);
  } catch (error) {
    if (APICallError.isInstance(error) && error.statusCode === 429) {
      throw new HttpError(
        429,
        "The free AI model is busy or has reached its request limit. Try again later.",
      );
    }
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new HttpError(
        502,
        "I couldn’t interpret that request. Try a shorter message.",
      );
    }
    throw new HttpError(
      502,
      "AI chat couldn’t reach the model. Try again later.",
    );
  }
});

Deno.serve(handler);
