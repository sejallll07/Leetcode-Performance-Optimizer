import { ensureReferenceDataSeededOnce } from "@/lib/reference-data-cache";
import { computeReadiness } from "@/lib/analytics/readiness";
import { detectGaps } from "@/lib/analytics/gap-detection";
import { buildRoadmap } from "@/lib/roadmap/roadmap-builder";
import { computePeriodBounds } from "@/lib/reports/period";
import { buildMonthlyReportInsights, buildWeeklyReportInsights } from "@/lib/reports/report-builder";
import { buildMonthlyNarrationPrompt, buildWeeklyNarrationPrompt } from "@/lib/reports/narrative";
import type { MonthlyReportInsights, PeriodBounds, ReportPeriodType, ReportResult, WeeklyReportInsights } from "@/lib/reports/types";
import { loadSkillGraphEdges } from "@/repositories/skill-graph-repository";
import { findUserById } from "@/repositories/user-repository";
import {
  getCurrentOverdueCount,
  getLifetimeTotalSolved,
  getMasterySnapshotsAsOf,
  getPreviousStoredReport,
  getRevisionHistoryInRange,
  getStoredReport,
  getSubmissionsInRange,
  hasAnyMasterySnapshotBefore,
  saveReport,
} from "@/repositories/reports-repository";
import { ClaudeReportNarrator } from "@/services/reports/claude-report-narrator";
import { FakeReportNarrator } from "@/services/reports/fake-report-narrator";
import type { ReportNarrator } from "@/services/reports/report-narrator";

/**
 * Local-dev-only escape hatch: set REPORT_NARRATOR_MODE=fake in .env
 * to exercise the full report pipeline (prompt building, the
 * narrator call, persistence, UI rendering) without spending real
 * Anthropic credits. Never set this in production — when unset (the
 * default, and the only sane production value), the real
 * ClaudeReportNarrator is always used. This does not touch or
 * replace the real integration; it's an opt-in substitution at the
 * exact seam (`options.narrator`) that was already there for tests.
 */
function defaultNarrator(): ReportNarrator {
  if (process.env.REPORT_NARRATOR_MODE === "fake") {
    return new FakeReportNarrator();
  }
  return new ClaudeReportNarrator();
}

export type GetReportResult = { ok: true; report: ReportResult } | { ok: false; error: string };

/** Rehydrates the one Date-bearing field (`period.start`/`period.end`) that comes back as an ISO string after a JSON round-trip through the `reports` table's jsonb column — everything else in the stored insights is already plain data. */
function rehydratePeriod<T extends { period: PeriodBounds }>(insights: T): T {
  return {
    ...insights,
    period: {
      ...insights.period,
      start: new Date(insights.period.start),
      end: new Date(insights.period.end),
    },
  };
}

/** Best-effort, defensive extraction from a previous stored monthly report's insights blob — never throws on an unexpected shape, just falls back to "no streak history". */
function extractPreviousPersistentWeaknesses(insights: unknown): { topicSlug: string; monthsPersistent: number }[] {
  if (typeof insights !== "object" || insights === null) return [];
  const list = (insights as Record<string, unknown>).persistentWeaknesses;
  if (!Array.isArray(list)) return [];
  return list
    .filter((w): w is { topicSlug: string; monthsPersistent: number } => typeof w?.topicSlug === "string" && typeof w?.monthsPersistent === "number")
    .map((w) => ({ topicSlug: w.topicSlug, monthsPersistent: w.monthsPersistent }));
}

async function buildWeekly(userId: string, period: PeriodBounds, effectiveEnd: Date, studentName: string): Promise<{ insights: WeeklyReportInsights; prompt: string }> {
  const edges = await loadSkillGraphEdges();

  const [masteryBeforeStart, masteryAtEndRaw, submissionsInRange, revisionHistoryInRange, liveOverdueCount] = await Promise.all([
    getMasterySnapshotsAsOf(userId, period.start),
    getMasterySnapshotsAsOf(userId, effectiveEnd),
    getSubmissionsInRange(userId, period.start, effectiveEnd),
    getRevisionHistoryInRange(userId, period.start, effectiveEnd),
    period.isCurrent ? getCurrentOverdueCount(userId, effectiveEnd) : Promise.resolve(null),
  ]);

  const { mastery: masteryAtEnd, forwardLookingGaps: forwardLookingGapsAtEnd } = detectGaps(masteryAtEndRaw, edges);

  const insights = buildWeeklyReportInsights({
    period,
    submissionsInRange,
    revisionHistoryInRange,
    masteryBeforeStart,
    masteryAtEnd,
    forwardLookingGapsAtEnd,
    liveOverdueCount,
  });

  return { insights, prompt: buildWeeklyNarrationPrompt(insights, studentName) };
}

