import { describe, expect, it } from "vitest";
import { computeBasicAnalytics } from "@/lib/analytics/basic-analytics";
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

function baseInput(overrides: Partial<AnalyticsInput> = {}): AnalyticsInput {
  return {
    userId: "user-1",
    now: NOW,
    lifetimeStats: { totalSolved: 0, easySolved: 0, mediumSolved: 0, hardSolved: 0 },
    submissions: [],
    topicRelationships: [],
    problemCatalog: [],
    ...overrides,
  };
}

describe("computeBasicAnalytics", () => {
  it("reports lifetime stats straight from the profile, not the sample", () => {
    const result = computeBasicAnalytics(
      baseInput({
        lifetimeStats: { totalSolved: 500, easySolved: 200, mediumSolved: 250, hardSolved: 50 },
        submissions: [submission()],
      })
    );
    expect(result.totalSolved).toBe(500);
    expect(result.easySolved).toBe(200);
    expect(result.mediumSolved).toBe(250);
    expect(result.hardSolved).toBe(50);
  });

  it("counts recent activity within 7 and 30 day windows", () => {
    const result = computeBasicAnalytics(
      baseInput({
        submissions: [
          submission({ submittedAt: daysAgo(2) }),
          submission({ submittedAt: daysAgo(10) }),
          submission({ submittedAt: daysAgo(40) }),
        ],
      })
    );
    expect(result.recentActivity.submissionsLast7Days).toBe(1);
    expect(result.recentActivity.submissionsLast30Days).toBe(2);
    expect(result.recentActivity.daysSinceLastSubmission).toBe(2);
  });

  it("handles zero submissions honestly instead of erroring", () => {
    const result = computeBasicAnalytics(baseInput());
    expect(result.recentActivity.mostRecentSubmissionAt).toBeNull();
    expect(result.recentActivity.daysSinceLastSubmission).toBeNull();
    expect(result.topicDistribution).toEqual([]);
  });

  it("builds topic distribution across multi-tag submissions", () => {
    const result = computeBasicAnalytics(
      baseInput({
        submissions: [
          submission({ topicSlugs: ["array", "hash-table"], topicNames: { array: "Array", "hash-table": "Hash Table" } }),
          submission({ topicSlugs: ["array"], topicNames: { array: "Array" } }),
        ],
      })
    );
    const array = result.topicDistribution.find((t) => t.topicSlug === "array");
    const hashTable = result.topicDistribution.find((t) => t.topicSlug === "hash-table");
    expect(array?.count).toBe(2);
    expect(hashTable?.count).toBe(1);
  });

  it("marks sample coverage complete when we've ingested at least the full lifetime count", () => {
    const result = computeBasicAnalytics(
      baseInput({
        lifetimeStats: { totalSolved: 2, easySolved: 2, mediumSolved: 0, hardSolved: 0 },
        submissions: [submission(), submission({ problemSlug: "other" })],
      })
    );
    expect(result.sampleCoverage).toBe("complete");
  });

  it("marks sample coverage partial when the real history is bigger than our sample", () => {
    const result = computeBasicAnalytics(
      baseInput({
        lifetimeStats: { totalSolved: 500, easySolved: 200, mediumSolved: 250, hardSolved: 50 },
        submissions: [submission()],
      })
    );
    expect(result.sampleCoverage).toBe("partial");
  });

  it("never fabricates a success rate — states plainly what's missing", () => {
    const result = computeBasicAnalytics(baseInput({ submissions: [submission()] }));
    expect(result.submissionStats.acceptedSubmissionsSampled).toBe(1);
    expect(result.submissionStats.note.toLowerCase()).toContain("accepted");
  });
});
