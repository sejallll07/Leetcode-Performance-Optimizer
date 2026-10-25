import { MENTOR_CONFIG } from "@/lib/mentor/config";
import { parseMentorReply } from "@/lib/mentor/reply-parser";
import type { Difficulty } from "@/lib/analytics/types";
import type { ProblemSearchFilters } from "@/lib/mentor/problem-search";
import type { MentorChatTurn } from "@/lib/mentor/types";
import type { MentorReplyResult } from "@/services/mentor/mentor-provider";

/**
 * A reusable, server-only client for the Anthropic-format Messages API.
 * It owns the request/tool-loop mechanics so both the Anthropic provider
 * and an OpenRouter provider can share them. It never reads the
 * environment and never picks a provider: the caller supplies the
 * endpoint, model, key and auth mode. API keys and raw provider error
 * bodies are never returned to the caller.
 */

const ANTHROPIC_VERSION = "2023-06-01";

export type MentorMessagesAuthMode = "x-api-key" | "bearer";

export type MentorMessagesClientConfig = {
  /** The full Messages URL, for example ".../v1/messages". */
  endpoint: string;
  model: string;
  /** Passed straight from the caller's environment; missing or blank returns a "not configured" result. */
  apiKey: string | undefined;
  /** "x-api-key" adds the Anthropic headers; "bearer" sends only an Authorization header. */
  authMode: MentorMessagesAuthMode;
};

export type MentorMessagesRequestInput = {
  systemPrompt: string;
  history: MentorChatTurn[];
  searchCatalog: (filters: ProblemSearchFilters) => unknown[];
};

// ---------- Tool definition and defensive input handling ----------

const SEARCH_CATALOG_TOOL = {
  name: "search_problem_catalog",
  description:
    "Search the curated DSA problem catalog for real problems by topic and/or difficulty. Always use this when the student asks for a specific problem (e.g. 'give me a binary search problem', 'find me an easy DP problem') instead of inventing one. Automatically excludes problems the student has already solved. Returns a handful of real matches.",
  input_schema: {
    type: "object",
    properties: {
      topicSlug: {
        type: "string",
        description: "A skill-graph topic slug, e.g. 'binary-search', 'dynamic-programming', 'array', 'tree'. Omit to search across all topics.",
      },
      difficulty: { type: "string", enum: ["Easy", "Medium", "Hard"] },
    },
  },
};

const VALID_DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];

type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: unknown };
type TextBlock = { type: "text"; text: string };
type ToolResultBlock = { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
type ClientMessage = { role: "user" | "assistant"; content: string | unknown[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isToolUseBlock(block: unknown): block is ToolUseBlock {
  return isRecord(block) && block.type === "tool_use" && typeof block.id === "string" && typeof block.name === "string";
}

function isReadableTextBlock(block: unknown): block is TextBlock {
  return isRecord(block) && block.type === "text" && typeof block.text === "string" && block.text.trim().length > 0;
}

/** Defensive narrowing of untrusted model-generated tool input: never trust it has the shape the schema asked for. */
function normalizeSearchFilters(raw: Record<string, unknown>): ProblemSearchFilters {
  const filters: ProblemSearchFilters = {};
  if (typeof raw.topicSlug === "string" && raw.topicSlug.length > 0) filters.topicSlug = raw.topicSlug;
  if (typeof raw.difficulty === "string" && VALID_DIFFICULTIES.includes(raw.difficulty as Difficulty)) {
    filters.difficulty = raw.difficulty as Difficulty;
  }
  return filters;
}

function runToolCall(block: ToolUseBlock, searchCatalog: MentorMessagesRequestInput["searchCatalog"]): ToolResultBlock {
  if (block.name !== SEARCH_CATALOG_TOOL.name) {
    return {
      type: "tool_result",
      tool_use_id: block.id,
      content: JSON.stringify({ error: "Unknown tool." }),
      is_error: true,
    };
  }
  const filters = normalizeSearchFilters(isRecord(block.input) ? block.input : {});
  let results: unknown[];
  try {
    results = searchCatalog(filters);
  } catch {
    results = [];
  }
  return { type: "tool_result", tool_use_id: block.id, content: JSON.stringify(results) };
}

// ---------- Safe, student-facing results ----------

const TIMEOUT_RESULT: MentorReplyResult = {
  ok: false,
  error: "The mentor took too long to respond \u2014 try again.",
  retryable: true,
};

const NETWORK_RESULT: MentorReplyResult = {
  ok: false,
  error: "Couldn't reach the AI mentor \u2014 check your connection and try again.",
  retryable: true,
};

const UNREADABLE_RESULT: MentorReplyResult = {
  ok: false,
  error: "The AI mentor sent back something unreadable \u2014 try again.",
  retryable: true,
};

const MALFORMED_RESULT: MentorReplyResult = {
  ok: false,
  error: "The AI mentor's response was malformed \u2014 try again.",
  retryable: true,
};

const NO_REPLY_RESULT: MentorReplyResult = {
  ok: false,
  error: "The AI mentor didn't return a readable reply \u2014 try again.",
  retryable: true,
};

/** Only the HTTP status is used. The response body is never read, logged or shown. */
function interpretErrorStatus(status: number): MentorReplyResult {
  if (status === 401 || status === 403) {
    return { ok: false, error: "The AI mentor isn't configured correctly (authentication failed).", retryable: false };
  }
  if (status === 402) {
    return {
      ok: false,
      error: "The AI mentor isn't available right now (its usage or credit limit was reached).",
      retryable: false,
    };
  }
  if (status === 408) {
    return TIMEOUT_RESULT;
  }
  if (status === 429) {
    return { ok: false, error: "The AI mentor is getting a lot of requests right now \u2014 try again in a moment.", retryable: true };
  }
  if (status === 529 || status === 503) {
    return { ok: false, error: "The AI mentor is temporarily overloaded \u2014 try again shortly.", retryable: true };
  }
  if (status >= 500) {
    return { ok: false, error: "The AI mentor is having trouble on its end \u2014 try again shortly.", retryable: true };
  }
  if (status === 404) {
    return { ok: false, error: "The AI mentor isn't available right now.", retryable: false };
  }
  if (status === 400) {
    return { ok: false, error: "The AI mentor couldn't process that request.", retryable: false };
  }
  return { ok: false, error: `The AI mentor returned an unexpected error (${status}).`, retryable: true };
}

// ---------- One HTTP request ----------

type PostOutcome = { kind: "ok"; data: unknown } | { kind: "error"; result: MentorReplyResult };

function buildHeaders(authMode: MentorMessagesAuthMode, apiKey: string): Record<string, string> {
  if (authMode === "bearer") {
    return { "content-type": "application/json", authorization: `Bearer ${apiKey}` };
  }
  return {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
  };
}

function isAbortError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { name?: unknown }).name === "AbortError";
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Nothing to do: the body is intentionally never read.
  }
}

