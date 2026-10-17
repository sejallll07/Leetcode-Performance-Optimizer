import { describe, expect, it } from "vitest";
import { runAnalyticsEngine } from "@/lib/analytics/engine";
import type { AnalyticsInput, SubmissionInput } from "@/lib/analytics/types";

const NOW = new Date("2026-06-15T00:00:00Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function submission(overrides: Partial<SubmissionInput>): SubmissionInput {
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

describe("runAnalyticsEngine", () => {
  it("produces one mastery result per topic the user has evidence for, all wired to basic+topic analytics", () => {
    const input: AnalyticsInput = {
      userId: "user-1",
      now: NOW,
      lifetimeStats: { totalSolved: 8, easySolved: 4, mediumSolved: 3, hardSolved: 1 },
      submissions: [
        // Strong-ish: well-practiced, diverse, recent
        submission({
          problemSlug: "trapping-rain-water",
          topicSlugs: ["dynamic-programming"],
          topicNames: { "dynamic-programming": "Dynamic Programming" },
          difficulty: "Hard",
          submittedAt: daysAgo(1),
        }),
        submission({
          problemSlug: "climbing-stairs",
          topicSlugs: ["dynamic-programming"],
          topicNames: { "dynamic-programming": "Dynamic Programming" },
          difficulty: "Easy",
          submittedAt: daysAgo(3),
        }),
        submission({
          problemSlug: "coin-change",
          topicSlugs: ["dynamic-programming"],
          topicNames: { "dynamic-programming": "Dynamic Programming" },
          difficulty: "Medium",
          submittedAt: daysAgo(5),
        }),
        // Under-practiced: exactly one data point
        submission({
          problemSlug: "number-of-islands",
          topicSlugs: ["graph"],
          topicNames: { graph: "Graph" },
          difficulty: "Medium",
          submittedAt: daysAgo(2),
        }),
      ],
      topicRelationships: [],
      problemCatalog: [],
    };

    const result = runAnalyticsEngine(input);

    expect(result.basic.totalSolved).toBe(8);
    expect(result.topics.map((t) => t.topicSlug).sort()).toEqual(["dynamic-programming", "graph"]);
    expect(result.mastery).toHaveLength(2);

    const dp = result.mastery.find((m) => m.topicSlug === "dynamic-programming");
    const graph = result.mastery.find((m) => m.topicSlug === "graph");

    expect(dp?.confidence).toBe("Medium"); // 3 problems
    expect(graph?.confidence).toBe("Low"); // 1 problem
    expect(graph?.classification).toBe("Under-Practiced");

    // Every mastery result should trace back to a topic analytics entry with the same slug.
    for (const m of result.mastery) {
      expect(result.topics.some((t) => t.topicSlug === m.topicSlug)).toBe(true);
    }
  });

  it("returns empty topic/mastery arrays for a user with zero sampled submissions, without erroring", () => {
    const result = runAnalyticsEngine({
      userId: "user-2",
      now: NOW,
      lifetimeStats: { totalSolved: 0, easySolved: 0, mediumSolved: 0, hardSolved: 0 },
      submissions: [],
      topicRelationships: [],
      problemCatalog: [],
    });
    expect(result.topics).toEqual([]);
    expect(result.mastery).toEqual([]);
    expect(result.basic.sampleCoverage).toBe("complete");
  });

  it("is deterministic — same input always produces the same output", () => {
    const input: AnalyticsInput = {
      userId: "user-3",
      now: NOW,
      lifetimeStats: { totalSolved: 3, easySolved: 3, mediumSolved: 0, hardSolved: 0 },
      submissions: [submission({}), submission({ problemSlug: "b", submittedAt: daysAgo(4) })],
      topicRelationships: [],
      problemCatalog: [],
    };
    expect(runAnalyticsEngine(input)).toEqual(runAnalyticsEngine(input));
  });

  it("wires topicRelationships through to gap detection end to end", () => {
    const input: AnalyticsInput = {
      userId: "user-4",
      now: NOW,
      lifetimeStats: { totalSolved: 6, easySolved: 6, mediumSolved: 0, hardSolved: 0 },
      submissions: [
        // "backtracking": weak — one easy problem, ages ago
        submission({
          problemSlug: "subsets",
          topicSlugs: ["backtracking"],
          topicNames: { backtracking: "Backtracking" },
          difficulty: "Easy",
          submittedAt: daysAgo(200),
        }),
        submission({
          problemSlug: "permutations",
          topicSlugs: ["backtracking"],
          topicNames: { backtracking: "Backtracking" },
          difficulty: "Easy",
          submittedAt: daysAgo(190),
        }),
        // "recursion": also weak — same shape
        submission({
          problemSlug: "fibonacci",
          topicSlugs: ["recursion"],
          topicNames: { recursion: "Recursion" },
          difficulty: "Easy",
          submittedAt: daysAgo(200),
        }),
        submission({
          problemSlug: "power-of-x",
          topicSlugs: ["recursion"],
          topicNames: { recursion: "Recursion" },
          difficulty: "Easy",
          submittedAt: daysAgo(190),
        }),
      ],
      topicRelationships: [
        {
          topicSlug: "backtracking",
          topicName: "Backtracking",
          prerequisiteSlug: "recursion",
          prerequisiteName: "Recursion",
          relationshipType: "PREREQUISITE",
          strength: 0.9,
        },
      ],
      problemCatalog: [],
    };

    const result = runAnalyticsEngine(input);
    const backtracking = result.mastery.find((m) => m.topicSlug === "backtracking");

    expect(backtracking?.classification).toBe("Fundamental Gap");
    expect(backtracking?.gapVerdict).toBe("prerequisite-gap");
    expect(backtracking?.weakPrerequisites.map((p) => p.topicSlug)).toContain("recursion");
    expect(backtracking?.gapExplanation).toContain("Recursion");
  });
});
