import { FunctionsHttpError } from "@supabase/supabase-js";
import {
  assistantResponseSchema,
  type AssistantRequest,
} from "../domain/assistantProtocol";
import { accountAccessToken, accountClient } from "./supabase";
import { useApp } from "../store/app";

function checkWorkspace(identity: string, signal: AbortSignal) {
  const workspace = useApp.getState();
  if (
    signal.aborted ||
    !workspace.hydrated ||
    workspace.identity !== identity ||
    workspace.data.demo
  )
    throw new Error("The assistant request was canceled.");
}

function assistantError(status?: number) {
  if (status === 404) return "AI chat hasn’t been configured for this server.";
  if (status === 401)
    return "Your session expired. Sign in again to use AI chat.";
  if (status === 429)
    return "The assistant has reached its request limit. Try again later.";
  return "Couldn’t reach the assistant. Check your connection and try again.";
}

function parseAction(data: unknown) {
  const parsed = assistantResponseSchema.safeParse(data);
  if (!parsed.success)
    throw new Error("I couldn’t read that reply. Try asking another way.");
  return parsed.data.action;
}

export async function interpretAssistantRequest(
  identity: string,
  request: AssistantRequest,
  signal: AbortSignal,
) {
  checkWorkspace(identity, signal);
  if (identity === "guest")
    throw new Error("Cloud chat requires a signed-in account.");
  const devEndpoint = __DEV__
    ? process.env.EXPO_PUBLIC_ASSISTANT_DEV_URL
    : undefined;
  if (devEndpoint) {
    const url = new URL(devEndpoint);
    if (
      url.protocol !== "http:" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.username ||
      url.password
    )
      throw new Error(
        "Use a local loopback URL for the development assistant.",
      );
    const token = await accountAccessToken(identity);
    checkWorkspace(identity, signal);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      redirect: "error",
      signal,
    });
    if (!response.ok) throw new Error(assistantError(response.status));
    const data: unknown = await response.json();
    checkWorkspace(identity, signal);
    return parseAction(data);
  }

  const client = await accountClient(identity);
  checkWorkspace(identity, signal);
  const invoke = (body: AssistantRequest) =>
    client.functions.invoke("assistant-chat", { body, signal });
  let { data, error } = await invoke(request);
  if (
    request.protocol === 2 &&
    error instanceof FunctionsHttpError &&
    error.context.status === 400
  ) {
    const body = await error.context
      .clone()
      .json()
      .catch(() => null);
    if (body?.error === "Check your message and try again.") {
      checkWorkspace(identity, signal);
      ({ data, error } = await invoke({
        messages: request.messages,
        today: request.today,
      }));
    }
  }
  if (error) {
    throw new Error(
      assistantError(
        error instanceof FunctionsHttpError ? error.context.status : undefined,
      ),
    );
  }
  checkWorkspace(identity, signal);
  return parseAction(data);
}
