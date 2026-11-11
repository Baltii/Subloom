function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

Deno.test("assistant sends only validated requests to the pinned Groq model", async () => {
  const userId = "ae08d10a-743d-4548-865b-810e566e7926";
  const model = "openai/gpt-oss-20b";
  const env = {
    SUPABASE_URL: "https://example.supabase.test",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-server-key",
    GROQ_API_KEY: "fixture-groq-key",
  };
  const previousEnv = Object.keys(env).map((key) =>
    [key, Deno.env.get(key)] as const
  );
  const originalFetch = globalThis.fetch;
  const originalServe = Deno.serve;
  let handler: ((request: Request) => Promise<Response>) | undefined;
  let allowed = true;
  let dailyAllowed = true;
  let anonymous = false;
  let status = 200;
  let action: Record<string, unknown> = { kind: "subscription", name: "Spotify" };
  const requests: { headers: Headers; body: string }[] = [];

  try {
    for (const [key, value] of Object.entries(env)) Deno.env.set(key, value);
    Deno.serve = ((fn: typeof handler) => {
      handler = fn;
    }) as typeof Deno.serve;
    globalThis.fetch = (input, init) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      if (url.pathname === "/auth/v1/user") {
        return Promise.resolve(
          Response.json({ id: userId, is_anonymous: anonymous }),
        );
      }
      if (url.pathname === "/rest/v1/rpc/take_rate_limit") {
        const body = JSON.parse(String(init?.body));
        if (body.key === "assistant-chat:daily") {
          assert(
            body.owner === null && body.maximum === 500 &&
              body.window_seconds === 86400,
            "Use the shared daily quota",
          );
          return Promise.resolve(Response.json(dailyAllowed));
        }
        assert(
          body.key === "assistant-chat:" + userId && body.owner === userId &&
            body.maximum === 20,
          "Use the account quota",
        );
        return Promise.resolve(Response.json(allowed));
      }
      if (url.href === "https://api.groq.com/openai/v1/chat/completions") {
        requests.push({
          headers: new Headers(init?.headers),
          body: String(init?.body),
        });
        if (status === 429) {
          return Promise.resolve(Response.json({
            error: {
              type: "rate_limit_exceeded",
              message: "Too many requests",
            },
          }, { status }));
        }
        return Promise.resolve(Response.json({
          id: "chatcmpl-fixture",
          created: 1794319200,
          model,
          choices: [{
            index: 0,
            message: { role: "assistant", content: JSON.stringify({ action }) },
            finish_reason: "stop",
          }],
          usage: { prompt_tokens: 40, completion_tokens: 12, total_tokens: 52 },
        }));
      }
      throw new Error("Unexpected URL " + url);
    };
    await import("../assistant-chat/index.ts");
    assert(handler, "Assistant route registered");
    const route = handler;
    const send = (message = "When does Spotify renew?", signedIn = true, protocol?: 2) =>
      route(
        new Request(
          "https://example.supabase.test/functions/v1/assistant-chat",
          {
            method: "POST",
            headers: signedIn ? { Authorization: "Bearer fixture-user" } : {},
            body: JSON.stringify({ messages: [message], today: "2026-11-10", protocol }),
          },
        ),
      );

    assert(
      (await send("Spotify", false)).status === 401,
      "Require authentication",
    );
    anonymous = true;
    assert(
      (await send()).status === 401,
      "Require a non-anonymous cloud account",
    );
    anonymous = false;
    Deno.env.delete("GROQ_API_KEY");
    assert((await send()).status === 503, "Require server configuration");
    Deno.env.set("GROQ_API_KEY", env.GROQ_API_KEY);
    assert(
      (await send("4111 1111 1111 1111")).status === 400,
      "Block card numbers",
    );
    assert(
      (await send("My email is test@example.com")).status === 400,
      "Block email addresses",
    );
    assert(
      (await send("My API key is gsk_fixture012345678")).status === 400,
      "Block credentials",
    );
    const spoofed = await route(
      new Request("https://example.supabase.test/functions/v1/assistant-chat", {
        method: "POST",
        headers: { Authorization: "Bearer fixture-user" },
        body: JSON.stringify({
          messages: ["Show all plans"],
          today: "2026-11-10",
          userId: "other-account",
        }),
      }),
    );
    assert(spoofed.status === 400, "Reject supplied account identities");
    allowed = false;
    assert((await send()).status === 429, "Enforce the account quota");
    allowed = true;
    dailyAllowed = false;
    assert((await send()).status === 429, "Enforce the shared daily quota");
    dailyAllowed = true;

    assert(requests.length === 0, "Never send blocked requests to the model");

    const response = await send();
    assert(response.status === 200, "Return a validated action");
    assert(
      (await response.json()).action.name === "Spotify",
      "Return the model action",
    );
    const request = requests.at(0);
    assert(request, "Call Groq");
    assert(
      request.headers.get("authorization") ===
        "Bearer " + env.GROQ_API_KEY,
      "Use the server key",
    );
    const payload = JSON.parse(request.body);
    assert(payload.model === model, "Pin the model");
    assert(payload.service_tier === "on_demand", "Use standard inference");
    assert(
      payload.messages.length === 2 &&
        payload.messages[0].role === "system" &&
        payload.messages[1].role === "user" &&
        payload.messages[1].content === "When does Spotify renew?",
      "Send only instructions and typed text",
    );
    assert(
      !request.body.includes(userId),
      "Keep account identity out of the model request",
    );
    assert(
      payload.response_format.type === "json_schema" &&
        payload.response_format.json_schema.strict === true &&
        payload.response_format.json_schema.schema.properties.action,
      "Request strict structured actions",
    );

    action = { kind: "unrecognized", name: "Spotify" };
    assert((await send()).status === 502, "Reject invalid provider actions");
    status = 429;
    assert((await send()).status === 429, "Surface provider rate limits");
    assert(requests.slice().length === 3, "Send one model request per attempt");
    status = 200;
    action = { kind: "analytics", metric: "spending", period: "next_month", from: null, through: null, subscription: null };
    assert((await send("What will I spend next month?")).status === 502,
      "Keep expanded replies out of older clients");
    const expanded = await send("What will I spend next month?", true, 2);
    assert(expanded.status === 200, "Support expanded actions in the updated client");
    assert((await expanded.json()).action.period === "next_month", "Return a calendar-period forecast action");
  } finally {
    globalThis.fetch = originalFetch;
    Deno.serve = originalServe;
    for (const [key, value] of previousEnv) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
});
