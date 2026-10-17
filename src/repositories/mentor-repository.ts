import { randomUUID } from "crypto";
import { pool } from "@/lib/db";

/**
 * Same raw-`pg` stopgap as every other repository — matching
 * prisma/schema.prisma's Phase 9 addition exactly. See
 * PROJECT_STATUS.md for why (still genuinely blocked, re-checked
 * this phase). Swap internals for Prisma Client later; call sites
 * (the mentor service) don't change.
 */

export type MentorRole = "user" | "assistant";

export type MentorMessageRow = {
  id: string;
  userId: string;
  role: MentorRole;
  content: string;
  hintLevel: number | null;
  problemSlug: string | null;
  createdAt: Date;
};

/**
 * The user's whole mentor thread, oldest first — this app has one
 * continuous conversation per user, not a list of named
 * conversations (see schema.prisma's MentorMessage comment).
 * `limit` caps how many of the *most recent* messages come back
 * (still returned oldest-first) — the mentor service uses this to
 * bound how much history goes into the model's context window
 * without needing pagination UI.
 */
export async function getMentorMessagesForUser(userId: string, limit?: number): Promise<MentorMessageRow[]> {
  if (limit === undefined) {
    const result = await pool.query(
      `SELECT * FROM "mentor_messages" WHERE "userId" = $1 ORDER BY "createdAt" ASC`,
      [userId]
    );
    return result.rows;
  }
  const result = await pool.query(
    `SELECT * FROM (
       SELECT * FROM "mentor_messages" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT $2
     ) recent ORDER BY "createdAt" ASC`,
    [userId, limit]
  );
  return result.rows;
}

/**
 * Just the two columns hint-tracking.ts needs, for *every* message
 * the user has ever sent — deliberately not capped by `limit` the
 * way getMentorMessagesForUser is. Hint progress has to survive
 * outside the conversation's context-window cap, or a long-running
 * chat would silently "forget" a problem discussed many messages
 * ago and let the ladder restart from level 1. This is cheap: two
 * small columns, no message content.
 */
export async function getHintSignalsForUser(
  userId: string
): Promise<{ problemSlug: string | null; hintLevel: number | null }[]> {
  const result = await pool.query(
    `SELECT "problemSlug", "hintLevel" FROM "mentor_messages" WHERE "userId" = $1 AND "hintLevel" IS NOT NULL`,
    [userId]
  );
  return result.rows;
}

export async function insertMentorMessage(message: {
  userId: string;
  role: MentorRole;
  content: string;
  hintLevel: number | null;
  problemSlug: string | null;
}): Promise<MentorMessageRow> {
  const id = randomUUID();
  const result = await pool.query(
    `INSERT INTO "mentor_messages" ("id", "userId", "role", "content", "hintLevel", "problemSlug")
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, message.userId, message.role, message.content, message.hintLevel, message.problemSlug]
  );
  return result.rows[0];
}
