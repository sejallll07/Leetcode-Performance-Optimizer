import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { MENTOR_CONFIG } from "@/lib/mentor/config";
import type { ProblemSearchFilters } from "@/lib/mentor/problem-search";
import type { MentorChatTurn } from "@/lib/mentor/types";
import {
  sendMentorMessagesRequest,
  type MentorMessagesClientConfig,
  type MentorMessagesRequestInput,
} from "@/services/mentor/mentor-messages-client";

const DASH = "\u2014";
const API_KEY = "test-key-123";
const ENDPOINT = "https://example.test/v1/messages";
const MODEL = "test-model";
const LEAKY_BODY = "RAW-PROVIDER-BODY-SHOULD-NEVER-REACH-STUDENTS";

const MSG = {
  noKey: `The AI mentor isn't configured yet ${DASH} no API key is set up.`,
  badConfig: "The AI mentor isn't configured correctly (missing endpoint or model).",
  noHistory: "Nothing to send yet.",
  timeout: `The mentor took too long to respond ${DASH} try again.`,
  network: `Couldn't reach the AI mentor ${DASH} check your connection and try again.`,
  unreadable: `The AI mentor sent back something unreadable ${DASH} try again.`,
  malformed: `The AI mentor's response was malformed ${DASH} try again.`,
  noReply: `The AI mentor didn't return a readable reply ${DASH} try again.`,
  tooManyLookups: `That needed too many lookups to answer ${DASH} try rephrasing.`,
  unexpected: `The AI mentor ran into an unexpected problem ${DASH} try again.`,
};

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

type SentBody = {
  model: string;
  max_tokens: number;
  system: string;
  messages: unknown[];
  tools: {
    name: string;
    input_schema: {
      type: string;
      properties: { topicSlug: { type: string }; difficulty: { type: string; enum: string[] } };
    };
  }[];
};

let fetchMock: Mock<FetchFn>;

