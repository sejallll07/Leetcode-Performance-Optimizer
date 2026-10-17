import { describe, expect, it } from "vitest";
import { computeConfidence, computeMastery } from "@/lib/analytics/mastery";
import { ANALYTICS_CONFIG } from "@/lib/analytics/config";
import type { TopicAnalytics } from "@/lib/analytics/types";

function topic(overrides: Partial<TopicAnalytics> = {}): TopicAnalytics {
  return {
    topicSlug: "array",
    topicName: "Array",
    problemCount: 1,
    difficultyDistribution: [
      { difficulty: "Easy", count: 1 },
      { difficulty: "Medium", count: 0 },
      { difficulty: "Hard", count: 0 },
    ],
    lastPracticedAt: new Date(),
    daysSinceLastPracticed: 0,
    diversityCount: 1,
    difficultyTrend: "insufficient-data",
    ...overrides,
  };
}

describe("computeConfidence", () => {
  it("is Low at 0 or 1 sampled problems", () => {
    expect(computeConfidence(0)).toBe("Low");
    expect(computeConfidence(1)).toBe("Low");
  });
  it("is Medium between 2 and 4 sampled problems", () => {
    expect(computeConfidence(2)).toBe("Medium");
    expect(computeConfidence(4)).toBe("Medium");
  });
  it("is High at 5 or more sampled problems", () => {
    expect(computeConfidence(5)).toBe("High");
    expect(computeConfidence(20)).toBe("High");
  });
});

describe("computeMastery classification", () => {
  it("classifies as Under-Practiced whenever confidence is Low, regardless of raw scores", () => {
    const result = computeMastery(
      topic({
        problemCount: 1,
        difficultyDistribution: [
          { difficulty: "Easy", count: 0 },
          { difficulty: "Medium", count: 0 },
          { difficulty: "Hard", count: 1 },
        ],
        daysSinceLastPracticed: 0,
      })
    );
    expect(result.confidence).toBe("Low");
    expect(result.classification).toBe("Under-Practiced");
  });

  it("classifies as Strong with high, fresh, well-rounded evidence", () => {
    const result = computeMastery(
      topic({
        problemCount: 6,
        difficultyDistribution: [
          { difficulty: "Easy", count: 0 },
          { difficulty: "Medium", count: 0 },
          { difficulty: "Hard", count: 6 },
        ],
        daysSinceLastPracticed: 0,
        diversityCount: 1,
      })
    );
    expect(result.confidence).toBe("High");
    expect(result.masteryScore).toBeGreaterThanOrEqual(ANALYTICS_CONFIG.mastery.strongThreshold);
    expect(result.classification).toBe("Strong");
  });

  it("classifies the same strong evidence as Revision Needed once it's gone stale", () => {
    const result = computeMastery(
      topic({
        problemCount: 6,
        difficultyDistribution: [
          { difficulty: "Easy", count: 0 },
          { difficulty: "Medium", count: 0 },
          { difficulty: "Hard", count: 6 },
        ],
        daysSinceLastPracticed: ANALYTICS_CONFIG.recency.staleAfterDays + 5,
        diversityCount: 1,
      })
    );
    expect(result.masteryScore).toBeGreaterThanOrEqual(ANALYTICS_CONFIG.mastery.strongThreshold);
    expect(result.classification).toBe("Revision Needed");
  });

  it("classifies as Fundamental Gap when there's real evidence but the signal is still weak", () => {
    const result = computeMastery(
      topic({
        problemCount: 2,
        difficultyDistribution: [
          { difficulty: "Easy", count: 2 },
          { difficulty: "Medium", count: 0 },
          { difficulty: "Hard", count: 0 },
        ],
        daysSinceLastPracticed: 200,
        diversityCount: 1,
      })
    );
    expect(result.confidence).not.toBe("Low");
    expect(result.masteryScore).toBeLessThan(ANALYTICS_CONFIG.mastery.fundamentalGapThreshold);
    expect(result.classification).toBe("Fundamental Gap");
  });

  it("classifies mid-range, non-recent evidence as Weak", () => {
    const result = computeMastery(
      topic({
        problemCount: 3,
        difficultyDistribution: [
          { difficulty: "Easy", count: 0 },
          { difficulty: "Medium", count: 3 },
          { difficulty: "Hard", count: 0 },
        ],
        daysSinceLastPracticed: 20,
        diversityCount: 1,
      })
    );
    expect(result.masteryScore).toBeGreaterThanOrEqual(ANALYTICS_CONFIG.mastery.fundamentalGapThreshold);
    expect(result.masteryScore).toBeLessThan(ANALYTICS_CONFIG.mastery.strongThreshold);
    expect(result.classification).toBe("Weak");
  });

  it("classifies the same mid-range evidence as Emerging when activity is recent", () => {
    const result = computeMastery(
      topic({
        problemCount: 3,
        difficultyDistribution: [
          { difficulty: "Easy", count: 0 },
          { difficulty: "Medium", count: 3 },
          { difficulty: "Hard", count: 0 },
        ],
        daysSinceLastPracticed: 5,
        diversityCount: 1,
      })
    );
    expect(result.masteryScore).toBeLessThan(ANALYTICS_CONFIG.mastery.strongThreshold);
    expect(result.classification).toBe("Emerging");
  });

  it("always returns an explanation that cites the actual numbers, not a generic string", () => {
    const result = computeMastery(topic({ problemCount: 3, daysSinceLastPracticed: 5 }));
    expect(result.explanation).toContain(String(result.masteryScore));
    expect(result.explanation.toLowerCase()).toContain(result.confidence.toLowerCase());
  });

  it("regression: difficulty sub-score stays in range even if problemCount and difficultyDistribution's sum disagree", () => {
    // Caught by the previous test with a stale fixture — computeDifficultyScore
    // used to divide by `problemCount` instead of the distribution's own
    // total, producing an out-of-range score whenever they didn't match.
    const result = computeMastery(
      topic({
        problemCount: 10,
        difficultyDistribution: [
          { difficulty: "Easy", count: 1 },
          { difficulty: "Medium", count: 0 },
          { difficulty: "Hard", count: 0 },
        ],
      })
    );
    expect(result.subScores.difficulty).toBeGreaterThanOrEqual(0);
    expect(result.subScores.difficulty).toBeLessThanOrEqual(1);
  });

  it("sub-scores are all between 0 and 1", () => {
    const result = computeMastery(
      topic({
        problemCount: 10,
        difficultyDistribution: [
          { difficulty: "Easy", count: 3 },
          { difficulty: "Medium", count: 4 },
          { difficulty: "Hard", count: 3 },
        ],
        daysSinceLastPracticed: 0,
        diversityCount: 3,
      })
    );
    for (const value of Object.values(result.subScores)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
