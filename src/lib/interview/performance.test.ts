import { describe, expect, it } from "vitest";
import { buildPerformanceReport } from "@/lib/interview/performance";
import type { MockInterviewProblemOutcome, MockInterviewProblemPick } from "@/lib/interview/types";

function pick(overrides: Partial<MockInterviewProblemPick> = {}): MockInterviewProblemPick {
  return {
    role: "warmup",
    slug: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    topicSlugs: ["array"],
    topicNames: ["Array"],
    reason: "fixture",
    ...overrides,
  };
}

const PROBLEMS: MockInterviewProblemPick[] = [
  pick({ role: "warmup", slug: "two-sum", title: "Two Sum", difficulty: "Easy", topicSlugs: ["array"], topicNames: ["Array"] }),
  pick({ role: "medium", slug: "3sum", title: "3Sum", difficulty: "Medium", topicSlugs: ["array", "two-pointers"], topicNames: ["Array", "Two Pointers"] }),
  pick({ role: "stretch", slug: "n-queens", title: "N-Queens", difficulty: "Hard", topicSlugs: ["backtracking"], topicNames: ["Backtracking"] }),
];

function outcome(overrides: Partial<MockInterviewProblemOutcome> = {}): MockInterviewProblemOutcome {
  return { slug: "two-sum", outcome: "Solved", timeTakenMinutes: 5, usedHints: false, ...overrides };
}

describe("buildPerformanceReport", () => {
  it('reports "Strong Session" for 3 clean solves with no hints', () => {
    const report = buildPerformanceReport(PROBLEMS, [
      outcome({ slug: "two-sum", outcome: "Solved", timeTakenMinutes: 8, usedHints: false }),
      outcome({ slug: "3sum", outcome: "Solved", timeTakenMinutes: 15, usedHints: false }),
      outcome({ slug: "n-queens", outcome: "Solved", timeTakenMinutes: 25, usedHints: false }),
    ]);
    expect(report.summary).toBe("Strong Session");
    expect(report.solvedCount).toBe(3);
    expect(report.strengthsShown.map((t) => t.topicSlug).sort()).toEqual(["array", "backtracking", "two-pointers"]);
    expect(report.areasToRevisit).toHaveLength(0);
  });

  it('reports "Strong Session" downgraded to "Solid Session" when a solve used hints', () => {
    const report = buildPerformanceReport(PROBLEMS, [
      outcome({ slug: "two-sum", outcome: "Solved", usedHints: false }),
      outcome({ slug: "3sum", outcome: "Solved", usedHints: false }),
      outcome({ slug: "n-queens", outcome: "Solved", usedHints: true }),
    ]);
    expect(report.summary).toBe("Solid Session"); // 3 solved but hints used on one -> not "Strong"
    expect(report.areasToRevisit.map((t) => t.topicSlug)).toEqual(["backtracking"]);
  });

  it('reports "Tough Session" when nothing is solved and treats a missing outcome as Skipped', () => {
    const report = buildPerformanceReport(PROBLEMS, [outcome({ slug: "two-sum", outcome: "Attempted", timeTakenMinutes: 10 })]);
    expect(report.summary).toBe("Tough Session");
    expect(report.solvedCount).toBe(0);
    expect(report.attemptedCount).toBe(1);
    // 3sum and n-queens got no outcome at all -> should default to Skipped, not crash.
    const threeSum = report.problems.find((p) => p.slug === "3sum");
    expect(threeSum?.outcome).toBe("Skipped");
  });

  it("computes withinSuggestedTime only for solved problems with a reported time", () => {
    const report = buildPerformanceReport(PROBLEMS, [
      outcome({ slug: "two-sum", outcome: "Solved", timeTakenMinutes: 25 }), // warmup budget is 10 min -> over
      outcome({ slug: "3sum", outcome: "Solved", timeTakenMinutes: null }), // solved but no time given
      outcome({ slug: "n-queens", outcome: "Attempted", timeTakenMinutes: 20 }), // not solved at all
    ]);
    expect(report.problems.find((p) => p.slug === "two-sum")?.withinSuggestedTime).toBe(false);
    expect(report.problems.find((p) => p.slug === "3sum")?.withinSuggestedTime).toBeNull();
    expect(report.problems.find((p) => p.slug === "n-queens")?.withinSuggestedTime).toBeNull();
  });

  it("always includes the fixed non-guarantee disclaimer", () => {
    const report = buildPerformanceReport(PROBLEMS, []);
    expect(report.disclaimer).toMatch(/doesn't guarantee/);
  });
});
