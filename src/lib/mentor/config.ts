/**
 * Every tunable number/string the AI mentor uses, in one place —
 * same philosophy as src/lib/analytics/config.ts and
 * src/lib/revision/config.ts.
 */

/**
 * The progressive hint ladder from the Phase 9 brief, verbatim.
 * Both the system prompt (system-prompt.ts) and the UI (a "Hint N/6"
 * indicator) read from this single source rather than each hardcoding
 * their own copy of the six names.
 */
export const HINT_LEVELS = [
  {
    level: 1,
    name: "Conceptual hint",
    description: "Names the general concept involved, without yet connecting it to this problem's specifics.",
  },
  {
    level: 2,
    name: "Pattern hint",
    description: 'Names the pattern or technique category (e.g. "this is a sliding-window problem"), still no approach specifics.',
  },
  {
    level: 3,
    name: "Approach hint",
    description: "Describes the high-level approach in plain language — no pseudocode, no exact steps yet.",
  },
  {
    level: 4,
    name: "Detailed reasoning",
    description: "Walks through why the approach works and what state to track, step by step — still no code.",
  },
  {
    level: 5,
    name: "Pseudocode",
    description: "Structured pseudocode or a step-by-step algorithm outline — not runnable code in a specific language.",
  },
  {
    level: 6,
    name: "Solution explanation",
    description: "The full walkthrough: approach, complexity, and an explained solution.",
  },
] as const;

export const MAX_HINT_LEVEL = HINT_LEVELS.length;

export const MENTOR_CONFIG = {
  /** claude-sonnet-5 — a deliberate choice, not the cheapest or the largest: mentoring needs real reasoning (explaining *why* a topic is weak, holding the hint ladder) but runs once per chat turn, not in a batch pipeline. */
  model: "claude-sonnet-5",
  maxOutputTokens: 1200,
  requestTimeoutMs: 30_000,
  /** Hard cap on the search-catalog tool-use loop (see claude-mentor-provider.ts) — never let one turn spiral into unbounded tool calls. */
  maxToolIterations: 3,

  /** How much prior conversation goes back into context on every turn — most recent N messages (both roles), not the whole history forever. */
  historyMessageLimit: 30,

  /** Caps on each context-builder list — kept small deliberately: this is a summary the model reads every turn, not a report. */
  maxStrongTopicsShown: 5,
  maxWeakTopicsShown: 8,
  maxFundamentalGapsShown: 8,
  maxRevisionNeededShown: 5,
  maxRecommendationsShown: 5,
  maxRevisionSampleShown: 3,
  maxHistoryEntriesShown: 8,

  /** Cap on results returned from one search_problem_catalog tool call. */
  maxCatalogSearchResults: 5,
} as const;
