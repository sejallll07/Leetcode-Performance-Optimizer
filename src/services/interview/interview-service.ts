import { ensureReferenceDataSeededOnce } from "@/lib/reference-data-cache";
import { runAnalyticsEngine } from "@/lib/analytics/engine";
import { loadAnalyticsInput } from "@/repositories/analytics-repository";

import { getCurrentOverdueCount, getRevisionHistoryInRange, getSubmissionsInRange } from "@/repositories/reports-repository";
import {
  completeMockInterviewSession,
  createMockInterviewSession,
  getAllSolvedSlugs,
  getDistinctActiveDaysInWindow,
  getMockInterviewSession,
  getRecentlyUsedSlugs,
  listMockInterviewSessions,
  type StoredMockInterviewSession,
} from "@/repositories/interview-repository";
import { findUserById } from "@/repositories/user-repository";
import { computeInterviewReadiness } from "@/lib/interview/readiness";
import { selectMockInterviewProblems } from "@/lib/interview/problem-selection";
import { buildPerformanceReport } from "@/lib/interview/performance";
import { buildMockInterviewNarrationPrompt } from "@/lib/interview/narrative";
import { INTERVIEW_CONFIG } from "@/lib/interview/config";
import type { InterviewProfileInput, InterviewReadinessResult, MockInterviewProblemOutcome, MockInterviewSessionResult } from "@/lib/interview/types";
// Reused as-is from Phase 10 — the narrator interface is domain-agnostic
// (prompt in, {summary, highlights, advice} out), so a second, near-identical
// provider pair isn't worth the duplication. See INTERVIEW_CONFIG's comment.
import { ClaudeReportNarrator } from "@/services/reports/claude-report-narrator";
import { FakeReportNarrator } from "@/services/reports/fake-report-narrator";
import type { ReportNarrator } from "@/services/reports/report-narrator";

/** Both are small, idempotent, curated-data upserts — same helper analytics-service.ts uses, duplicated locally rather than imported so this service doesn't reach into another domain's service layer for a two-line helper. */
async function ensureReferenceDataSeeded(): Promise<void> {
  await ensureReferenceDataSeededOnce();
}

/** Same REPORT_NARRATOR_MODE=fake dev-only opt-in as reports-service.ts — see that file's comment for the full rationale. Real ClaudeReportNarrator stays the default in every case where it's unset. */
function defaultNarrator(): ReportNarrator {
  if (process.env.REPORT_NARRATOR_MODE === "fake") {
    return new FakeReportNarrator();
  }
  return new ClaudeReportNarrator();
}

/**
 * Everything both the readiness score and mock-interview problem
 * selection need, assembled once. Mirrors
 * analytics-service.ts's ensureReferenceDataSeeded -> loadAnalyticsInput
 * -> runAnalyticsEngine pipeline exactly, then layers on the
 * interview-specific queries (recent window, revision consistency,
 * catalog exclusions) on top — one loadAnalyticsInput call, not a
 * separate one per feature.
 */
async function buildProfileInput(userId: string, now: Date): Promise<InterviewProfileInput | null> {
  await ensureReferenceDataSeeded();

  const analyticsInput = await loadAnalyticsInput(userId, now);
  if (!analyticsInput) return null; // no LeetCode profile connected yet

  const engineResult = runAnalyticsEngine(analyticsInput);
  const windowStart = new Date(now.getTime() - INTERVIEW_CONFIG.recentWindowDays * 24 * 60 * 60 * 1000);

  const [recentSubmissions, distinctActiveDays, revisionHistory, overdueCount, solvedSlugs, recentlyUsedSlugs] = await Promise.all([
    getSubmissionsInRange(userId, windowStart, now),
    getDistinctActiveDaysInWindow(userId, windowStart, now),
    getRevisionHistoryInRange(userId, windowStart, now),
    getCurrentOverdueCount(userId, now),
    getAllSolvedSlugs(userId),
    getRecentlyUsedSlugs(userId, INTERVIEW_CONFIG.avoidRepeatFromLastNSessions),
  ]);

  return {
    mastery: engineResult.mastery,
    topics: engineResult.topics,
    forwardLookingGaps: engineResult.forwardLookingGaps,
    catalog: analyticsInput.problemCatalog, // loadAnalyticsInput already loads + the catalog is seeded above; no second fetch needed
    solvedSlugs,
    recentlyUsedSlugs,
    recentSubmissionCount: recentSubmissions.length,
    recentMediumHardSubmissionCount: recentSubmissions.filter((s) => s.difficulty !== "Easy").length,
    distinctActiveDays,
    revisionReviewsCompletedRecently: revisionHistory.length,
    currentlyOverdueRevisionCount: overdueCount,
  };
}

