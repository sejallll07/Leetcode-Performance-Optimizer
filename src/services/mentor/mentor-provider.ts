/**
 * The boundary between "the rest of the app" and "however we
 * actually talk to an AI model". mentor-service.ts depends only on
 * this interface — never on the Anthropic API directly. That's what
 * makes it possible to swap the real Claude implementation for a
 * fake one in tests, same reason LeetCodeProvider exists.
 */

import type { MentorChatTurn } from "@/lib/mentor/types";
import type { ProblemSearchFilters, ProblemSearchResult } from "@/lib/mentor/problem-search";

export type MentorReplyResult =
  | { ok: true; message: string; hintLevel: number | null; problemSlug: string | null }
  | { ok: false; error: string; retryable: boolean };

export interface MentorProvider {
  /**
   * Sends one mentor turn: a system prompt (context + rules already
   * baked in by system-prompt.ts) and the full conversation history,
   * ending with the student's newest message. `searchCatalog` is a
   * synchronous callback into the already-loaded-in-memory problem
   * catalog (see problem-search.ts) — implementations call it
   * whenever the model asks to look up a real problem; callers of
   * `sendMessage` never see the intermediate tool-use turns, only
   * the final reply.
   */
  sendMessage(input: {
    systemPrompt: string;
    history: MentorChatTurn[];
    searchCatalog: (filters: ProblemSearchFilters) => ProblemSearchResult[];
  }): Promise<MentorReplyResult>;
}