/** One request. The timeout covers connecting and reading the whole body. */
async function postOnce(config: MentorMessagesClientConfig, apiKey: string, payload: unknown): Promise<PostOutcome> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MENTOR_CONFIG.requestTimeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch(config.endpoint, {
        method: "POST",
        headers: buildHeaders(config.authMode, apiKey),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      return { kind: "error", result: isAbortError(err) ? TIMEOUT_RESULT : NETWORK_RESULT };
    }

    if (!response.ok) {
      await discardBody(response);
      return { kind: "error", result: interpretErrorStatus(response.status) };
    }

    try {
      const data: unknown = await response.json();
      return { kind: "ok", data };
    } catch (err) {
      return { kind: "error", result: isAbortError(err) ? TIMEOUT_RESULT : UNREADABLE_RESULT };
    }
  } finally {
    clearTimeout(timeout);
  }
}

// ---------- The tool loop ----------

async function run(config: MentorMessagesClientConfig, input: MentorMessagesRequestInput): Promise<MentorReplyResult> {
  const apiKey = config.apiKey?.trim();
  if (!apiKey) {
    return { ok: false, error: "The AI mentor isn't configured yet \u2014 no API key is set up.", retryable: false };
  }
  if (!config.endpoint || !config.model) {
    return { ok: false, error: "The AI mentor isn't configured correctly (missing endpoint or model).", retryable: false };
  }
  if (input.history.length === 0) {
    return { ok: false, error: "Nothing to send yet.", retryable: false };
  }

  const messages: ClientMessage[] = input.history.map((t) => ({ role: t.role, content: t.content }));

  for (let iteration = 0; iteration < MENTOR_CONFIG.maxToolIterations; iteration++) {
    const outcome = await postOnce(config, apiKey, {
      model: config.model,
      max_tokens: MENTOR_CONFIG.maxOutputTokens,
      system: input.systemPrompt,
      messages,
      tools: [SEARCH_CATALOG_TOOL],
    });
    if (outcome.kind === "error") return outcome.result;

    const data = outcome.data;
    if (!isRecord(data) || !Array.isArray(data.content)) return MALFORMED_RESULT;
    const content: unknown[] = data.content;

    // Tool use is detected from the blocks themselves as well as stop_reason, because
    // a gateway can report a different stop_reason while still returning tool_use blocks.
    const toolUseBlocks = content.filter(isToolUseBlock);
    if (data.stop_reason === "tool_use" || toolUseBlocks.length > 0) {
      if (toolUseBlocks.length === 0) return MALFORMED_RESULT;

      messages.push({ role: "assistant", content });
      messages.push({ role: "user", content: toolUseBlocks.map((block) => runToolCall(block, input.searchCatalog)) });
      continue;
    }

    const textBlock = content.find(isReadableTextBlock);
    if (!textBlock) return NO_REPLY_RESULT;

    const parsed = parseMentorReply(textBlock.text);
    if (parsed.message.length === 0) return NO_REPLY_RESULT;
    return { ok: true, message: parsed.message, hintLevel: parsed.hintLevel, problemSlug: parsed.problemSlug };
  }

  return { ok: false, error: "That needed too many lookups to answer \u2014 try rephrasing.", retryable: true };
}

/**
 * Sends one mentor turn through the Messages API, running the
 * search_problem_catalog tool loop (at most MENTOR_CONFIG.maxToolIterations
 * requests). Always resolves to a MentorReplyResult: failures come back as
 * { ok: false } with a safe message and never as a thrown error.
 */
export async function sendMentorMessagesRequest(
  config: MentorMessagesClientConfig,
  input: MentorMessagesRequestInput
): Promise<MentorReplyResult> {
  try {
    return await run(config, input);
  } catch {
    return { ok: false, error: "The AI mentor ran into an unexpected problem \u2014 try again.", retryable: true };
  }
}