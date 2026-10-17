import { randomUUID } from "crypto";
import { pool } from "@/lib/db";
import { loadSkillGraphEdges } from "@/repositories/skill-graph-repository";
import { loadProblemCatalog } from "@/repositories/problem-catalog-repository";
import type { AnalyticsInput, Difficulty, MasteryResult } from "@/lib/analytics/types";

/**
 * The only place that translates real DB rows into the engine's
 * plain `AnalyticsInput` shape, and the only place that persists a
 * `MasteryResult` back into `user_topic_mastery`. The engine itself
 * never imports this file — see src/services/analytics.
 */

export async function loadAnalyticsInput(userId: string, now: Date): Promise<AnalyticsInput | null> {
  const profileResult = await pool.query(
    `SELECT "totalSolved", "easySolved", "mediumSolved", "hardSolved"
     FROM "leetcode_profiles" WHERE "userId" = $1 LIMIT 1`,
    [userId]
  );
  if (profileResult.rows.length === 0) return null;
  const lifetimeStats = profileResult.rows[0];

  const submissionRows = await pool.query(
    `SELECT s."submittedAt", p."slug" AS "problemSlug", p."title" AS "problemTitle", p."difficulty",
            t."slug" AS "topicSlug", t."name" AS "topicName"
     FROM "submissions" s
     JOIN "problems" p ON p."id" = s."problemId"
     LEFT JOIN "problem_topics" pt ON pt."problemId" = p."id"
     LEFT JOIN "topics" t ON t."id" = pt."topicId"
     WHERE s."userId" = $1
     ORDER BY s."submittedAt" ASC`,
    [userId]
  );

  // Rows are one-per-(submission, topic) because of the join — group
  // back into one entry per submission with all of its topic tags.
  type GroupedSubmission = {
    problemSlug: string;
    problemTitle: string;
    submittedAt: Date;
    difficulty: Difficulty;
    topicSlugs: string[];
    topicNames: Record<string, string>;
  };

  const byProblem = new Map<string, GroupedSubmission>();
  for (const row of submissionRows.rows) {
    const key = `${row.problemSlug}:${row.submittedAt.toISOString()}`;
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
        submittedAt: row.submittedAt,
        difficulty: row.difficulty,
        topicSlugs: row.topicSlug ? [row.topicSlug] : [],
        topicNames: row.topicSlug ? { [row.topicSlug]: row.topicName } : {},
      });
    }
  }

  const submissions = [...byProblem.values()];
  const topicRelationships = await loadSkillGraphEdges();
  const problemCatalog = await loadProblemCatalog();

  return {
    userId,
    now,
    lifetimeStats: {
      totalSolved: lifetimeStats.totalSolved,
      easySolved: lifetimeStats.easySolved,
      mediumSolved: lifetimeStats.mediumSolved,
      hardSolved: lifetimeStats.hardSolved,
    },
    submissions,
    topicRelationships,
    problemCatalog,
  };
}

async function getTopicIdBySlug(slug: string): Promise<string | null> {
  const result = await pool.query(`SELECT "id" FROM "topics" WHERE "slug" = $1 LIMIT 1`, [slug]);
  return result.rows[0]?.id ?? null;
}

export async function saveMasteryResults(
  userId: string,
  results: MasteryResult[],
  topicCounts: Map<string, { problemCount: number; easyCount: number; mediumCount: number; hardCount: number; lastPracticedAt: Date | null }>
): Promise<void> {
  for (const result of results) {
    const topicId = await getTopicIdBySlug(result.topicSlug);
    if (!topicId) continue; // shouldn't happen — the topic came from this user's own data

    const counts = topicCounts.get(result.topicSlug);

    await pool.query(
      `INSERT INTO "user_topic_mastery"
         ("id", "userId", "topicId", "masteryScore", "confidence", "classification",
          "problemCount", "easyCount", "mediumCount", "hardCount", "lastPracticedAt",
          "exposureScore", "difficultyScore", "recencyScore", "diversityScore", "explanation",
          "gapVerdict", "gapExplanation")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
      [
        randomUUID(),
        userId,
        topicId,
        result.masteryScore,
        result.confidence,
        result.classification,
        counts?.problemCount ?? 0,
        counts?.easyCount ?? 0,
        counts?.mediumCount ?? 0,
        counts?.hardCount ?? 0,
        counts?.lastPracticedAt ?? null,
        result.subScores.exposure,
        result.subScores.difficulty,
        result.subScores.recency,
        result.subScores.diversity,
        result.explanation,
        result.gapVerdict,
        result.gapExplanation,
      ]
    );
  }
}

export async function getLatestMasterySnapshots(userId: string) {
  const result = await pool.query(
    `SELECT DISTINCT ON (m."topicId") m.*, t."name" AS "topicName", t."slug" AS "topicSlug"
     FROM "user_topic_mastery" m
     JOIN "topics" t ON t."id" = m."topicId"
     WHERE m."userId" = $1
     ORDER BY m."topicId", m."computedAt" DESC`,
    [userId]
  );
  return result.rows;
}

/** Every persisted snapshot for this user, across all computation
 *  generations — the raw material for "am I improving" (see
 *  src/lib/analytics/progress-trend.ts, which does the actual
 *  comparison as a pure function over this data). */
export async function getMasteryHistory(
  userId: string
): Promise<{ topicSlug: string; masteryScore: number; computedAt: Date }[]> {
  const result = await pool.query(
    `SELECT t."slug" AS "topicSlug", m."masteryScore", m."computedAt"
     FROM "user_topic_mastery" m
     JOIN "topics" t ON t."id" = m."topicId"
     WHERE m."userId" = $1
     ORDER BY m."computedAt" ASC`,
    [userId]
  );
  return result.rows;
}