export type GetReadinessResult = { ok: true; readiness: InterviewReadinessResult } | { ok: false; error: string };

export async function getInterviewReadiness(userId: string, now: Date = new Date()): Promise<GetReadinessResult> {
  const profile = await buildProfileInput(userId, now);
  if (!profile) return { ok: false, error: "Connect your LeetCode profile and sync first." };
  return { ok: true, readiness: computeInterviewReadiness(profile) };
}

function toSessionResult(stored: StoredMockInterviewSession): MockInterviewSessionResult {
  return {
    sessionId: stored.id,
    status: stored.status,
    problems: stored.problems,
    startedAt: stored.startedAt,
    completedAt: stored.completedAt,
    report: stored.report,
    narrative: stored.narrative,
    narrativeError: null, // only meaningful at generation time (see submitMockInterviewOutcomes) — a reloaded session doesn't re-attempt narration, so there's nothing to report an error about
  };
}

export type StartMockInterviewResult = { ok: true; session: MockInterviewSessionResult } | { ok: false; error: string };

export async function startMockInterview(userId: string, now: Date = new Date()): Promise<StartMockInterviewResult> {
  const profile = await buildProfileInput(userId, now);
  if (!profile) return { ok: false, error: "Connect your LeetCode profile and sync first." };

  const problems = selectMockInterviewProblems(profile);
  const stored = await createMockInterviewSession(userId, problems, now);
  return { ok: true, session: toSessionResult(stored) };
}

export type SubmitMockInterviewResult = { ok: true; session: MockInterviewSessionResult } | { ok: false; error: string };

/**
 * Self-reported outcomes in, a full performance report + narrative
 * out. Idempotent: resubmitting against an already-completed session
 * just returns what's stored rather than re-narrating (avoids
 * spending a second Anthropic call on a double-click or a retry).
 */
export async function submitMockInterviewOutcomes(
  userId: string,
  sessionId: string,
  outcomes: MockInterviewProblemOutcome[],
  options: { narrator?: ReportNarrator; now?: Date } = {}
): Promise<SubmitMockInterviewResult> {
  const stored = await getMockInterviewSession(userId, sessionId);
  if (!stored) return { ok: false, error: "That mock interview session wasn't found." };
  if (stored.status === "COMPLETED") {
    return { ok: true, session: toSessionResult(stored) };
  }

  const now = options.now ?? new Date();
  const report = buildPerformanceReport(stored.problems, outcomes);

  const user = await findUserById(userId);
  const prompt = buildMockInterviewNarrationPrompt(report, user?.name ?? "there");
  const narrator = options.narrator ?? defaultNarrator();
  const narrationResult = await narrator.narrate(prompt);
  const narrative = narrationResult.ok ? narrationResult.narrative : null;
  const narrativeError = narrationResult.ok ? null : narrationResult.error;

  const updated = await completeMockInterviewSession(sessionId, outcomes, report, narrative, now);

  return { ok: true, session: { ...toSessionResult(updated), narrativeError } };
}

export async function getMockInterview(userId: string, sessionId: string): Promise<MockInterviewSessionResult | null> {
  const stored = await getMockInterviewSession(userId, sessionId);
  return stored ? toSessionResult(stored) : null;
}

export async function listRecentMockInterviews(userId: string, limit = 10): Promise<MockInterviewSessionResult[]> {
  const sessions = await listMockInterviewSessions(userId, limit);
  return sessions.map(toSessionResult);
}
