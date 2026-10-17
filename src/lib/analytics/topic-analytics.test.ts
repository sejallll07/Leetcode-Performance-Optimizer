import { describe, expect, it } from "vitest";
import { computeTopicAnalytics } from "@/lib/analytics/topic-analytics";
import type { AnalyticsInput, SubmissionInput } from "@/lib/analytics/types";

const NOW = new Date("2026-06-15T00:00:00Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function submission(overrides: Partial<SubmissionInput> = {}): SubmissionInput {
  return {
    topicSlugs: ["array"],
    topicNames: { array: "Array" },
    problemSlug: "two-sum",
    problemTitle: "Two Sum",
    difficulty: "Easy",
    submittedAt: daysAgo(1),
    ...overrides,
  };
}

function baseInput(submissions: SubmissionInput[]): AnalyticsInput {
  return {
    userId: "user-1",
    now: NOW,
    lifetimeStats: { totalSolved: submissions.length, easySolved: 0, mediumSolved: 0, hardSolved: 0 },
    submissions,
    topicRelationships: [],
    problemCatalog: [],
  };
}

describe("computeTopicAnalytics", () => {
  it("only returns topics the user has sampled evidence for", () => {
    const result = computeTopicAnalytics(baseInput([submission({ topicSlugs: ["array"] })]));
    expect(result).toHaveLength(1);
    expect(result[0].topicSlug).toBe("array");
  });

  it("counts a submission toward every topic it's tagged with", () => {
    const result = computeTopicAnalytics(
      baseInput([
        submission({
          topicSlugs: ["array", "two-pointers"],
          topicNames: { array: "Array", "two-pointers": "Two Pointers" },
        }),
      ])
    );
    expect(result.find((t) => t.topicSlug === "array")?.problemCount).toBe(1);
    expect(result.find((t) => t.topicSlug === "two-pointers")?.problemCount).toBe(1);
  });

  it("tracks the most recent practice date per topic", () => {
    const result = computeTopicAnalytics(
      baseInput([submission({ submittedAt: daysAgo(10) }), submission({ submittedAt: daysAgo(2) })])
    );
    expect(result[0].daysSinceLastPracticed).toBe(2);
  });

  it("computes diversity as distinct difficulty levels touched", () => {
    const result = computeTopicAnalytics(
      baseInput([
        submission({ difficulty: "Easy" }),
        submission({ difficulty: "Medium" }),
        submission({ difficulty: "Easy" }),
      ])
    );
    expect(result[0].diversityCount).toBe(2); // Easy + Medium, not Hard
  });

  it("reports insufficient-data trend with only one sampled submission", () => {
    const result = computeTopicAnalytics(baseInput([submission()]));
    expect(result[0].difficultyTrend).toBe("insufficient-data");
  });

  it("detects an increasing difficulty trend across the sample", () => {
    const result = computeTopicAnalytics(
      baseInput([
        submission({ difficulty: "Easy", submittedAt: daysAgo(20) }),
        submission({ difficulty: "Hard", submittedAt: daysAgo(1) }),
      ])
    );
    expect(result[0].difficultyTrend).toBe("increasing");
  });

  it("reports a steady trend when difficulty doesn't clearly rise", () => {
    const result = computeTopicAnalytics(
      baseInput([
        submission({ difficulty: "Medium", submittedAt: daysAgo(20) }),
        submission({ difficulty: "Easy", submittedAt: daysAgo(1) }),
      ])
    );
    expect(result[0].difficultyTrend).toBe("steady");
  });
});
