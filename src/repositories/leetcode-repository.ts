import { randomUUID } from "crypto";
import { pool } from "@/lib/db";

/**
 * Same raw-`pg` stopgap as user-repository.ts, matching
 * prisma/schema.prisma's Phase 2 additions exactly — see that file's
 * comment and PROJECT_STATUS.md for why. Swap internals for Prisma
 * Client later; call sites (the ingestion service) don't change.
 */

export type SyncStatus = "NEVER_SYNCED" | "SYNCING" | "SUCCESS" | "ERROR";

export type LeetCodeProfileRow = {
  id: string;
  userId: string;
  leetcodeUsername: string;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  ranking: number | null;
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
  lastSyncErrorCode: string | null;
};

export async function getLeetCodeProfileByUserId(
  userId: string
): Promise<LeetCodeProfileRow | null> {
  const result = await pool.query(
    `SELECT * FROM "leetcode_profiles" WHERE "userId" = $1 LIMIT 1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

/** Creates the profile row on first connect, or updates the username on reconnect. Sets status to SYNCING. */
export async function startSync(userId: string, username: string): Promise<LeetCodeProfileRow> {
  const result = await pool.query(
    `INSERT INTO "leetcode_profiles" ("id", "userId", "leetcodeUsername", "syncStatus", "updatedAt")
     VALUES ($1, $2, $3, 'SYNCING', now())
     ON CONFLICT ("userId") DO UPDATE
       SET "leetcodeUsername" = EXCLUDED."leetcodeUsername",
           "syncStatus" = 'SYNCING',
           "updatedAt" = now()
     RETURNING *`,
    [randomUUID(), userId, username]
  );
  return result.rows[0];
}

export async function markSyncSuccess(
  userId: string,
  stats: {
    totalSolved: number;
    easySolved: number;
    mediumSolved: number;
    hardSolved: number;
    ranking: number | null;
  }
): Promise<void> {
  await pool.query(
    `UPDATE "leetcode_profiles"
     SET "totalSolved" = $2, "easySolved" = $3, "mediumSolved" = $4, "hardSolved" = $5,
         "ranking" = $6, "syncStatus" = 'SUCCESS', "lastSyncedAt" = now(),
         "lastSyncError" = NULL, "lastSyncErrorCode" = NULL, "updatedAt" = now()
     WHERE "userId" = $1`,
    [userId, stats.totalSolved, stats.easySolved, stats.mediumSolved, stats.hardSolved, stats.ranking]
  );
}

export async function markSyncError(
  userId: string,
  errorCode: string,
  errorMessage: string
): Promise<void> {
  await pool.query(
    `UPDATE "leetcode_profiles"
     SET "syncStatus" = 'ERROR', "lastSyncError" = $2, "lastSyncErrorCode" = $3, "updatedAt" = now()
     WHERE "userId" = $1`,
    [userId, errorMessage, errorCode]
  );
}

export async function getTopicBySlug(slug: string): Promise<{ id: string } | null> {
  const result = await pool.query(`SELECT "id" FROM "topics" WHERE "slug" = $1 LIMIT 1`, [slug]);
  return result.rows[0] ?? null;
}

export async function upsertTopic(topic: { name: string; slug: string }): Promise<string> {
  const result = await pool.query(
    `INSERT INTO "topics" ("id", "name", "slug")
     VALUES ($1, $2, $3)
     ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name"
     RETURNING "id"`,
    [randomUUID(), topic.name, topic.slug]
  );
  return result.rows[0].id;
}

export async function getProblemBySlug(slug: string): Promise<{ id: string } | null> {
  const result = await pool.query(`SELECT "id" FROM "problems" WHERE "slug" = $1 LIMIT 1`, [slug]);
  return result.rows[0] ?? null;
}

/**
 * Batched counterpart to getProblemBySlug.
 * Resolves all known problem slugs in one database round trip.
 */
export async function getProblemsBySlugs(
  slugs: string[]
): Promise<Map<string, string>> {
  if (slugs.length === 0) return new Map();

  const result = await pool.query(
    `SELECT "id", "slug" FROM "problems" WHERE "slug" = ANY($1)`,
    [slugs]
  );

  return new Map(
    result.rows.map((r) => [r.slug as string, r.id as string])
  );
}

export async function upsertProblemWithTopics(problem: {
  leetcodeId: string;
  slug: string;
  title: string;
  difficulty: string;
  topicIds: string[];
  /** Only set by curated catalog seeding (Phase 6) — ingestion never passes this. */
  interviewRelevance?: string;
}): Promise<string> {
  const result = await pool.query(
    `INSERT INTO "problems" ("id", "leetcodeId", "slug", "title", "difficulty", "interviewRelevance", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT ("slug") DO UPDATE
       SET "title" = EXCLUDED."title", "difficulty" = EXCLUDED."difficulty",
           "interviewRelevance" = COALESCE(EXCLUDED."interviewRelevance", "problems"."interviewRelevance"),
           "updatedAt" = now()
     RETURNING "id"`,
    [randomUUID(), problem.leetcodeId, problem.slug, problem.title, problem.difficulty, problem.interviewRelevance ?? null]
  );
  const problemId = result.rows[0].id;

  for (const topicId of problem.topicIds) {
    await pool.query(
      `INSERT INTO "problem_topics" ("problemId", "topicId")
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [problemId, topicId]
    );
  }

  return problemId;
}

export async function upsertSubmission(submission: {
  userId: string;
  problemId: string;
  leetcodeSubmissionId: string;
  status: string;
  submittedAt: Date;
}): Promise<void> {
  await pool.query(
    `INSERT INTO "submissions" ("id", "userId", "problemId", "leetcodeSubmissionId", "status", "submittedAt")
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT ("userId", "leetcodeSubmissionId") DO NOTHING`,
    [randomUUID(), submission.userId, submission.problemId, submission.leetcodeSubmissionId, submission.status, submission.submittedAt]
  );
}

export async function countSubmissionsForUser(userId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM "submissions" WHERE "userId" = $1`,
    [userId]
  );
  return result.rows[0].count;
}