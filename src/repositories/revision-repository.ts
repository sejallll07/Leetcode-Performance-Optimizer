import { randomUUID } from "crypto";
import { pool } from "@/lib/db";
import { computeInitialSchedule } from "@/lib/revision/revision-scheduler";
import type { RevisionFeedback, RevisionItemState } from "@/lib/revision/types";

/**
 * Same raw-`pg` stopgap as every other repository — see
 * src/lib/db.ts's comment and PROJECT_STATUS.md. This phase brings
 * the schema to 10 tables, past the point that stopgap was meant to
 * hold until; still the pragmatic call given the sandbox's network
 * constraint is unchanged, but it's a genuinely strong signal now.
 */

/**
 * Creates a revision item for any of the user's solved problems that
 * doesn't already have one — idempotent, safe to call on every sync.
 * Existing revision items (including their progress) are never
 * touched here.
 */
export async function ensureRevisionItemsForSolvedProblems(userId: string): Promise<void> {
  const solved = await pool.query(
    `SELECT s."problemId", MIN(s."submittedAt") AS "firstSolvedAt"
     FROM "submissions" s
     LEFT JOIN "revision_items" r ON r."problemId" = s."problemId" AND r."userId" = s."userId"
     WHERE s."userId" = $1 AND r."id" IS NULL
     GROUP BY s."problemId"`,
    [userId]
  );

  for (const row of solved.rows) {
    const schedule = computeInitialSchedule(row.firstSolvedAt);
    await pool.query(
      `INSERT INTO "revision_items" ("id", "userId", "problemId", "intervalIndex", "dueAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT ("userId", "problemId") DO NOTHING`,
      [randomUUID(), userId, row.problemId, schedule.intervalIndex, schedule.dueAt]
    );
  }
}

export async function getRevisionItemsForUser(userId: string): Promise<RevisionItemState[]> {
  const result = await pool.query(
    `SELECT r."id", r."intervalIndex", r."dueAt", r."lastReviewedAt", r."reviewCount",
            p."slug" AS "problemSlug", p."title" AS "problemTitle", p."difficulty",
            t."slug" AS "topicSlug", t."name" AS "topicName",
            (SELECT rh."feedback" FROM "revision_history" rh
             WHERE rh."revisionItemId" = r."id"
             ORDER BY rh."reviewedAt" DESC LIMIT 1) AS "lastFeedback"
     FROM "revision_items" r
     JOIN "problems" p ON p."id" = r."problemId"
     LEFT JOIN "problem_topics" pt ON pt."problemId" = p."id"
     LEFT JOIN "topics" t ON t."id" = pt."topicId"
     WHERE r."userId" = $1
     ORDER BY r."dueAt" ASC`,
    [userId]
  );

  // A problem can carry multiple topic tags via the join — one
  // revision item per problem, so keep only the first topic seen
  // for display purposes (a "primary" topic, not a full list).
  const seen = new Set<string>();
  const items: RevisionItemState[] = [];
  for (const row of result.rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    items.push({
      id: row.id,
      problemSlug: row.problemSlug,
      problemTitle: row.problemTitle,
      difficulty: row.difficulty,
      topicSlug: row.topicSlug,
      topicName: row.topicName,
      intervalIndex: row.intervalIndex,
      dueAt: row.dueAt,
      lastReviewedAt: row.lastReviewedAt,
      lastFeedback: row.lastFeedback,
      reviewCount: row.reviewCount,
    });
  }
  return items;
}

export async function getRevisionItemOwner(revisionItemId: string): Promise<string | null> {
  const result = await pool.query(`SELECT "userId" FROM "revision_items" WHERE "id" = $1`, [revisionItemId]);
  return result.rows[0]?.userId ?? null;
}

export async function recordRevisionCompletion(
  revisionItemId: string,
  feedback: RevisionFeedback,
  previousInterval: number,
  newInterval: number,
  dueAt: Date,
  reviewedAt: Date
): Promise<void> {
  await pool.query(
    `INSERT INTO "revision_history" ("id", "revisionItemId", "feedback", "previousInterval", "newInterval", "reviewedAt")
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [randomUUID(), revisionItemId, feedback, previousInterval, newInterval, reviewedAt]
  );

  await pool.query(
    `UPDATE "revision_items"
     SET "intervalIndex" = $2, "dueAt" = $3, "lastReviewedAt" = $4,
         "reviewCount" = "reviewCount" + 1, "updatedAt" = now()
     WHERE "id" = $1`,
    [revisionItemId, newInterval, dueAt, reviewedAt]
  );
}