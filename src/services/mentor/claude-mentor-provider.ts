import { MENTOR_CONFIG } from "@/lib/mentor/config";
import type { ProblemSearchFilters } from "@/lib/mentor/problem-search";
import type { MentorChatTurn } from "@/lib/mentor/types";
import { sendMentorMessagesRequest } from "@/services/mentor/mentor-messages-client";
import type { MentorProvider, MentorReplyResult } from "@/services/mentor/mentor-provider";

/**
 * Talks to the real Anthropic API. This class is only the Anthropic
 * configuration: the request, the search_problem_catalog tool loop,
 * response parsing and error handling all live in the shared client
 * (mentor-messages-client.ts). The API key is read from
 * `process.env.ANTHROPIC_API_KEY` inside this server-only module and
 * never leaves it: nothing in src/components or src/app ever sees it,
 * and it's never sent to the browser (this class is only imported
 * from mentor-service.ts, which server actions call).
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export class ClaudeMentorProvider implements MentorProvider {
  async sendMessage(input: {
    systemPrompt: string;
    history: MentorChatTurn[];
    searchCatalog: (filters: ProblemSearchFilters) => unknown[];
  }): Promise<MentorReplyResult> {
    return sendMentorMessagesRequest(
      {
        endpoint: ANTHROPIC_API_URL,
        model: MENTOR_CONFIG.model,
        apiKey: process.env.ANTHROPIC_API_KEY,
        authMode: "x-api-key",
      },
      input
    );
  }
}