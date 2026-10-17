import { INTERVIEW_CONFIG } from "@/lib/interview/config";
import type { InterviewProfileInput } from "@/lib/interview/types";
import type { InterviewReadinessFactor, InterviewReadinessResult } from "@/lib/interview/types";

const {
  weights,
  levels,
  breadthTargetTopics,
  hardExposureTiers,
  weakTopicPenaltyPerTopic,
  revisionConsistencyNeutralScore,
  recentActivityTargetSubmissions,
  consistencyTargetActiveDays,
} = INTERVIEW_CONFIG;

function levelFor(score: number): string {
  const band = levels.find((l) => score <= l.max);
  return band?.label ?? levels[levels.length - 1].label;
}

function clamp0to100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Combines the 8 named factors from the Phase 11 spec into one
 * weighted score. Every factor is a pure function of already-computed
 * or already-queried data — nothing here re-derives mastery or
 * touches the DB (that's the caller's job, see
 * src/services/interview/interview-service.ts).
 */
export function computeInterviewReadiness(input: InterviewProfileInput): InterviewReadinessResult {
  const { mastery, topics, recentSubmissionCount, recentMediumHardSubmissionCount, distinctActiveDays, revisionReviewsCompletedRecently, currentlyOverdueRevisionCount } = input;

  const evidenced = mastery.filter((m) => m.classification !== "Under-Practiced");

  if (evidenced.length === 0) {
    const factors: InterviewReadinessFactor[] = Object.entries(weights).map(([key, weight]) => ({
      key: key as InterviewReadinessFactor["key"],
      label: FACTOR_LABELS[key as InterviewReadinessFactor["key"]],
      score: 0,
      weight,
      explanation: "Not enough evidence yet — sync more solved problems first.",
    }));
    return { score: 0, level: levelFor(0), factors, explanation: "Not enough evidence yet on any topic to assess interview readiness — sync more solved problems to get a first read." };
  }

  const topicsBySlug = new Map(topics.map((t) => [t.topicSlug, t]));

  // 1. Topic breadth
  const breadthRatio = Math.min(evidenced.length / breadthTargetTopics, 1);
  const topicBreadth = clamp0to100(breadthRatio * 100);

  // 2. Topic depth — average mastery of the topics we can actually vouch for.
  const topicDepth = clamp0to100(evidenced.reduce((sum, m) => sum + m.masteryScore, 0) / evidenced.length);

  // 3. Medium performance — share of evidenced topics with real Medium-level exposure, not just Easy.
  const evidencedWithMedium = evidenced.filter((m) => (topicsBySlug.get(m.topicSlug)?.difficultyDistribution.find((d) => d.difficulty === "Medium")?.count ?? 0) > 0);
  const mediumPerformance = clamp0to100((evidencedWithMedium.length / evidenced.length) * 100);

  // 4. Hard exposure — tiered, not linear; even a couple of Hard solves matters.
  const totalHardCount = topics.reduce((sum, t) => sum + (t.difficultyDistribution.find((d) => d.difficulty === "Hard")?.count ?? 0), 0);
  const hardTier = hardExposureTiers.find((tier) => totalHardCount >= tier.minCount);
  const hardExposure = hardTier?.score ?? 0;

  // 5. Weak-topic count — fewer is better, so this factor is framed inverted from the raw count.
  const weakCount = evidenced.filter((m) => m.classification === "Weak" || m.classification === "Fundamental Gap").length;
  const weakTopicCount = clamp0to100(100 - weakCount * weakTopicPenaltyPerTopic);

  // 6. Recent performance — activity level in the recent window, blended with how much of it skewed beyond Easy.
  const recentActivityScore = clamp0to100((recentSubmissionCount / recentActivityTargetSubmissions) * 100);
  const recentDifficultyShare = recentSubmissionCount > 0 ? clamp0to100((recentMediumHardSubmissionCount / recentSubmissionCount) * 100) : 0;
  const recentPerformance = recentSubmissionCount === 0 ? 0 : clamp0to100((recentActivityScore + recentDifficultyShare) / 2);

  // 7. Revision consistency — completed vs. currently overdue. No history at all reads as neutral, not bad.
  const revisionTotal = revisionReviewsCompletedRecently + currentlyOverdueRevisionCount;
  const revisionConsistency = revisionTotal === 0 ? revisionConsistencyNeutralScore : clamp0to100((revisionReviewsCompletedRecently / revisionTotal) * 100);

  // 8. Problem-solving consistency — distinct active days, not raw submission count (a streak signal, not a volume one).
  const problemSolvingConsistency = clamp0to100((distinctActiveDays / consistencyTargetActiveDays) * 100);

  const scores: Record<InterviewReadinessFactor["key"], number> = {
    topicBreadth,
    topicDepth,
    mediumPerformance,
    hardExposure,
    weakTopicCount,
    recentPerformance,
    revisionConsistency,
    problemSolvingConsistency,
  };

  const explanations: Record<InterviewReadinessFactor["key"], string> = {
    topicBreadth: `${evidenced.length} of a target ${breadthTargetTopics}+ topics have enough evidence to assess.`,
    topicDepth: `Average mastery across those ${evidenced.length} evidenced topics is ${topicDepth}/100.`,
    mediumPerformance: `${evidencedWithMedium.length} of ${evidenced.length} evidenced topics have real Medium-level exposure.`,
    hardExposure: totalHardCount === 0 ? "No Hard problems solved yet." : `${totalHardCount} Hard problem${totalHardCount === 1 ? "" : "s"} solved.`,
    weakTopicCount: weakCount === 0 ? "No Weak or Fundamental Gap topics right now." : `${weakCount} topic${weakCount === 1 ? "" : "s"} currently Weak or Fundamental Gap.`,
    recentPerformance: recentSubmissionCount === 0 ? "No submissions in the recent window." : `${recentSubmissionCount} submissions recently, ${recentDifficultyShare}% Medium or Hard.`,
    revisionConsistency: revisionTotal === 0 ? "No revision history yet." : `${revisionReviewsCompletedRecently} reviews completed vs. ${currentlyOverdueRevisionCount} currently overdue.`,
    problemSolvingConsistency: `Active on ${distinctActiveDays} of the last ${INTERVIEW_CONFIG.recentWindowDays} days.`,
  };

  const factors: InterviewReadinessFactor[] = (Object.keys(weights) as InterviewReadinessFactor["key"][]).map((key) => ({
    key,
    label: FACTOR_LABELS[key],
    score: scores[key],
    weight: weights[key],
    explanation: explanations[key],
  }));

  const score = clamp0to100(factors.reduce((sum, f) => sum + f.score * f.weight, 0));

  return {
    score,
    level: levelFor(score),
    factors,
    explanation: `Combines topic breadth, depth, medium/hard exposure, weak-topic count, recent activity, and consistency into one weighted read — see the factor breakdown for specifics.`,
  };
}

const FACTOR_LABELS: Record<InterviewReadinessFactor["key"], string> = {
  topicBreadth: "Topic breadth",
  topicDepth: "Topic depth",
  mediumPerformance: "Medium performance",
  hardExposure: "Hard exposure",
  weakTopicCount: "Weak-topic count",
  recentPerformance: "Recent performance",
  revisionConsistency: "Revision consistency",
  problemSolvingConsistency: "Problem-solving consistency",
};
