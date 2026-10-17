
import { ensureReferenceDataSeededOnce } from "@/lib/reference-data-cache";
import { runAnalyticsEngine } from "@/lib/analytics/engine";
import { computeProgressTrend } from "@/lib/analytics/progress-trend";
import type { AnalyticsEngineResult, ProgressTrend, SubmissionInput } from "@/lib/analytics/types";
import { buildRoadmap } from "@/lib/roadmap/roadmap-builder";
import type { RoadmapResult } from "@/lib/roadmap/types";
import {
  getMasteryHistory,
  loadAnalyticsInput,
  saveMasteryResults,
} from "@/repositories/analytics-repository";


/** Both are small, idempotent, curated-data upserts — cheap enough to call before every read or write. */
async function ensureReferenceDataSeeded(): Promise<void> {
  await ensureReferenceDataSeededOnce();
}

/**
 * DB in, DB out — the only IO-touching layer around the pure engine.
 * Called after a successful LeetCode sync (src/actions/leetcode.ts)
 * so mastery snapshots stay current, but nothing here builds or
 * assumes a UI; that's explicitly the next phase.
 */
export async function recomputeAnalyticsForUser(
  userId: string,
  now: Date = new Date()
): Promise<AnalyticsEngineResult | null> {
  await ensureReferenceDataSeeded();

  const input = await loadAnalyticsInput(userId, now);
  if (!input) return null; // no LeetCode profile connected yet — nothing to analyze

  const result = runAnalyticsEngine(input);

  const topicCounts = new Map(
    result.topics.map((topic) => [
      topic.topicSlug,
      {
        problemCount: topic.problemCount,
        easyCount: topic.difficultyDistribution.find((d) => d.difficulty === "Easy")?.count ?? 0,
        mediumCount: topic.difficultyDistribution.find((d) => d.difficulty === "Medium")?.count ?? 0,
        hardCount: topic.difficultyDistribution.find((d) => d.difficulty === "Hard")?.count ?? 0,
        lastPracticedAt: topic.lastPracticedAt,
      },
    ])
  );

  await saveMasteryResults(userId, result.mastery, topicCounts);

  return result;
}

export type DashboardData = AnalyticsEngineResult & { progressTrend: ProgressTrend };

/**
 * Read path for the dashboard (src/app/(dashboard)/dashboard/page.tsx).
 * Computes everything fresh from current data — including today's
 * actual recency decay, not whatever it was at last sync — but never
 * writes anything. `recomputeAnalyticsForUser` (called right after a
 * sync) is the only writer; this can be called on every page view
 * with no side effects. Progress trend is the one thing that reads
 * persisted history instead of being freshly computed, since "am I
 * improving" is inherently a comparison across sync generations.
 */
export async function getDashboardData(userId: string, now: Date = new Date()): Promise<DashboardData | null> {
  await ensureReferenceDataSeeded();

  const input = await loadAnalyticsInput(userId, now);
  if (!input) return null; // no LeetCode profile connected yet

  const result = runAnalyticsEngine(input);
  const history = await getMasteryHistory(userId);
  const progressTrend = computeProgressTrend(history);

  return { ...result, progressTrend };
}

/**
 * Read path for the roadmap page (src/app/(dashboard)/roadmap/page.tsx).
 * Same shape as getDashboardData above — computes fresh from current
 * data on every call, writes nothing. The roadmap doesn't need its
 * own persisted state: it's entirely a reshaping of what
 * runAnalyticsEngine already produced this call (mastery, gap
 * detection, forward-looking gaps) plus the skill graph, so it
 * updates automatically whenever the underlying analytics do —
 * there's no separate roadmap snapshot to go stale.
 */
export async function getRoadmapData(userId: string, now: Date = new Date()): Promise<RoadmapResult | null> {
  await ensureReferenceDataSeeded();

  const input = await loadAnalyticsInput(userId, now);
  if (!input) return null; // no LeetCode profile connected yet

  const result = runAnalyticsEngine(input);
  return buildRoadmap({
    mastery: result.mastery,
    forwardLookingGaps: result.forwardLookingGaps,
    topicRelationships: input.topicRelationships,
    now,
  });
}

export type MentorAnalyticsBundle = {
  analytics: AnalyticsEngineResult;
  progressTrend: ProgressTrend;
  roadmap: RoadmapResult;
  /** The same sampled-submissions list the engine itself used — the raw material for the mentor's "relevant history" (see src/lib/mentor/context-builder.ts), not re-queried separately. */
  submissions: SubmissionInput[];
};

/**
 * Everything the AI mentor's context builder needs (Phase 9), in one
 * shot: one loadAnalyticsInput call, one runAnalyticsEngine call —
 * not three separate ones the way calling getDashboardData,
 * getRoadmapData, and a submissions query independently would.
 * Read-only, same as the other getters here.
 */
export async function getMentorAnalyticsBundle(userId: string, now: Date = new Date()): Promise<MentorAnalyticsBundle | null> {
  await ensureReferenceDataSeeded();

  const input = await loadAnalyticsInput(userId, now);
  if (!input) return null;

  const analytics = runAnalyticsEngine(input);
  const history = await getMasteryHistory(userId);
  const progressTrend = computeProgressTrend(history);
  const roadmap = buildRoadmap({
    mastery: analytics.mastery,
    forwardLookingGaps: analytics.forwardLookingGaps,
    topicRelationships: input.topicRelationships,
    now,
  });

  return { analytics, progressTrend, roadmap, submissions: input.submissions };
}
