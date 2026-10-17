import { MENTOR_CONFIG } from "@/lib/mentor/config";
import { parseMentorReply } from "@/lib/mentor/reply-parser";
import type { Difficulty } from "@/lib/analytics/types";
import type { ProblemSearchFilters } from "@/lib/mentor/problem-search";
import type { MentorChatTurn } from "@/lib/mentor/types";
import type { MentorProvider, MentorReplyResult } from "@/services/mentor/mentor-provider";

/**
 * Talks to the real Anthropic API. The API key is read from
 * `process.env.ANTHROPIC_API_KEY` inside this server-only module and
 * never leaves it — nothing in src/components or src/app ever sees
 * it, and it's never sent to the browser (this class is only
 * imported from mentor-service.ts, which server actions call).
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

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

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

type AnthropicMessage = { role: "user" | "assistant"; content: string | AnthropicContentBlock[] };

const VALID_DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];

/** Defensive narrowing of untrusted model-generated tool input — never trust it has the shape the schema asked for. */
function normalizeSearchFilters(raw: Record<string, unknown>): ProblemSearchFilters {
  const filters: ProblemSearchFilters = {};
  if (typeof raw.topicSlug === "string" && raw.topicSlug.length > 0) filters.topicSlug = raw.topicSlug;
  if (typeof raw.difficulty === "string" && VALID_DIFFICULTIES.includes(raw.difficulty as Difficulty)) {
    filters.difficulty = raw.difficulty as Difficulty;
  }
  return filters;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function interpretErrorResponse(status: number, bodyText: string): MentorReplyResult {
  if (status === 401 || status === 403) {
    return { ok: false, error: "The AI mentor isn't configured correctly (authentication failed).", retryable: false };
  }
  if (status === 429) {
    return { ok: false, error: "The AI mentor is getting a lot of requests right now — try again in a moment.", retryable: true };
  }
  if (status === 529 || status === 503) {
    return { ok: false, error: "The AI mentor is temporarily overloaded — try again shortly.", retryable: true };
  }
  if (status >= 500) {
    return { ok: false, error: "The AI mentor is having trouble on its end — try again shortly.", retryable: true };
  }
  if (status === 400) {
    return { ok: false, error: "The AI mentor couldn't process that request.", retryable: false };
  }
  return {
    ok: false,
    error: `The AI mentor returned an unexpected error (${status}).`,
    retryable: true,
  };
  // bodyText is intentionally not surfaced to the student — logged by the caller if needed, not shown raw.
  void bodyText;
}

export class ClaudeMentorProvider implements MentorProvider {
  async sendMessage(input: {
    systemPrompt: string;
    history: MentorChatTurn[];
    searchCatalog: (filters: ProblemSearchFilters) => unknown[];
  }): Promise<MentorReplyResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "The AI mentor isn't configured yet — no API key is set up.", retryable: false };
    }
    if (input.history.length === 0) {
      return { ok: false, error: "Nothing to send yet.", retryable: false };
    }

    const messages: AnthropicMessage[] = input.history.map((t) => ({ role: t.role, content: t.content }));

    for (let iteration = 0; iteration < MENTOR_CONFIG.maxToolIterations; iteration++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), MENTOR_CONFIG.requestTimeoutMs);

      let response: Response;
      try {
        response = await fetch(ANTHROPIC_API_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
          },
          body: JSON.stringify({
            model: MENTOR_CONFIG.model,
            max_tokens: MENTOR_CONFIG.maxOutputTokens,
            system: input.systemPrompt,
            messages,
            tools: [SEARCH_CATALOG_TOOL],
          }),
          signal: controller.signal,
        });
      } catch (err) {
        const isAbort = err instanceof Error && err.name === "AbortError";
        return {
          ok: false,
          error: isAbort
            ? "The mentor took too long to respond — try again."
            : "Couldn't reach the AI mentor — check your connection and try again.",
          retryable: true,
        };
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        return interpretErrorResponse(response.status, await safeReadText(response));
      }

      let data: { content: AnthropicContentBlock[]; stop_reason: string };
      try {
        data = await response.json();
      } catch {
        return { ok: false, error: "The AI mentor sent back something unreadable — try again.", retryable: true };
      }

      if (data.stop_reason === "tool_use") {
        const toolUseBlocks = data.content.filter(
          (b): b is Extract<AnthropicContentBlock, { type: "tool_use" }> => b.type === "tool_use"
        );
        if (toolUseBlocks.length === 0) {
          return { ok: false, error: "The AI mentor's response was malformed — try again.", retryable: true };
        }

        messages.push({ role: "assistant", content: data.content });

        const toolResults: AnthropicContentBlock[] = toolUseBlocks.map((block) => {
          const filters = normalizeSearchFilters(block.input);
          let results: unknown[];
          try {
            results = input.searchCatalog(filters);
          } catch {
            results = [];
          }
          return { type: "tool_result", tool_use_id: block.id, content: JSON.stringify(results) };
        });
        messages.push({ role: "user", content: toolResults });
        continue;
      }

      const textBlock = data.content.find((b): b is Extract<AnthropicContentBlock, { type: "text" }> => b.type === "text");
      if (!textBlock) {
        return { ok: false, error: "The AI mentor didn't return a readable reply — try again.", retryable: true };
      }

      const parsed = parseMentorReply(textBlock.text);
      return { ok: true, message: parsed.message, hintLevel: parsed.hintLevel, problemSlug: parsed.problemSlug };
    }

    return { ok: false, error: "That needed too many lookups to answer — try rephrasing.", retryable: true };
  }
}