async function buildMonthly(userId: string, period: PeriodBounds, effectiveEnd: Date, studentName: string): Promise<{ insights: MonthlyReportInsights; prompt: string }> {
  const edges = await loadSkillGraphEdges();

  const [masteryAtStartRaw, hasStartHistory, masteryAtEndRaw, totalSolvedEnd, submissionsInRange, revisionHistoryInRange, liveOverdueCount, previousStored] = await Promise.all([
    getMasterySnapshotsAsOf(userId, period.start),
    hasAnyMasterySnapshotBefore(userId, period.start),
    getMasterySnapshotsAsOf(userId, effectiveEnd),
    getLifetimeTotalSolved(userId),
    getSubmissionsInRange(userId, period.start, effectiveEnd),
    getRevisionHistoryInRange(userId, period.start, effectiveEnd),
    period.isCurrent ? getCurrentOverdueCount(userId, effectiveEnd) : Promise.resolve(null),
    getPreviousStoredReport(userId, "MONTHLY", period.start),
  ]);

  const { mastery: masteryAtStart, forwardLookingGaps: forwardLookingGapsAtStart } = detectGaps(masteryAtStartRaw, edges);
  const { mastery: masteryAtEnd, forwardLookingGaps: forwardLookingGapsAtEnd } = detectGaps(masteryAtEndRaw, edges);

  const roadmapAtStart = buildRoadmap({ mastery: masteryAtStart, forwardLookingGaps: forwardLookingGapsAtStart, topicRelationships: edges, now: period.start });
  const roadmapAtEnd = buildRoadmap({ mastery: masteryAtEnd, forwardLookingGaps: forwardLookingGapsAtEnd, topicRelationships: edges, now: effectiveEnd });

  const readinessAtStart = hasStartHistory ? computeReadiness(masteryAtStart) : null;
  const readinessAtEnd = computeReadiness(masteryAtEnd);

  const insights = buildMonthlyReportInsights({
    period,
    totalSolvedEnd: totalSolvedEnd ?? 0,
    submissionsInRange,
    revisionHistoryInRange,
    masteryAtStart,
    masteryAtEnd,
    roadmapAtStart,
    roadmapAtEnd,
    readinessAtStart,
    readinessAtEnd,
    liveOverdueCount,
    previousMonthlyPersistentWeaknesses: previousStored ? extractPreviousPersistentWeaknesses(previousStored.insights) : [],
  });

  return { insights, prompt: buildMonthlyNarrationPrompt(insights, studentName) };
}

/**
 * The one entry point: given a period type and how many periods back
 * from "now" (offset 0 = current, in-progress period), returns a
 * full report — insights always, narrative when the narrator
 * succeeds. Completed (non-current) periods are cached in the
 * `reports` table and served from there on repeat views; the
 * current period is always recomputed live, since it changes as the
 * student keeps working through the week/month — freezing it early
 * would go stale in a way a "report" shouldn't.
 */
export async function getReport(
  userId: string,
  periodType: ReportPeriodType,
  offset: number,
  options: { narrator?: ReportNarrator; now?: Date; forceRegenerate?: boolean } = {}
): Promise<GetReportResult> {
  if (offset < 0) return { ok: false, error: "Invalid period offset." };

  const now = options.now ?? new Date();
  const period = computePeriodBounds(periodType, now, offset);

  if (!period.isCurrent && !options.forceRegenerate) {
    const stored = await getStoredReport(userId, periodType, period.start);
    if (stored) {
      const insights = rehydratePeriod(stored.insights as WeeklyReportInsights | MonthlyReportInsights);
      return {
        ok: true,
        report: { periodType, insights, narrative: stored.narrative, narrativeError: null, generatedAt: stored.generatedAt, fromCache: true },
      };
    }
  }

  await ensureReferenceDataSeededOnce();;
  const user = await findUserById(userId);
  const studentName = user?.name ?? "there";
  const effectiveEnd = period.isCurrent ? now : period.end;

  const { insights, prompt } = periodType === "WEEKLY" ? await buildWeekly(userId, period, effectiveEnd, studentName) : await buildMonthly(userId, period, effectiveEnd, studentName);

  const narrator = options.narrator ?? defaultNarrator();
  const narrationResult = await narrator.narrate(prompt);
  const narrative = narrationResult.ok ? narrationResult.narrative : null;
  const narrativeError = narrationResult.ok ? null : narrationResult.error;
  const generatedAt = now;

  if (!period.isCurrent) {
    await saveReport({ userId, period: periodType, periodStart: period.start, periodEnd: period.end, insights, narrative, generatedAt });
  }

  return { ok: true, report: { periodType, insights, narrative, narrativeError, generatedAt, fromCache: false } };
}
