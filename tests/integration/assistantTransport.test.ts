import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { interpretAssistantRequest } from "../../src/services/assistant";
const mocks = vi.hoisted(() => ({
  getState: vi.fn(),
  token: vi.fn(),
  client: vi.fn(),
  invoke: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("../../src/services/supabase", () => ({
  accountAccessToken: mocks.token,
  accountClient: mocks.client,
}));
vi.mock("../../src/store/app", () => ({
  useApp: { getState: mocks.getState },
}));
const identity = "11111111-1111-4111-8111-111111111111";
const request = {
  messages: ["How much will I spend next month?"],
  today: "2026-11-11",
  protocol: 2,
} as const;
const payload = () => ({ ...request, messages: [...request.messages] });
const result = {
  action: {
    kind: "analytics",
    metric: "spending",
    period: "next_month",
    from: null,
    through: null,
    subscription: null,
  },
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("__DEV__", true);
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubEnv("EXPO_PUBLIC_ASSISTANT_DEV_URL", "");
  mocks.getState.mockReturnValue({
    identity,
    hydrated: true,
    data: { demo: false },
  });
  mocks.token.mockResolvedValue("fixture-jwt");
  mocks.client.mockResolvedValue({ functions: { invoke: mocks.invoke } });
  mocks.invoke.mockResolvedValue({ data: result, error: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("keeps guests out of cloud transport before reading any credentials", async () => {
  mocks.getState.mockReturnValue({
    identity: "guest",
    hydrated: true,
    data: { demo: false },
  });
  await expect(
    interpretAssistantRequest("guest", payload(), new AbortController().signal),
  ).rejects.toThrow(/signed-in/);
  expect(mocks.client).not.toHaveBeenCalled();
  expect(mocks.token).not.toHaveBeenCalled();
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("refuses to forward a signed-in token to a remote development override", async () => {
  vi.stubEnv("EXPO_PUBLIC_ASSISTANT_DEV_URL", "https://example.invalid/chat");
  await expect(
    interpretAssistantRequest(
      identity,
      payload(),
      new AbortController().signal,
    ),
  ).rejects.toThrow(/loopback/);
  expect(mocks.token).not.toHaveBeenCalled();
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("discards a delayed response when the workspace changes", async () => {
  mocks.invoke.mockImplementation(async () => {
    mocks.getState.mockReturnValue({
      identity: "guest",
      hydrated: true,
      data: { demo: false },
    });
    return { data: result, error: null };
  });
  await expect(
    interpretAssistantRequest(
      identity,
      payload(),
      new AbortController().signal,
    ),
  ).rejects.toThrow(/canceled/);
});
it("retries only the known legacy protocol rejection without including saved records", async () => {
  mocks.invoke.mockResolvedValueOnce({
    data: null,
    error: new FunctionsHttpError(
      Response.json(
        { error: "Check your message and try again." },
        { status: 400 },
      ),
    ),
  });
  await expect(
    interpretAssistantRequest(
      identity,
      payload(),
      new AbortController().signal,
    ),
  ).resolves.toEqual(result.action);
  expect(mocks.invoke).toHaveBeenCalledTimes(2);
  expect(mocks.invoke.mock.calls[0]?.[1].body).toEqual(payload());
  expect(mocks.invoke.mock.calls[1]?.[1].body).toEqual({
    messages: request.messages,
    today: request.today,
  });
});
it("does not retry unrelated validation failures", async () => {
  mocks.invoke.mockResolvedValueOnce({
    data: null,
    error: new FunctionsHttpError(
      Response.json({ error: "Invalid input" }, { status: 400 }),
    ),
  });
  await expect(
    interpretAssistantRequest(
      identity,
      payload(),
      new AbortController().signal,
    ),
  ).rejects.toThrow();
  expect(mocks.invoke).toHaveBeenCalledTimes(1);
});
it("rejects redirecting local requests and cancels replies after an account switch", async () => {
  vi.stubEnv(
    "EXPO_PUBLIC_ASSISTANT_DEV_URL",
    "http://127.0.0.1:54331/assistant-chat",
  );
  mocks.fetch.mockImplementation(async () => {
    mocks.getState.mockReturnValue({
      identity: "guest",
      hydrated: true,
      data: { demo: false },
    });
    return Response.json(result);
  });
  await expect(
    interpretAssistantRequest(
      identity,
      payload(),
      new AbortController().signal,
    ),
  ).rejects.toThrow(/canceled/);
  expect(mocks.fetch.mock.calls[0]?.[1]).toMatchObject({
    redirect: "error",
    headers: { Authorization: "Bearer fixture-jwt" },
  });
});
