import { ANALYTICS_CONFIG } from "@/lib/analytics/config";
import type { MasteryResult, ReadinessResult } from "@/lib/analytics/types";

const { breadthTargetTopics, breadthFloor, levels } = ANALYTICS_CONFIG.readiness;

function levelFor(score: number): string {
  const band = levels.find((l) => score <= l.max);
  return band?.label ?? levels[levels.length - 1].label;
}

/**
 * A single, honest "how am I doing overall" number. Two things feed
 * it: how strong the topics we *can* confidently assess look
 * (average mastery, Under-Practiced topics excluded since we can't
 * vouch for them), and how much breadth that average is actually
 * based on (one great topic shouldn't read the same as eight).
 * Breadth can knock the score down toward `breadthFloor` of its raw
 * value, never below it — thin evidence tempers the score, it
 * doesn't erase what's genuinely there.
 */
export function computeReadiness(mastery: MasteryResult[]): ReadinessResult {
  const evidenced = mastery.filter((m) => m.classification !== "Under-Practiced");

  if (evidenced.length === 0) {
    return {
      score: 0,
      level: levelFor(0),
      evidencedTopicCount: 0,
      averageMasteryOfEvidenced: 0,
      breadthRatio: 0,
      explanation:
        "Not enough evidence yet on any topic to estimate readiness — sync more solved problems to get a first read.",
    };
  }

  const averageMasteryOfEvidenced = Math.round(
    evidenced.reduce((sum, m) => sum + m.masteryScore, 0) / evidenced.length
  );
  const breadthRatio = Math.min(evidenced.length / breadthTargetTopics, 1);
  const score = Math.round(averageMasteryOfEvidenced * (breadthFloor + (1 - breadthFloor) * breadthRatio));
  const level = levelFor(score);

  const breadthNote =
    breadthRatio < 1
      ? ` Based on ${evidenced.length} topic${evidenced.length === 1 ? "" : "s"} with enough evidence to assess — the score is tempered until that broadens toward ${breadthTargetTopics}.`
      : ` Based on ${evidenced.length} topics with enough evidence to assess.`;

  return {
    score,
    level,
    evidencedTopicCount: evidenced.length,
    averageMasteryOfEvidenced,
    breadthRatio,
    explanation: `Average mastery across evaluated topics is ${averageMasteryOfEvidenced}/100.${breadthNote}`,
  };
}
