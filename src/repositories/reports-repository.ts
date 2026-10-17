import { randomUUID } from "crypto";
import { pool } from "@/lib/db";
import type { Difficulty, RawMasteryResult } from "@/lib/analytics/types";
import type { ReportNarrative, ReportPeriodType } from "@/lib/reports/types";
import type { RevisionHistoryEntry } from "@/lib/reports/report-builder";
import type { SubmissionInput } from "@/lib/analytics/types";

/**
 * Same raw-`pg` stopgap as every other repository (see db.ts's
 * comment). This is the only file that translates real DB rows into
 * the plain types src/lib/reports/*.ts expects, and the only place
 * that reads/writes the `reports` table.
 *
 * The key trick this whole phase rests on: `user_topic_mastery` is
 * already an append-only time series (one row per computation
 * generation, never overwritten), and every field
 * gap-detection.ts's `detectGaps()` needs (masteryScore, confidence,
 * classification, the four subScores, explanation) is already
 * stored on it. So "what did mastery look like as of some past
 * date" doesn't need a new snapshot table — it's just "the latest
 * row per topic with computedAt <= that date", reconstructed into
 * RawMasteryResult[] and run back through the *same* detectGaps()
 * the live engine uses. See getMasterySnapshotsAsOf below.
 */

export async function getMasterySnapshotsAsOf(userId: string, asOf: Date): Promise<RawMasteryResult[]> {
  const result = await pool.query(
    `SELECT DISTINCT ON (m."topicId") m.*, t."name" AS "topicName", t."slug" AS "topicSlug"
     FROM "user_topic_mastery" m
     JOIN "topics" t ON t."id" = m."topicId"
     WHERE m."userId" = $1 AND m."computedAt" <= $2
     ORDER BY m."topicId", m."computedAt" DESC`,
    [userId, asOf]
  );
  return result.rows.map((row): RawMasteryResult => ({
    topicSlug: row.topicSlug,
    topicName: row.topicName,
    masteryScore: row.masteryScore,
    confidence: row.confidence,
    classification: row.classification,
    subScores: {
      exposure: row.exposureScore,
      difficulty: row.difficultyScore,
      recency: row.recencyScore,
      diversity: row.diversityScore,
    },
    explanation: row.explanation,
  }));
}

/** True if the user has *any* mastery snapshot at or before `asOf` — distinguishes "genuinely no history yet" from "history exists but happens to be empty of evidenced topics", used to decide whether a readiness-at-start figure is meaningful at all. */
export async function hasAnyMasterySnapshotBefore(userId: string, asOf: Date): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM "user_topic_mastery" WHERE "userId" = $1 AND "computedAt" <= $2 LIMIT 1`,
    [userId, asOf]
  );
  return result.rows.length > 0;
}

export async function getSubmissionsInRange(userId: string, start: Date, end: Date): Promise<SubmissionInput[]> {
  const rows = await pool.query(
    `SELECT s."submittedAt", p."slug" AS "problemSlug", p."title" AS "problemTitle", p."difficulty",
            t."slug" AS "topicSlug", t."name" AS "topicName"
     FROM "submissions" s
     JOIN "problems" p ON p."id" = s."problemId"
     LEFT JOIN "problem_topics" pt ON pt."problemId" = p."id"
     LEFT JOIN "topics" t ON t."id" = pt."topicId"
     WHERE s."userId" = $1 AND s."submittedAt" >= $2 AND s."submittedAt" < $3
     ORDER BY s."submittedAt" ASC`,
    [userId, start, end]
  );

  // Same one-row-per-(submission, topic) grouping as loadAnalyticsInput in analytics-repository.ts.
  const byProblem = new Map<string, SubmissionInput>();
  for (const row of rows.rows) {
    const key = `${row.problemSlug}:${new Date(row.submittedAt).toISOString()}`;
    const existing = byProblem.get(key);
    if (existing) {
      if (row.topicSlug) {
        existing.topicSlugs.push(row.topicSlug);
        existing.topicNames[row.topicSlug] = row.topicName;
      }
    } else {
      byProblem.set(key, {
        problemSlug: row.problemSlug,
        problemTitle: row.problemTitle,
        difficulty: row.difficulty as Difficulty,
        submittedAt: row.submittedAt,
        topicSlugs: row.topicSlug ? [row.topicSlug] : [],
        topicNames: row.topicSlug ? { [row.topicSlug]: row.topicName } : {},
      });
    }
  }
  return [...byProblem.values()];
}

export async function getRevisionHistoryInRange(userId: string, start: Date, end: Date): Promise<RevisionHistoryEntry[]> {
  const result = await pool.query(
    `SELECT rh."feedback", rh."reviewedAt", p."slug" AS "problemSlug", p."title" AS "problemTitle",
            t."slug" AS "topicSlug", t."name" AS "topicName"
     FROM "revision_history" rh
     JOIN "revision_items" ri ON ri."id" = rh."revisionItemId"
     JOIN "problems" p ON p."id" = ri."problemId"
     LEFT JOIN "problem_topics" pt ON pt."problemId" = p."id"
     LEFT JOIN "topics" t ON t."id" = pt."topicId"
     WHERE ri."userId" = $1 AND rh."reviewedAt" >= $2 AND rh."reviewedAt" < $3
     ORDER BY rh."reviewedAt" ASC`,
    [userId, start, end]
  );
  // A problem can carry multiple topic tags via the join — one revision-history
  // entry per (revision, topic) row would double-count reviewsCompleted, so keep
  // only the first topic tag per underlying review.
  const seen = new Set<string>();
  const entries: RevisionHistoryEntry[] = [];
  for (const row of result.rows) {
    const key = `${row.problemSlug}:${new Date(row.reviewedAt).toISOString()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      topicSlug: row.topicSlug,
      topicName: row.topicName,
      problemSlug: row.problemSlug,
      problemTitle: row.problemTitle,
      feedback: row.feedback,
      reviewedAt: row.reviewedAt,
    });
  }
  return entries;
}

