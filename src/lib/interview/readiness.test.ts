import { describe, expect, it } from "vitest";
import { computeInterviewReadiness } from "@/lib/interview/readiness";
import type { MasteryResult, TopicAnalytics } from "@/lib/analytics/types";
import type { InterviewProfileInput } from "@/lib/interview/types";

function mastery(overrides: Partial<MasteryResult> = {}): MasteryResult {
  return {
    topicSlug: "array",
    topicName: "Array",
    masteryScore: 50,
    confidence: "Medium",
    classification: "Weak",
    subScores: { exposure: 0.5, difficulty: 0.5, recency: 0.5, diversity: 0.5 },
    explanation: "fixture",
    gapVerdict: "genuinely-weak",
    gapExplanation: "fixture",
    weakPrerequisites: [],
    ...overrides,
  };
}

function topicAnalytics(overrides: Partial<TopicAnalytics> = {}): TopicAnalytics {
  return {
    topicSlug: "array",
    topicName: "Array",
    problemCount: 3,
    difficultyDistribution: [{ difficulty: "Easy", count: 3 }],
    lastPracticedAt: new Date("2026-09-20T00:00:00Z"),
    daysSinceLastPracticed: 5,
    diversityCount: 1,
    difficultyTrend: "steady",
    ...overrides,
  };
}

function input(overrides: Partial<InterviewProfileInput> = {}): InterviewProfileInput {
  return {
    mastery: [],
    topics: [],
    forwardLookingGaps: [],
    catalog: [],
    solvedSlugs: new Set(),
    recentlyUsedSlugs: new Set(),
    recentSubmissionCount: 0,
    recentMediumHardSubmissionCount: 0,
    distinctActiveDays: 0,
    revisionReviewsCompletedRecently: 0,
    currentlyOverdueRevisionCount: 0,
    ...overrides,
  };
}

describe("computeInterviewReadiness", () => {
  it("returns 0 and a not-enough-evidence explanation when nothing is evidenced yet", () => {
    const result = computeInterviewReadiness(input({ mastery: [mastery({ classification: "Under-Practiced" })] }));
    expect(result.score).toBe(0);
    expect(result.factors).toHaveLength(8);
    expect(result.factors.every((f) => f.score === 0)).toBe(true);
  });

  it("scores topicBreadth against the configured target, capped at 100", () => {
    const eightEvidenced = Array.from({ length: 8 }, (_, i) => mastery({ topicSlug: `t${i}`, topicName: `T${i}` }));
    const result = computeInterviewReadiness(input({ mastery: eightEvidenced }));
    const breadth = result.factors.find((f) => f.key === "topicBreadth");
    expect(breadth?.score).toBe(100); // 8 evidenced == breadthTargetTopics

    const fourEvidenced = eightEvidenced.slice(0, 4);
    const partial = computeInterviewReadiness(input({ mastery: fourEvidenced }));
    expect(partial.factors.find((f) => f.key === "topicBreadth")?.score).toBe(50); // 4/8
  });

  it("scores mediumPerformance from real Medium exposure per evidenced topic, not just being evidenced", () => {
    const result = computeInterviewReadiness(
      input({
        mastery: [mastery({ topicSlug: "array" }), mastery({ topicSlug: "graph", topicName: "Graph" })],
        topics: [topicAnalytics({ topicSlug: "array", difficultyDistribution: [{ difficulty: "Medium", count: 2 }] }), topicAnalytics({ topicSlug: "graph", topicName: "Graph", difficultyDistribution: [{ difficulty: "Easy", count: 3 }] })],
      })
    );
    expect(result.factors.find((f) => f.key === "mediumPerformance")?.score).toBe(50); // 1 of 2 evidenced topics has Medium exposure
  });

  it("scores hardExposure tiered, not linearly", () => {
    const zero = computeInterviewReadiness(input({ mastery: [mastery()], topics: [topicAnalytics()] }));
    expect(zero.factors.find((f) => f.key === "hardExposure")?.score).toBe(0);

    const oneHard = computeInterviewReadiness(input({ mastery: [mastery()], topics: [topicAnalytics({ difficultyDistribution: [{ difficulty: "Hard", count: 1 }] })] }));
    expect(oneHard.factors.find((f) => f.key === "hardExposure")?.score).toBe(40);

    const sixHard = computeInterviewReadiness(input({ mastery: [mastery()], topics: [topicAnalytics({ difficultyDistribution: [{ difficulty: "Hard", count: 6 }] })] }));
    expect(sixHard.factors.find((f) => f.key === "hardExposure")?.score).toBe(100);
  });

  it("penalizes weakTopicCount per weak/fundamental-gap topic and never goes below 0", () => {
    const twoWeak = computeInterviewReadiness(
      input({ mastery: [mastery({ topicSlug: "a", classification: "Weak" }), mastery({ topicSlug: "b", topicName: "B", classification: "Fundamental Gap" }), mastery({ topicSlug: "c", topicName: "C", classification: "Strong" })] })
    );
    expect(twoWeak.factors.find((f) => f.key === "weakTopicCount")?.score).toBe(76); // 100 - 2*12

    const manyWeak = computeInterviewReadiness(input({ mastery: Array.from({ length: 12 }, (_, i) => mastery({ topicSlug: `w${i}`, classification: "Weak" })) }));
    expect(manyWeak.factors.find((f) => f.key === "weakTopicCount")?.score).toBe(0); // clamped, not negative
  });

  it("scores revisionConsistency neutrally when there's no revision history, not as 0", () => {
    const result = computeInterviewReadiness(input({ mastery: [mastery()], revisionReviewsCompletedRecently: 0, currentlyOverdueRevisionCount: 0 }));
    expect(result.factors.find((f) => f.key === "revisionConsistency")?.score).toBe(50);
  });

  it("scores revisionConsistency as completed-vs-overdue ratio when there is history", () => {
    const result = computeInterviewReadiness(input({ mastery: [mastery()], revisionReviewsCompletedRecently: 3, currentlyOverdueRevisionCount: 1 }));
    expect(result.factors.find((f) => f.key === "revisionConsistency")?.score).toBe(75);
  });

  it("combines all 8 factors with their configured weights into the overall score", () => {
    const result = computeInterviewReadiness(
      input({
        mastery: Array.from({ length: 8 }, (_, i) => mastery({ topicSlug: `t${i}`, topicName: `T${i}`, masteryScore: 100, classification: "Strong" })),
        topics: Array.from({ length: 8 }, (_, i) => topicAnalytics({ topicSlug: `t${i}`, topicName: `T${i}`, difficultyDistribution: [{ difficulty: "Medium", count: 3 }, { difficulty: "Hard", count: 6 }] })),
        recentSubmissionCount: 8,
        recentMediumHardSubmissionCount: 8,
        distinctActiveDays: 10,
        revisionReviewsCompletedRecently: 5,
        currentlyOverdueRevisionCount: 0,
      })
    );
    // Every factor should be maxed out here -> overall should be 100.
    expect(result.score).toBe(100);
    expect(result.level).toBe("Well Prepared");
  });
});
