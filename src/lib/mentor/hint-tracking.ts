import { MAX_HINT_LEVEL } from "@/lib/mentor/config";
import type { HintProgressEntry } from "@/lib/mentor/types";

/** The minimal projection of a stored message hint-tracking needs — never the full row (see analytics/types.ts's header comment on why pure lib code only ever sees plain shapes, not DB rows). */
export type StoredHintSignal = { problemSlug: string | null; hintLevel: number | null };

/**
 * Clamps a model-reported hint level into the valid 1-6 range, or
 * null if it isn't a valid level at all (0, negative, non-numeric,
 * or simply absent because the reply wasn't a hint). A defensive
 * data-integrity guard against a malformed API response — not a
 * judgment call about what level the student *should* get next;
 * that steering happens in the system prompt, via
 * computeHintProgress below.
 */
export function clampHintLevel(level: number | null | undefined): number | null {
  if (level === null || level === undefined || !Number.isFinite(level)) return null;
  const rounded = Math.round(level);
  if (rounded < 1) return null;
  return Math.min(MAX_HINT_LEVEL, rounded);
}

/**
 * Reduces the message history down to "how far into the ladder has
 * this student gotten, per problem" — one entry per problem that's
 * had at least one hint, at its highest level so far. This is the
 * deterministic fact table the system prompt hands back to the
 * model every turn, so progression is enforced by an explicit
 * number the model is told to respect, not by trusting it to count
 * correctly from raw conversation text.
 */
export function computeHintProgress(messages: StoredHintSignal[]): HintProgressEntry[] {
  const byProblem = new Map<string, number>();
  for (const m of messages) {
    if (m.problemSlug === null || m.hintLevel === null) continue;
    byProblem.set(m.problemSlug, Math.max(byProblem.get(m.problemSlug) ?? 0, m.hintLevel));
  }
  return [...byProblem.entries()].map(([problemSlug, currentLevel]) => ({ problemSlug, currentLevel }));
}
