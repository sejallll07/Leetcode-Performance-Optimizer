import { computeBasicAnalytics } from "@/lib/analytics/basic-analytics";
import { computeTopicAnalytics } from "@/lib/analytics/topic-analytics";
import { computeMastery } from "@/lib/analytics/mastery";
import { detectGaps } from "@/lib/analytics/gap-detection";
import { computeReadiness } from "@/lib/analytics/readiness";
import { computeNextActions } from "@/lib/analytics/next-actions";
import { computeRecommendations } from "@/lib/analytics/recommendation-engine";
import type { AnalyticsEngineResult, AnalyticsInput } from "@/lib/analytics/types";

/**
 * The whole deterministic analytics pipeline, in one call — no AI,
 * no DB, no network. Every step reads only from `input`. This is the
 * function the analytics service (src/services/analytics) calls
 * after loading real data; it's also exactly what the tests exercise
 * directly with synthetic input.
 *
 * Pipeline: basic stats -> per-topic analytics -> raw mastery scoring
 * (Phase 3) -> skill-graph-aware gap detection (Phase 4), which
 * enriches the raw scoring rather than replacing it -> readiness
 * score and next-actions synthesis (Phase 5) -> specific problem
 * recommendations (Phase 6), which draw on everything computed above
 * plus the problem catalog and the student's own solved-problem history.
 */
export function runAnalyticsEngine(input: AnalyticsInput): AnalyticsEngineResult {
  const basic = computeBasicAnalytics(input);
  const topics = computeTopicAnalytics(input);
  const rawMastery = topics.map((topic) => computeMastery(topic));
  const { mastery, forwardLookingGaps } = detectGaps(rawMastery, input.topicRelationships);
  const readiness = computeReadiness(mastery);
  const nextActions = computeNextActions(mastery, forwardLookingGaps);
  const recommendations = computeRecommendations({
    mastery,
    topics,
    forwardLookingGaps,
    topicRelationships: input.topicRelationships,
    submissions: input.submissions,
    catalog: input.problemCatalog,
  });

  return { basic, topics, mastery, forwardLookingGaps, readiness, nextActions, recommendations };
}
