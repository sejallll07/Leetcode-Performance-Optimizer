import type { ProblemSearchFilters } from "@/lib/mentor/problem-search";
import type { MentorChatTurn } from "@/lib/mentor/types";
import { sendMentorMessagesRequest } from "@/services/mentor/mentor-messages-client";
import type { MentorProvider, MentorReplyResult } from "@/services/mentor/mentor-provider";

/**
 * Talks to OpenRouter through its Anthropic-format Messages endpoint.
 * Like ClaudeMentorProvider, this class is only a configuration: the
 * request, the search_problem_catalog tool loop, response parsing and
 * error handling all live in the shared client (mentor-messages-client.ts).
 * The API key is read from `process.env.OPENROUTER_API_KEY` inside this
 * server-only module and never leaves it. This provider is selected by
 * `mentor-service.ts` when `MENTOR_AI_PROVIDER` is set to `"openrouter"`.
 */

const OPENROUTER_MESSAGES_URL = "https://openrouter.ai/api/v1/messages";
const OPENROUTER_MODEL = "openrouter/free";

export class OpenRouterMentorProvider implements MentorProvider {
  async sendMessage(input: {
    systemPrompt: string;
    history: MentorChatTurn[];
    searchCatalog: (filters: ProblemSearchFilters) => unknown[];
  }): Promise<MentorReplyResult> {
    return sendMentorMessagesRequest(
      {
        endpoint: OPENROUTER_MESSAGES_URL,
        model: OPENROUTER_MODEL,
        apiKey: process.env.OPENROUTER_API_KEY,
        authMode: "bearer",
      },
      input
    );
  }
}