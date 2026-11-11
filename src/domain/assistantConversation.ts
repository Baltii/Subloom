import {
  containsAssistantSecret,
  type AssistantAction,
  type AssistantMessage,
} from "./assistantProtocol";

// Keep a short, in-memory conversation. Never include saved record rows, IDs,
// payment profiles, or executable confirmation callbacks in provider context.
export function assistantConversation(
  previous: AssistantMessage[],
  message: AssistantMessage,
): AssistantMessage[] {
  if (containsAssistantSecret(message.content)) return previous;
  const messages = [...previous, message].slice(-12);
  while (
    messages.reduce((size, item) => size + item.content.length, 0) > 10_000
  )
    messages.shift();
  // A bounded transcript should start at a user turn.
  while (messages[0]?.role === "assistant") messages.shift();
  return messages;
}

export function assistantActionContext(
  action: AssistantAction,
  reply: { text: string; awaitingDetails?: boolean },
  confirmation: boolean,
): AssistantMessage {
  const content =
    action.kind === "reply"
      ? action.text
      : JSON.stringify({
          action,
          state: confirmation
            ? "awaiting_confirmation"
            : reply.awaitingDetails
              ? "awaiting_details"
              : "answered",
          // Only clarification text is needed; record values stay on device.
          question: reply.awaitingDetails ? reply.text : undefined,
        });
  return { role: "assistant", content: content.slice(0, 1600) };
}