/** Live count — only meaningful for the current, in-progress period (see types.ts's file-level note on why past periods can't reconstruct this). */
export async function getCurrentOverdueCount(userId: string, asOf: Date): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS "count" FROM "revision_items" WHERE "userId" = $1 AND "dueAt" <= $2`,
    [userId, asOf]
  );
  return result.rows[0]?.count ?? 0;
}

export async function getLifetimeTotalSolved(userId: string): Promise<number | null> {
  const result = await pool.query(`SELECT "totalSolved" FROM "leetcode_profiles" WHERE "userId" = $1 LIMIT 1`, [userId]);
  return result.rows[0]?.totalSolved ?? null;
}

// ---------- Report persistence ----------

export type StoredReport = {
  id: string;
  periodType: ReportPeriodType;
  periodStart: Date;
  periodEnd: Date;
  insights: unknown;
  narrative: ReportNarrative | null;
  generatedAt: Date;
};

function toStoredReport(row: Record<string, unknown>): StoredReport {
  return {
    id: row.id as string,
    periodType: row.period as ReportPeriodType,
    periodStart: row.periodStart as Date,
    periodEnd: row.periodEnd as Date,
    insights: row.insights,
    narrative: (row.narrative as ReportNarrative | null) ?? null,
    generatedAt: row.generatedAt as Date,
  };
}

export async function getStoredReport(userId: string, period: ReportPeriodType, periodStart: Date): Promise<StoredReport | null> {
  const result = await pool.query(
    `SELECT * FROM "reports" WHERE "userId" = $1 AND "period" = $2 AND "periodStart" = $3 LIMIT 1`,
    [userId, period, periodStart]
  );
  return result.rows[0] ? toStoredReport(result.rows[0]) : null;
}

/** The immediately preceding stored report of the same period type — used for the monthly persistent-weakness streak count. Never the current in-progress period, since that one isn't "preceding" anything yet. */
export async function getPreviousStoredReport(userId: string, period: ReportPeriodType, beforePeriodStart: Date): Promise<StoredReport | null> {
  const result = await pool.query(
    `SELECT * FROM "reports" WHERE "userId" = $1 AND "period" = $2 AND "periodStart" < $3
     ORDER BY "periodStart" DESC LIMIT 1`,
    [userId, period, beforePeriodStart]
  );
  return result.rows[0] ? toStoredReport(result.rows[0]) : null;
}

/**
 * Upsert on (userId, period, periodStart) — regenerating an
 * already-stored period overwrites it rather than duplicating. Sets
 * "updatedAt" explicitly (both branches) — see the real-environment
 * shakedown note in PROJECT_STATUS.md: Prisma's @updatedAt has no
 * DB-side default, so every raw INSERT/UPDATE here must set it, not
 * just rely on the column existing.
 */
export async function saveReport(input: {
  userId: string;
  period: ReportPeriodType;
  periodStart: Date;
  periodEnd: Date;
  insights: unknown;
  narrative: ReportNarrative | null;
  generatedAt: Date;
}): Promise<StoredReport> {
  const result = await pool.query(
    `INSERT INTO "reports"
       ("id", "userId", "period", "periodStart", "periodEnd", "insights", "narrative", "generatedAt", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, now(), now())
     ON CONFLICT ("userId", "period", "periodStart") DO UPDATE
       SET "periodEnd" = EXCLUDED."periodEnd",
           "insights" = EXCLUDED."insights",
           "narrative" = EXCLUDED."narrative",
           "generatedAt" = EXCLUDED."generatedAt",
           "updatedAt" = now()
     RETURNING *`,
    [
      randomUUID(),
      input.userId,
      input.period,
      input.periodStart,
      input.periodEnd,
      JSON.stringify(input.insights),
      input.narrative ? JSON.stringify(input.narrative) : null,
      input.generatedAt,
    ]
  );
  return toStoredReport(result.rows[0]);
}

/** Every stored report of a given period type, newest first — for a "past reports" list view. Insights/narrative omitted from the row shape here (list views don't need the full payload); callers wanting full detail should use getStoredReport for a specific period. */
export async function listStoredReportPeriods(
  userId: string,
  period: ReportPeriodType,
  limit = 24
): Promise<{ periodStart: Date; periodEnd: Date; generatedAt: Date }[]> {
  const result = await pool.query(
    `SELECT "periodStart", "periodEnd", "generatedAt" FROM "reports"
     WHERE "userId" = $1 AND "period" = $2
     ORDER BY "periodStart" DESC LIMIT $3`,
    [userId, period, limit]
  );
  return result.rows;
}
