import { describe, expect, it } from "vitest";
import { computeReadiness } from "@/lib/analytics/readiness";
import type { MasteryResult, TopicClassification } from "@/lib/analytics/types";

function mastery(overrides: Partial<MasteryResult> = {}): MasteryResult {
  return {
    topicSlug: "array",
    topicName: "Array",
    masteryScore: 80,
    confidence: "High",
    classification: "Strong",
    subScores: { exposure: 1, difficulty: 1, recency: 1, diversity: 1 },
    explanation: "fixture",
    gapVerdict: "solid",
    gapExplanation: "fixture",
    weakPrerequisites: [],
    ...overrides,
  };
}

describe("computeReadiness", () => {
  it("returns an honest zero with no evidenced topics at all", () => {
    const result = computeReadiness([mastery({ classification: "Under-Practiced" })]);
    expect(result.score).toBe(0);
    expect(result.evidencedTopicCount).toBe(0);
  });

  it("excludes Under-Practiced topics from the average", () => {
    const result = computeReadiness([
      mastery({ topicSlug: "a", masteryScore: 80, classification: "Strong" }),
      mastery({ topicSlug: "b", masteryScore: 0, classification: "Under-Practiced" }),
    ]);
    expect(result.averageMasteryOfEvidenced).toBe(80);
    expect(result.evidencedTopicCount).toBe(1);
  });

  it("tempers the score when breadth is thin, without erasing it", () => {
    const oneTopicResult = computeReadiness([mastery({ masteryScore: 100 })]);
    // breadthFloor is 0.5, so score should be somewhere between 50 and 100, not 100 itself
    expect(oneTopicResult.score).toBeLessThan(100);
    expect(oneTopicResult.score).toBeGreaterThanOrEqual(50);
  });

  it("reaches the full raw average once breadth target is met", () => {
    const topics: TopicClassification[] = Array(8).fill("Strong");
    const result = computeReadiness(
      topics.map((classification, i) => mastery({ topicSlug: `t${i}`, masteryScore: 90, classification }))
    );
    expect(result.breadthRatio).toBe(1);
    expect(result.score).toBe(90);
  });

  it("assigns a level label consistent with the score", () => {
    const low = computeReadiness([mastery({ masteryScore: 10 })]);
    const high = computeReadiness(
      Array(8)
        .fill(0)
        .map((_, i) => mastery({ topicSlug: `t${i}`, masteryScore: 95 }))
    );
    expect(low.level).not.toBe(high.level);
  });
});
