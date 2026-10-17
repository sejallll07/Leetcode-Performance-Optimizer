import { ANALYTICS_CONFIG } from "@/lib/analytics/config";
import type { Confidence, RawMasteryResult, TopicAnalytics, TopicClassification } from "@/lib/analytics/types";

const { confidence: confidenceConfig, mastery: masteryConfig, recency, exposure, weights } = ANALYTICS_CONFIG;

export function computeConfidence(problemCount: number): Confidence {
  if (problemCount <= confidenceConfig.lowMaxProblems) return "Low";
  if (problemCount <= confidenceConfig.mediumMaxProblems) return "Medium";
  return "High";
}

function computeExposureScore(problemCount: number): number {
  return Math.min(problemCount / exposure.targetProblemCount, 1);
}

function computeDifficultyScore(topic: TopicAnalytics): number {
  const totalCount = topic.difficultyDistribution.reduce((sum, d) => sum + d.count, 0);
  if (totalCount === 0) return 0;
  const totalWeight = topic.difficultyDistribution.reduce((sum, d) => {
    const weight = d.difficulty === "Easy" ? 1 : d.difficulty === "Medium" ? 2 : 3;
    return sum + weight * d.count;
  }, 0);
  const avgWeight = totalWeight / totalCount; // 1..3
  return (avgWeight - 1) / 2; // normalize to 0..1
}

function computeRecencyScore(daysSinceLastPracticed: number | null): number {
  if (daysSinceLastPracticed === null) return 0;
  return Math.exp(-daysSinceLastPracticed / recency.decayDays);
}

function computeDiversityScore(diversityCount: number): number {
  return diversityCount / 3; // 0..1, out of the 3 difficulty levels
}

function classify(
  masteryScore: number,
  confidence: Confidence,
  topic: TopicAnalytics
): TopicClassification {
  if (confidence === "Low") return "Under-Practiced";

  const isFresh = (topic.daysSinceLastPracticed ?? Infinity) <= recency.staleAfterDays;

  if (masteryScore >= masteryConfig.strongThreshold) {
    return isFresh ? "Strong" : "Revision Needed";
  }

  if (masteryScore < masteryConfig.fundamentalGapThreshold) {
    // We *do* have enough sampled evidence (confidence isn't Low) and
    // it's still this weak — a real gap, not just an untried topic.
    return "Fundamental Gap";
  }

  const isEmerging = (topic.daysSinceLastPracticed ?? Infinity) <= recency.emergingWindowDays;
  if (isEmerging) return "Emerging";

  return "Weak";
}

function buildExplanation(
  topic: TopicAnalytics,
  confidence: Confidence,
  masteryScore: number,
  classification: TopicClassification
): string {
  const days = topic.daysSinceLastPracticed;
  const recencyPhrase =
    days === null ? "no recorded practice" : days === 0 ? "practiced today" : `last practiced ${days} day${days === 1 ? "" : "s"} ago`;

  const base = `${topic.problemCount} problem${topic.problemCount === 1 ? "" : "s"} seen (${confidence.toLowerCase()} confidence), ${recencyPhrase}, mastery ${masteryScore}/100.`;

  switch (classification) {
    case "Under-Practiced":
      return `${base} Not enough evidence yet to assess this topic confidently.`;
    case "Strong":
      return `${base} Consistent, fairly difficult, recent evidence — holding up well.`;
    case "Revision Needed":
      return `${base} The evidence looks solid, but it's been a while — worth a refresher.`;
    case "Fundamental Gap":
      return `${base} Enough attempts to judge, and the signal is weak — likely a real gap, not just inexperience.`;
    case "Emerging":
      return `${base} Below the "Strong" bar, but activity here is recent and picking up.`;
    case "Weak":
      return `${base} Inconsistent performance — more practice needed before this is dependable.`;
  }
}

export function computeMastery(topic: TopicAnalytics): RawMasteryResult {
  const confidence = computeConfidence(topic.problemCount);

  const subScores = {
    exposure: computeExposureScore(topic.problemCount),
    difficulty: computeDifficultyScore(topic),
    recency: computeRecencyScore(topic.daysSinceLastPracticed),
    diversity: computeDiversityScore(topic.diversityCount),
  };

  const masteryScore = Math.round(
    (subScores.exposure * weights.exposure +
      subScores.difficulty * weights.difficulty +
      subScores.recency * weights.recency +
      subScores.diversity * weights.diversity) *
      100
  );

  const classification = classify(masteryScore, confidence, topic);
  const explanation = buildExplanation(topic, confidence, masteryScore, classification);

  return {
    topicSlug: topic.topicSlug,
    topicName: topic.topicName,
    masteryScore,
    confidence,
    classification,
    subScores,
    explanation,
  };
}
