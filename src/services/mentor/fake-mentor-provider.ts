import type { ProblemSearchFilters, ProblemSearchResult } from "@/lib/mentor/problem-search";
import type { MentorChatTurn } from "@/lib/mentor/types";
import type { MentorProvider, MentorReplyResult } from "@/services/mentor/mentor-provider";

/**
 * A deterministic stand-in for the real Anthropic-backed provider —
 * same reason FakeLeetCodeProvider exists: it lets the full
 * context-building -> system-prompt -> provider -> persistence
 * pipeline be integration-tested against real Postgres without a
 * real API key or network call.
 *
 * "hint-ladder" is the interesting scenario: rather than hardcoding
 * what level to report, it reads the *real* hint-progress table
 * system-prompt.ts baked into `systemPrompt` (built from real stored
 * messages) and reports back exactly what a compliant model should —
 * the next level up, never skipping. That means a multi-turn
 * integration test using this scenario genuinely exercises hint
 * progression end-to-end; only the model's own reasoning is faked.
 */
export type FakeMentorScenario = "echo" | "hint-ladder" | "catalog-search" | "error";

function nextHintLevelFromSystemPrompt(systemPrompt: string, problemSlug: string): number {
  const pattern = new RegExp(`\\(${problemSlug}\\): hint level (\\d+) of 6`);
  const match = systemPrompt.match(pattern);
  if (!match) return 1; // not mentioned in the hint-progress table yet -> no hints given yet
  return Math.min(6, Number(match[1]) + 1);
}

export class FakeMentorProvider implements MentorProvider {
  constructor(private scenario: FakeMentorScenario = "echo") {}

  async sendMessage(input: {
    systemPrompt: string;
    history: MentorChatTurn[];
    searchCatalog: (filters: ProblemSearchFilters) => ProblemSearchResult[];
  }): Promise<MentorReplyResult> {
    switch (this.scenario) {
      case "error":
        return { ok: false, error: "fixture provider error", retryable: true };

      case "catalog-search": {
        const results = input.searchCatalog({ topicSlug: "binary-search" });
        const first = results[0];
        if (!first) return { ok: true, message: "No matching problem found in the catalog.", hintLevel: null, problemSlug: null };
        return {
          ok: true,
          message: `Try "${first.problemTitle}" (${first.difficulty}).`,
          hintLevel: null,
          problemSlug: first.problemSlug,
        };
      }

      case "hint-ladder": {
        const problemSlug = "two-sum";
        const level = nextHintLevelFromSystemPrompt(input.systemPrompt, problemSlug);
        return { ok: true, message: `Hint ${level} fixture text for ${problemSlug}.`, hintLevel: level, problemSlug };
      }

      case "echo":
      default: {
        const lastUser = [...input.history].reverse().find((t) => t.role === "user");
        return { ok: true, message: `Fixture reply to: ${lastUser?.content ?? "(nothing)"}`, hintLevel: null, problemSlug: null };
      }
    }
  }
}
