import { randomUUID } from "crypto";
import { pool } from "@/lib/db";
import type { MockInterviewNarrative, MockInterviewPerformanceReport, MockInterviewProblemOutcome, MockInterviewProblemPick } from "@/lib/interview/types";

/**
 * Same raw-`pg` stopgap as every other repository. Deliberately
 * thin: the submission-range, revision-history, and overdue-count
 * queries this phase also needs already exist in
 * src/repositories/reports-repository.ts (getSubmissionsInRange,
 * getRevisionHistoryInRange, getCurrentOverdueCount) and are reused
 * directly from src/services/interview/interview-service.ts rather
 * than duplicated here.
 */

export type StoredMockInterviewSession = {
  id: string;
  status: "IN_PROGRESS" | "COMPLETED";
  problems: MockInterviewProblemPick[];
  outcomes: MockInterviewProblemOutcome[] | null;
  report: MockInterviewPerformanceReport | null;
  narrative: MockInterviewNarrative | null;
  startedAt: Date;
  completedAt: Date | null;
};

function toStoredSession(row: Record<string, unknown>): StoredMockInterviewSession {
  return {
    id: row.id as string,
    status: row.status as "IN_PROGRESS" | "COMPLETED",
    problems: row.problems as MockInterviewProblemPick[],
    outcomes: (row.outcomes as MockInterviewProblemOutcome[] | null) ?? null,
    report: (row.report as MockInterviewPerformanceReport | null) ?? null,
    narrative: (row.narrative as MockInterviewNarrative | null) ?? null,
    startedAt: row.startedAt as Date,
    completedAt: (row.completedAt as Date | null) ?? null,
  };
}

/** All problem slugs the student has ever submitted (accepted-only, per the ingestion model) — used to avoid handing back an already-solved problem as a "fresh" mock interview pick. */
export async function getAllSolvedSlugs(userId: string): Promise<Set<string>> {
  const result = await pool.query(
    `SELECT DISTINCT p."slug" FROM "submissions" s JOIN "problems" p ON p."id" = s."problemId" WHERE s."userId" = $1`,
    [userId]
  );
  return new Set(result.rows.map((r) => r.slug as string));
}

/** Distinct calendar days (UTC) with at least one submission in [start, end) — the activity-streak signal for problemSolvingConsistency, deliberately not a raw submission count (see INTERVIEW_CONFIG's comment on why). */
export async function getDistinctActiveDaysInWindow(userId: string, start: Date, end: Date): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(DISTINCT DATE_TRUNC('day', "submittedAt"))::int AS "count"
     FROM "submissions" WHERE "userId" = $1 AND "submittedAt" >= $2 AND "submittedAt" < $3`,
    [userId, start, end]
  );
  return result.rows[0]?.count ?? 0;
}

/** Slugs used across the student's last N mock interview sessions (any status) — avoids repeating the same 3 problems session after session. */
export async function getRecentlyUsedSlugs(userId: string, lastNSessions: number): Promise<Set<string>> {
  const result = await pool.query(
    `SELECT "problems" FROM "mock_interview_sessions" WHERE "userId" = $1 ORDER BY "startedAt" DESC LIMIT $2`,
    [userId, lastNSessions]
  );
  const slugs = new Set<string>();
  for (const row of result.rows) {
    const problems = row.problems as MockInterviewProblemPick[];
    for (const p of problems) slugs.add(p.slug);
  }
  return slugs;
}

export async function createMockInterviewSession(userId: string, problems: MockInterviewProblemPick[], startedAt: Date): Promise<StoredMockInterviewSession> {
  const result = await pool.query(
    `INSERT INTO "mock_interview_sessions"
       ("id", "userId", "status", "problems", "outcomes", "report", "narrative", "startedAt", "completedAt", "createdAt", "updatedAt")
     VALUES ($1, $2, 'IN_PROGRESS', $3::jsonb, NULL, NULL, NULL, $4, NULL, now(), now())
     RETURNING *`,
    [randomUUID(), userId, JSON.stringify(problems), startedAt]
  );
  return toStoredSession(result.rows[0]);
}

export async function getMockInterviewSession(userId: string, sessionId: string): Promise<StoredMockInterviewSession | null> {
  const result = await pool.query(`SELECT * FROM "mock_interview_sessions" WHERE "id" = $1 AND "userId" = $2 LIMIT 1`, [sessionId, userId]);
  return result.rows[0] ? toStoredSession(result.rows[0]) : null;
}

export async function completeMockInterviewSession(
  sessionId: string,
  outcomes: MockInterviewProblemOutcome[],
  report: MockInterviewPerformanceReport,
  narrative: MockInterviewNarrative | null,
  completedAt: Date
): Promise<StoredMockInterviewSession> {
  const result = await pool.query(
    `UPDATE "mock_interview_sessions"
     SET "status" = 'COMPLETED', "outcomes" = $2::jsonb, "report" = $3::jsonb, "narrative" = $4::jsonb, "completedAt" = $5, "updatedAt" = now()
     WHERE "id" = $1
     RETURNING *`,
    [sessionId, JSON.stringify(outcomes), JSON.stringify(report), narrative ? JSON.stringify(narrative) : null, completedAt]
  );
  return toStoredSession(result.rows[0]);
}

export async function listMockInterviewSessions(userId: string, limit = 10): Promise<StoredMockInterviewSession[]> {
  const result = await pool.query(`SELECT * FROM "mock_interview_sessions" WHERE "userId" = $1 ORDER BY "startedAt" DESC LIMIT $2`, [userId, limit]);
  return result.rows.map(toStoredSession);
}
