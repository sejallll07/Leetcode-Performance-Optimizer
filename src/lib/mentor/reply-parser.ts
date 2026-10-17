import { clampHintLevel } from "@/lib/mentor/hint-tracking";

const META_PATTERN = /^\[\[MENTOR_META(?:\s+hintLevel=(\d+))?(?:\s+problem=([a-z0-9-]+))?\s*\]\]\n?/;

export type ParsedMentorReply = {
  /** The reply text the student actually sees — the meta line (if any) already stripped. */
  message: string;
  hintLevel: number | null;
  problemSlug: string | null;
};

/**
 * Strips and decodes the `[[MENTOR_META ...]]` line the system
 * prompt instructs the model to lead a problem-specific reply with
 * (see system-prompt.ts's "Reply format" rule). A model that
 * forgets the line, or emits one that doesn't parse, degrades
 * gracefully to a plain, un-tagged reply — a malformed tag is never
 * a reason to fail the whole turn, only a reason `hintLevel`/
 * `problemSlug` come back null.
 */
export function parseMentorReply(rawText: string): ParsedMentorReply {
  const match = rawText.match(META_PATTERN);
  if (!match) {
    return { message: rawText.trim(), hintLevel: null, problemSlug: null };
  }
  const hintLevel = clampHintLevel(match[1] ? Number(match[1]) : null);
  const problemSlug = match[2] ?? null;
  const message = rawText.slice(match[0].length).trim();
  return { message, hintLevel, problemSlug };
}
