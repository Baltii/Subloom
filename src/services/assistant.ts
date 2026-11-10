import { FunctionsHttpError } from "@supabase/supabase-js";
import {
  assistantResponseSchema,
  type AssistantRequest,
} from "../domain/assistantProtocol";
import { accountClient } from "./supabase";
import { useApp } from "../store/app";

export async function interpretAssistantRequest(
  identity: string,
  request: AssistantRequest,
  signal: AbortSignal,
) {
  const client = await accountClient(identity);
  const workspace = useApp.getState();
  if (
    signal.aborted ||
    !workspace.hydrated ||
    workspace.identity !== identity ||
    workspace.data.demo
  )
    throw new Error("The assistant request was canceled.");
  const { data, error } = await client.functions.invoke("assistant-chat", {
    body: request,
    signal,
  });
  if (error) {
    let message =
      "Couldn’t reach the assistant. Check your connection and try again.";
    if (error instanceof FunctionsHttpError) {
      const response = error.context as Response;
      if (response.status === 404)
        message = "AI chat hasn’t been configured for this server.";
      else if (response.status === 401)
        message = "Your session expired. Sign in again to use AI chat.";
      else if (response.status === 429)
        message =
          "The assistant has reached its request limit. Try again later.";
    }
    throw new Error(message);
  }
  const parsed = assistantResponseSchema.safeParse(data);
  if (!parsed.success)
    throw new Error("I couldn’t read that reply. Try asking another way.");
  return parsed.data.action;
}