beforeEach(() => {
  fetchMock = vi.fn<FetchFn>();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------- Helpers ----------

function makeConfig(overrides: Partial<MentorMessagesClientConfig> = {}): MentorMessagesClientConfig {
  return { endpoint: ENDPOINT, model: MODEL, apiKey: API_KEY, authMode: "x-api-key", ...overrides };
}

const HISTORY: MentorChatTurn[] = [{ role: "user", content: "Give me a binary search problem" }];

function makeInput(overrides: Partial<MentorMessagesRequestInput> = {}): MentorMessagesRequestInput {
  return {
    systemPrompt: "You are a DSA mentor.",
    history: HISTORY,
    searchCatalog: () => [],
    ...overrides,
  };
}

function makeSearchSpy(results: unknown[] = []) {
  return vi.fn<(filters: ProblemSearchFilters) => unknown[]>(() => results);
}

/** A minimal stand-in for Response: only the members the client uses. */
function fakeResponse(status: number, body: unknown) {
  const json = vi.fn(async () => body);
  const cancel = vi.fn(async () => undefined);
  const response = { ok: status >= 200 && status < 300, status, json, body: { cancel } } as unknown as Response;
  return { response, json, cancel };
}

function textReply(text: string): Response {
  return fakeResponse(200, { stop_reason: "end_turn", content: [{ type: "text", text }] }).response;
}

function toolUseReply(blocks: unknown[], stopReason = "tool_use"): Response {
  return fakeResponse(200, { stop_reason: stopReason, content: blocks }).response;
}

function catalogToolUse(id: string, input: unknown = {}) {
  return { type: "tool_use", id, name: "search_problem_catalog", input };
}

function sentRequest(index = 0) {
  const [url, init] = fetchMock.mock.calls[index];
  return {
    url,
    init,
    headers: init.headers as Record<string, string>,
    body: JSON.parse(String(init.body)) as SentBody,
  };
}

function hangUntilAborted(signal: AbortSignal | null | undefined): Promise<never> {
  return new Promise((_resolve, reject) => {
    signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
  });
}

// ---------- Configuration and validation ----------

describe("configuration and validation", () => {
  it.each([undefined, "", "   "])("returns a non-retryable 'not configured' result for API key %j without calling fetch", async (apiKey) => {
    const result = await sendMentorMessagesRequest(makeConfig({ apiKey }), makeInput());

    expect(result).toEqual({ ok: false, error: MSG.noKey, retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a non-retryable result when the endpoint is missing", async () => {
    const result = await sendMentorMessagesRequest(makeConfig({ endpoint: "" }), makeInput());

    expect(result).toEqual({ ok: false, error: MSG.badConfig, retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a non-retryable result when the model is missing", async () => {
    const result = await sendMentorMessagesRequest(makeConfig({ model: "" }), makeInput());

    expect(result).toEqual({ ok: false, error: MSG.badConfig, retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a non-retryable result for an empty history", async () => {
    const result = await sendMentorMessagesRequest(makeConfig(), makeInput({ history: [] }));

    expect(result).toEqual({ ok: false, error: MSG.noHistory, retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ---------- Authentication ----------

describe("authentication headers", () => {
  it("sends x-api-key and anthropic-version in x-api-key mode, with no Authorization header", async () => {
    fetchMock.mockResolvedValueOnce(textReply("Hello"));

    await sendMentorMessagesRequest(makeConfig({ authMode: "x-api-key" }), makeInput());

    const { headers } = sentRequest();
    expect(headers["x-api-key"]).toBe(API_KEY);
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers["content-type"]).toBe("application/json");
    expect(headers.authorization).toBeUndefined();
  });

  it("sends only a Bearer Authorization header in bearer mode, with no Anthropic headers", async () => {
    fetchMock.mockResolvedValueOnce(textReply("Hello"));

    await sendMentorMessagesRequest(makeConfig({ authMode: "bearer" }), makeInput());

    const { headers } = sentRequest();
    expect(headers.authorization).toBe(`Bearer ${API_KEY}`);
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["x-api-key"]).toBeUndefined();
    expect(headers["anthropic-version"]).toBeUndefined();
  });

  it("trims whitespace around the API key before sending it", async () => {
    fetchMock.mockResolvedValueOnce(textReply("Hello"));

    await sendMentorMessagesRequest(makeConfig({ apiKey: `  ${API_KEY}  `, authMode: "bearer" }), makeInput());

    expect(sentRequest().headers.authorization).toBe(`Bearer ${API_KEY}`);
  });
});

// ---------- Request construction ----------

describe("request construction", () => {
  it("posts to the configured endpoint with the model, token limit, system prompt and history", async () => {
    fetchMock.mockResolvedValueOnce(textReply("Hello"));
    const history: MentorChatTurn[] = [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello! What are you working on?" },
      { role: "user", content: "Two Sum" },
    ];

    await sendMentorMessagesRequest(makeConfig(), makeInput({ systemPrompt: "SYSTEM PROMPT", history }));

    const { url, init, body } = sentRequest();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe("POST");
    expect(init.signal).toBeDefined();
    expect(body.model).toBe(MODEL);
    expect(body.max_tokens).toBe(MENTOR_CONFIG.maxOutputTokens);
    expect(body.system).toBe("SYSTEM PROMPT");
    expect(body.messages).toEqual([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello! What are you working on?" },
      { role: "user", content: "Two Sum" },
    ]);
  });

  it("includes the search_problem_catalog tool schema", async () => {
    fetchMock.mockResolvedValueOnce(textReply("Hello"));

    await sendMentorMessagesRequest(makeConfig(), makeInput());

    const { tools } = sentRequest().body;
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("search_problem_catalog");
    expect(tools[0].input_schema.type).toBe("object");
    expect(Object.keys(tools[0].input_schema.properties)).toEqual(["topicSlug", "difficulty"]);
    expect(tools[0].input_schema.properties.difficulty.enum).toEqual(["Easy", "Medium", "Hard"]);
  });
});

// ---------- Successful replies ----------

describe("successful replies", () => {
  it("returns the reply text with null hint metadata when there is no metadata line", async () => {
    fetchMock.mockResolvedValueOnce(textReply("  Let's think about it together.  "));

    const result = await sendMentorMessagesRequest(makeConfig(), makeInput());

    expect(result).toEqual({
      ok: true,
      message: "Let's think about it together.",
      hintLevel: null,
      problemSlug: null,
    });
  });

  it("parses the MENTOR_META line into hintLevel and problemSlug and strips it from the message", async () => {
    fetchMock.mockResolvedValueOnce(textReply("[[MENTOR_META hintLevel=3 problem=two-sum]]\nTry a hash map."));

    const result = await sendMentorMessagesRequest(makeConfig(), makeInput());

    expect(result).toEqual({ ok: true, message: "Try a hash map.", hintLevel: 3, problemSlug: "two-sum" });
  });

  it("skips non-text blocks and uses the first text block", async () => {
    fetchMock.mockResolvedValueOnce(
      toolUseReply([{ type: "thinking", thinking: "hmm" }, { type: "text", text: "Here you go." }], "end_turn")
    );

    const result = await sendMentorMessagesRequest(makeConfig(), makeInput());

    expect(result).toEqual({ ok: true, message: "Here you go.", hintLevel: null, problemSlug: null });
  });

  it("skips a blank text block and uses the next readable one", async () => {
    fetchMock.mockResolvedValueOnce(
      toolUseReply([{ type: "text", text: "   " }, { type: "text", text: "Real answer." }], "end_turn")
    );

    const result = await sendMentorMessagesRequest(makeConfig(), makeInput());

    expect(result).toEqual({ ok: true, message: "Real answer.", hintLevel: null, problemSlug: null });
  });
});

// ---------- Tool loop ----------

describe("search_problem_catalog tool loop", () => {
  it("sends the assistant tool-use block and a user tool-result block on the next request", async () => {
    const results = [{ problemSlug: "binary-search", problemTitle: "Binary Search" }];
    const firstContent = [
      { type: "text", text: "Let me look that up." },
      catalogToolUse("toolu_1", { topicSlug: "binary-search", difficulty: "Easy" }),
    ];
    fetchMock.mockResolvedValueOnce(toolUseReply(firstContent)).mockResolvedValueOnce(textReply("Try Binary Search."));

    const result = await sendMentorMessagesRequest(makeConfig(), makeInput({ searchCatalog: makeSearchSpy(results) }));

    expect(result).toEqual({ ok: true, message: "Try Binary Search.", hintLevel: null, problemSlug: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentRequest(1).body.messages).toEqual([
      { role: "user", content: "Give me a binary search problem" },
      { role: "assistant", content: firstContent },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "toolu_1", content: JSON.stringify(results) }],
      },
    ]);
  });

  it("passes valid topic and difficulty filters to searchCatalog", async () => {
    const searchCatalog = makeSearchSpy();
    fetchMock
      .mockResolvedValueOnce(toolUseReply([catalogToolUse("t1", { topicSlug: "binary-search", difficulty: "Easy" })]))
      .mockResolvedValueOnce(textReply("Done."));

    await sendMentorMessagesRequest(makeConfig(), makeInput({ searchCatalog }));

    expect(searchCatalog).toHaveBeenCalledTimes(1);
    expect(searchCatalog).toHaveBeenCalledWith({ topicSlug: "binary-search", difficulty: "Easy" });
  });

  it.each<[string, unknown, ProblemSearchFilters]>([
    ["wrong types and an unknown difficulty", { topicSlug: 123, difficulty: "Extreme" }, {}],
    ["an empty topic and a non-string difficulty", { topicSlug: "", difficulty: ["Easy"] }, {}],
    ["a valid topic with an unknown difficulty", { topicSlug: "array", difficulty: "Extreme" }, { topicSlug: "array" }],
    ["null input", null, {}],
    ["string input", "binary-search", {}],
    ["array input", ["array"], {}],
  ])("normalizes malformed tool input without throwing: %s", async (_label, toolInput, expectedFilters) => {
    const searchCatalog = makeSearchSpy();
    fetchMock
      .mockResolvedValueOnce(toolUseReply([catalogToolUse("t1", toolInput)]))
      .mockResolvedValueOnce(textReply("Done."));

    const result = await sendMentorMessagesRequest(makeConfig(), makeInput({ searchCatalog }));

    expect(result.ok).toBe(true);
    expect(searchCatalog).toHaveBeenCalledWith(expectedFilters);
  });

  it("sends an empty result list when searchCatalog throws", async () => {
    const searchCatalog = vi.fn<(filters: ProblemSearchFilters) => unknown[]>(() => {
      throw new Error("catalog exploded");
    });
    fetchMock.mockResolvedValueOnce(toolUseReply([catalogToolUse("t1")])).mockResolvedValueOnce(textReply("Done."));

    const result = await sendMentorMessagesRequest(makeConfig(), makeInput({ searchCatalog }));

    expect(result.ok).toBe(true);
    expect(sentRequest(1).body.messages[2]).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "t1", content: "[]" }],
    });
  });

  it("returns an error tool result for an unknown tool name and does not search the catalog", async () => {
    const searchCatalog = makeSearchSpy();
    fetchMock
      .mockResolvedValueOnce(toolUseReply([{ type: "tool_use", id: "toolu_x", name: "delete_everything", input: {} }]))
      .mockResolvedValueOnce(textReply("Done."));

    const result = await sendMentorMessagesRequest(makeConfig(), makeInput({ searchCatalog }));

    expect(result.ok).toBe(true);
    expect(searchCatalog).not.toHaveBeenCalled();
    expect(sentRequest(1).body.messages[2]).toEqual({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "toolu_x",
          content: JSON.stringify({ error: "Unknown tool." }),
          is_error: true,
        },
      ],
    });
  });

  it("answers several tool-use blocks in one response with matching results in order", async () => {
    const searchCatalog = makeSearchSpy([{ problemSlug: "two-sum" }]);
    fetchMock
      .mockResolvedValueOnce(
        toolUseReply([catalogToolUse("a", { difficulty: "Easy" }), catalogToolUse("b", { topicSlug: "array" })])
      )
      .mockResolvedValueOnce(textReply("Done."));

    await sendMentorMessagesRequest(makeConfig(), makeInput({ searchCatalog }));

    expect(searchCatalog).toHaveBeenCalledTimes(2);
    expect(sentRequest(1).body.messages[2]).toEqual({
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "a", content: JSON.stringify([{ problemSlug: "two-sum" }]) },
        { type: "tool_result", tool_use_id: "b", content: JSON.stringify([{ problemSlug: "two-sum" }]) },
      ],
    });
  });

  it("treats tool-use blocks as a tool call even when stop_reason says something else", async () => {
    const searchCatalog = makeSearchSpy();
    fetchMock
      .mockResolvedValueOnce(toolUseReply([catalogToolUse("t1")], "end_turn"))
      .mockResolvedValueOnce(textReply("Done."));

    const result = await sendMentorMessagesRequest(makeConfig(), makeInput({ searchCatalog }));

    expect(result).toEqual({ ok: true, message: "Done.", hintLevel: null, problemSlug: null });
    expect(searchCatalog).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops after MENTOR_CONFIG.maxToolIterations requests and never sends an extra one", async () => {
    fetchMock.mockImplementation(async () => toolUseReply([catalogToolUse("loop")]));

    const result = await sendMentorMessagesRequest(makeConfig(), makeInput());

    expect(result).toEqual({ ok: false, error: MSG.tooManyLookups, retryable: true });
    expect(fetchMock).toHaveBeenCalledTimes(MENTOR_CONFIG.maxToolIterations);
  });

  it("returns a malformed result when stop_reason is tool_use but there are no tool-use blocks", async () => {
    fetchMock.mockResolvedValueOnce(toolUseReply([{ type: "text", text: "Looking..." }]));

    const result = await sendMentorMessagesRequest(makeConfig(), makeInput());

    expect(result).toEqual({ ok: false, error: MSG.malformed, retryable: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a malformed result when a tool-use block has no string id", async () => {
    fetchMock.mockResolvedValueOnce(
      toolUseReply([{ type: "tool_use", name: "search_problem_catalog", input: {} }])
    );

    const result = await sendMentorMessagesRequest(makeConfig(), makeInput());

    expect(result).toEqual({ ok: false, error: MSG.malformed, retryable: true });
  });
});

// ---------- HTTP errors ----------

describe("HTTP error responses", () => {
  it.each<[number, string, boolean]>([
    [401, "The AI mentor isn't configured correctly (authentication failed).", false],
    [403, "The AI mentor isn't configured correctly (authentication failed).", false],
    [400, "The AI mentor couldn't process that request.", false],
    [402, "The AI mentor isn't available right now (its usage or credit limit was reached).", false],
    [404, "The AI mentor isn't available right now.", false],
    [408, MSG.timeout, true],
    [429, `The AI mentor is getting a lot of requests right now ${DASH} try again in a moment.`, true],
    [503, `The AI mentor is temporarily overloaded ${DASH} try again shortly.`, true],
    [529, `The AI mentor is temporarily overloaded ${DASH} try again shortly.`, true],
    [500, `The AI mentor is having trouble on its end ${DASH} try again shortly.`, true],
    [502, `The AI mentor is having trouble on its end ${DASH} try again shortly.`, true],
    [504, `The AI mentor is having trouble on its end ${DASH} try again shortly.`, true],
    [418, "The AI mentor returned an unexpected error (418).", true],
  ])("maps HTTP %i to the intended result and never exposes the response body", async (status, error, retryable) => {
    const { response, json, cancel } = fakeResponse(status, { error: { message: LEAKY_BODY } });
    fetchMock.mockResolvedValueOnce(response);

    const result = await sendMentorMessagesRequest(makeConfig(), makeInput());

    expect(result).toEqual({ ok: false, error, retryable });
    expect(JSON.stringify(result)).not.toContain(LEAKY_BODY);
    expect(JSON.stringify(result)).not.toContain(API_KEY);
    expect(json).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ---------- Transport and parsing failures ----------

describe("transport and parsing failures", () => {
  it("returns a retryable network result when fetch rejects, without leaking the error text or key", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError(`fetch failed for key ${API_KEY}`));

    const result = await sendMentorMessagesRequest(makeConfig(), makeInput());

    expect(result).toEqual({ ok: false, error: MSG.network, retryable: true });
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });

  it("returns a retryable timeout result when fetch rejects with an AbortError", async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("aborted"), { name: "AbortError" }));

    const result = await sendMentorMessagesRequest(makeConfig(), makeInput());

    expect(result).toEqual({ ok: false, error: MSG.timeout, retryable: true });
  });

  it("aborts a request that outlives the configured timeout", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce((_url, init) => hangUntilAborted(init.signal));

    const pending = sendMentorMessagesRequest(makeConfig(), makeInput());
    await vi.advanceTimersByTimeAsync(MENTOR_CONFIG.requestTimeoutMs);

    await expect(pending).resolves.toEqual({ ok: false, error: MSG.timeout, retryable: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("also applies the timeout while the response body is still being read", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(async (_url, init) => {
      return {
        ok: true,
        status: 200,
        body: { cancel: vi.fn() },
        json: () => hangUntilAborted(init.signal),
      } as unknown as Response;
    });

    const pending = sendMentorMessagesRequest(makeConfig(), makeInput());
    await vi.advanceTimersByTimeAsync(MENTOR_CONFIG.requestTimeoutMs);

    await expect(pending).resolves.toEqual({ ok: false, error: MSG.timeout, retryable: true });
  });

  it("clears its timeout timer after a successful request", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(textReply("Hello"));

    await sendMentorMessagesRequest(makeConfig(), makeInput());

    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns a retryable unreadable result when the response is not valid JSON", async () => {
    const response = {
      ok: true,
      status: 200,
      body: { cancel: vi.fn() },
      json: vi.fn(async () => {
        throw new SyntaxError("Unexpected token < in JSON");
      }),
    } as unknown as Response;
    fetchMock.mockResolvedValueOnce(response);

    const result = await sendMentorMessagesRequest(makeConfig(), makeInput());

    expect(result).toEqual({ ok: false, error: MSG.unreadable, retryable: true });
  });

  it.each<[string, unknown]>([
    ["null", null],
    ["a string", "just text"],
    ["a number", 42],
    ["an object without content", {}],
    ["content that is not an array", { content: "nope" }],
  ])("returns a malformed result when the response body is %s", async (_label, body) => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, body).response);

    const result = await sendMentorMessagesRequest(makeConfig(), makeInput());

    expect(result).toEqual({ ok: false, error: MSG.malformed, retryable: true });
  });

  it.each<[string, unknown[]]>([
    ["empty content", []],
    ["only non-text blocks", [{ type: "thinking", thinking: "hmm" }]],
    ["a blank text block", [{ type: "text", text: "   " }]],
    ["a reply that is only a metadata line", [{ type: "text", text: "[[MENTOR_META hintLevel=2 problem=two-sum]]" }]],
  ])("returns a no-reply result for %s", async (_label, content) => {
    fetchMock.mockResolvedValueOnce(toolUseReply(content, "end_turn"));

    const result = await sendMentorMessagesRequest(makeConfig(), makeInput());

    expect(result).toEqual({ ok: false, error: MSG.noReply, retryable: true });
  });

  it("resolves to a safe result instead of rejecting on an unexpected exception", async () => {
    const brokenInput = { ...makeInput(), history: undefined as unknown as MentorChatTurn[] };

    await expect(sendMentorMessagesRequest(makeConfig(), brokenInput)).resolves.toEqual({
      ok: false,
      error: MSG.unexpected,
      retryable: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});