import { runAnalyticsEngine } from "@/lib/analytics/engine";
import type { NextAction, ProblemCatalogEntry, RecommendationResult } from "@/lib/analytics/types";
import { ensureReferenceDataSeededOnce } from "@/lib/reference-data-cache";
import { buildRoadmap } from "@/lib/roadmap/roadmap-builder";
import type { RoadmapResult } from "@/lib/roadmap/types";
import type { RevisionItemState } from "@/lib/revision/types";
import { loadAnalyticsInput } from "@/repositories/analytics-repository";
import { getRevisionItemsForUser } from "@/repositories/revision-repository";

/**
 * Everything the redesigned Roadmap page needs, gathered in one
 * read-only call. Every field is something the app already computes
 * or stores elsewhere — this service only brings them together so
 * the Roadmap can say "do this next, here's why, here's what to
 * practice, here's what to revise" instead of just drawing the graph.
 */
export type RoadmapPageData = {
  roadmap: RoadmapResult;
  /** The same prioritized list the Dashboard's Focus Today uses — so the two pages can't contradict each other about what to do first. */
  nextActions: NextAction[];
  /** Evidence-based practice problems (same engine and caps as the Dashboard). */
  recommendations: RecommendationResult;
  /** The curated problem pool — raw material for "starter problems" on topics with no evidence yet. Selection happens in a pure helper, not here. */
  catalog: ProblemCatalogEntry[];
  /** Problems already solved in the ingested sample (the same sample the recommendation engine excludes), so a starter problem is never one you've done. */
  solvedProblemSlugs: string[];
  /** Every revision item, uncapped. getRevisionCenterData caps its display lists; per-topic counts need the full set. Due/overdue is decided later by the existing categorizeRevisionItems, not re-implemented. */
  revisionItems: RevisionItemState[];
};

/**
 * Read path for the redesigned Roadmap page. Same contract as
 * getRoadmapData / getDashboardData: computes fresh on every call,
 * writes nothing, returns null when no LeetCode profile is connected.
 *
 * One loadAnalyticsInput + one runAnalyticsEngine call — the roadmap,
 * next actions and recommendations all come from that single run, not
 * three separate ones. The revision read doesn't depend on the
 * analytics input, so the two run in parallel.
 *
 * Additive on purpose: getRoadmapData and every other existing
 * getter is untouched, so nothing else that uses them can change
 * behavior.
 */
export async function getRoadmapPageData(userId: string, now: Date = new Date()): Promise<RoadmapPageData | null> {
  await ensureReferenceDataSeededOnce();

  const [input, revisionItems] = await Promise.all([loadAnalyticsInput(userId, now), getRevisionItemsForUser(userId)]);
  if (!input) return null; // no LeetCode profile connected yet

  const analytics = runAnalyticsEngine(input);
  const roadmap = buildRoadmap({
    mastery: analytics.mastery,
    forwardLookingGaps: analytics.forwardLookingGaps,
    topicRelationships: input.topicRelationships,
    now,
  });

  return {
    roadmap,
    nextActions: analytics.nextActions,
    recommendations: analytics.recommendations,
    catalog: input.problemCatalog,
    solvedProblemSlugs: [...new Set(input.submissions.map((s) => s.problemSlug))],
    revisionItems,
  };
}