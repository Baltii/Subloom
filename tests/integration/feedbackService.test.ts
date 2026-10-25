import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { sendFeedback } from "../../src/services/feedback";

const mock = vi.hoisted(() => ({
  invoke: vi.fn(),
  mac: false,
  windows: false,
}));
vi.mock("../../src/services/supabase", () => ({
  supabase: { functions: { invoke: mock.invoke } },
}));
vi.mock("expo-constants", () => ({
  default: { expoConfig: { version: "1.8.0" } },
}));
vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("../../src/services/macosBridge", () => ({
  macosBridge: () => (mock.mac ? {} : null),
}));
vi.mock("../../src/services/windowsBridge", () => ({
  windowsBridge: () => (mock.windows ? {} : null),
}));
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const draft = {
  kind: "idea" as const,
  title: "Calendar search",
  message: "Please add search to the calendar view.",
  replyEmail: null,
};
beforeEach(() => {
  mock.invoke.mockReset();
  mock.mac = false;
  mock.windows = false;
});
afterEach(() => {
  vi.useRealTimers();
});
describe("private feedback delivery", () => {
  it("sends only the entered feedback and disclosed app metadata without account data", async () => {
    mock.invoke.mockResolvedValue({
      data: { accepted: true, id },
      error: null,
    });
    await sendFeedback(draft, id);
    const [name, options] = mock.invoke.mock.calls[0]!;
    expect(name).toBe("submit-feedback");
    expect(options.body).toEqual({
      ...draft,
      id,
      platform: "web",
      appVersion: "1.8.0",
    });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    mock.mac = true;
    await sendFeedback(draft, id);
    expect(mock.invoke.mock.calls[1]?.[1].body.platform).toBe("macos");
    mock.mac = false;
    mock.windows = true;
    await sendFeedback(draft, id);
    expect(mock.invoke.mock.calls[2]?.[1].body.platform).toBe("windows");
  });
  it("never reports success for a failed or unconfirmed submission", async () => {
    for (const data of [
      null,
      { accepted: false, id },
      { accepted: true, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
    ]) {
      mock.invoke.mockResolvedValue({ data, error: null });
      await expect(sendFeedback(draft, id)).rejects.toThrow(/confirmed/);
    }
    mock.invoke.mockResolvedValue({ data: null, error: new Error("offline") });
    await expect(sendFeedback(draft, id)).rejects.toThrow(/connection/);
    mock.invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(
        new Response(JSON.stringify({ error: "Please try again later." }), {
          status: 429,
        }),
      ),
    });
    await expect(sendFeedback(draft, id)).rejects.toThrow(
      "Please try again later.",
    );
  });
  it("aborts a stalled request so the form can be retried", async () => {
    vi.useFakeTimers();
    mock.invoke.mockImplementation(
      (_name, { signal }) =>
        new Promise((resolve) => {
          signal.addEventListener("abort", () =>
            resolve({ data: null, error: new Error("aborted") }),
          );
        }),
    );
    const result = expect(sendFeedback(draft, id)).rejects.toThrow(
      /connection/,
    );
    await vi.advanceTimersByTimeAsync(20_000);
    await result;
  });
});
