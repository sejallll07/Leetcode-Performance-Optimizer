import { describe, expect, it } from "vitest";
import { buildMonthlyReportInsights, buildWeeklyReportInsights, type MonthlyReportInput, type RevisionHistoryEntry, type WeeklyReportInput } from "@/lib/reports/report-builder";
import { computePeriodBounds } from "@/lib/reports/period";
import type { MasteryResult, RawMasteryResult, SubmissionInput } from "@/lib/analytics/types";
import type { RoadmapResult, RoadmapTopic } from "@/lib/roadmap/types";

const WEEK = computePeriodBounds("WEEKLY", new Date("2026-09-30T12:00:00Z"), 0);
const MONTH = computePeriodBounds("MONTHLY", new Date("2026-09-30T12:00:00Z"), 0);

function raw(overrides: Partial<RawMasteryResult> = {}): RawMasteryResult {
  return {
    topicSlug: "array",
    topicName: "Array",
    masteryScore: 50,
    confidence: "Medium",
    classification: "Weak",
    subScores: { exposure: 0.5, difficulty: 0.5, recency: 0.5, diversity: 0.5 },
    explanation: "fixture",
    ...overrides,
  };
}

function mastery(overrides: Partial<MasteryResult> = {}): MasteryResult {
  return {
    ...raw(),
    gapVerdict: "genuinely-weak",
    gapExplanation: "fixture",
    weakPrerequisites: [],
    ...overrides,
  };
}

function submission(overrides: Partial<SubmissionInput> = {}): SubmissionInput {
  return {
    topicSlugs: ["array"],
    topicNames: { array: "Array" },
    problemSlug: "two-sum",
    problemTitle: "Two Sum",
    difficulty: "Easy",
    submittedAt: new Date("2026-09-29T10:00:00Z"),
    ...overrides,
  };
}

function revision(overrides: Partial<RevisionHistoryEntry> = {}): RevisionHistoryEntry {
  return {
    topicSlug: "array",
    topicName: "Array",
    problemSlug: "two-sum",
    problemTitle: "Two Sum",
    feedback: "Easy",
    reviewedAt: new Date("2026-09-29T10:00:00Z"),
    ...overrides,
  };
}

function roadmapFixture(topics: Pick<RoadmapTopic, "topicSlug" | "topicName" | "status">[]): RoadmapResult {
  const fullTopics: RoadmapTopic[] = topics.map((t) => ({
    topicSlug: t.topicSlug,
    topicName: t.topicName,
    tier: 0,
    status: t.status,
    masteryScore: null,
    confidence: "None",
    prerequisites: [],
    recommendedAction: "Practice",
    actionReason: "fixture",
    isPrerequisiteGap: false,
  }));
  return {
    topics: fullTopics,
    tiers: [],
    groups: { strong: [], revisionNeeded: [], weak: [], fundamentalGaps: [], prerequisiteTopics: [], recommendedNext: [], postponed: [] },
    recommendedNextTopic: null,
    generatedAt: new Date("2026-09-30T00:00:00Z"),
  };
}

function weeklyInput(overrides: Partial<WeeklyReportInput> = {}): WeeklyReportInput {
  return {
    period: WEEK,
    submissionsInRange: [],
    revisionHistoryInRange: [],
    masteryBeforeStart: [],
    masteryAtEnd: [],
    forwardLookingGapsAtEnd: [],
    liveOverdueCount: null,
    ...overrides,
  };
}

describe("buildWeeklyReportInsights", () => {
  it("counts distinct problems and their difficulty split", () => {
    const insights = buildWeeklyReportInsights(
      weeklyInput({
        submissionsInRange: [
          submission({ problemSlug: "two-sum", difficulty: "Easy" }),
          submission({ problemSlug: "two-sum", difficulty: "Easy" }), // duplicate submission, same problem
          submission({ problemSlug: "3sum", problemTitle: "3Sum", difficulty: "Medium", topicSlugs: ["two-pointers"], topicNames: { "two-pointers": "Two Pointers" } }),
        ],
      })
    );
    expect(insights.problemsSolved.total).toBe(2); // deduped by problem slug
    expect(insights.problemsSolved.byDifficulty).toEqual([
      { difficulty: "Easy", count: 1 },
      { difficulty: "Medium", count: 1 },
    ]);
  });

  it("computes strongestImprovement only when a topic has both a before and after score", () => {
    const insights = buildWeeklyReportInsights(
      weeklyInput({
        masteryBeforeStart: [raw({ topicSlug: "array", masteryScore: 40 })],
        masteryAtEnd: [mastery({ topicSlug: "array", masteryScore: 65 }), mastery({ topicSlug: "graph", topicName: "Graph", masteryScore: 30 })],
      })
    );
    expect(insights.strongestImprovement).toMatchObject({ topicSlug: "array", delta: 25, fromScore: 40, toScore: 65 });
  });

  it("returns null strongestImprovement when no topic has a comparable before/after pair", () => {
    const insights = buildWeeklyReportInsights(
      weeklyInput({
        masteryBeforeStart: [],
        masteryAtEnd: [mastery({ topicSlug: "array", masteryScore: 65 })],
      })
    );
    expect(insights.strongestImprovement).toBeNull();
  });

  it("picks the lowest-scoring evidenced topic as weakestArea, excluding Under-Practiced", () => {
    const insights = buildWeeklyReportInsights(
      weeklyInput({
        masteryAtEnd: [
          mastery({ topicSlug: "array", masteryScore: 10, classification: "Under-Practiced" }),
          mastery({ topicSlug: "graph", topicName: "Graph", masteryScore: 20, classification: "Weak" }),
          mastery({ topicSlug: "tree", topicName: "Tree", masteryScore: 80, classification: "Strong" }),
        ],
      })
    );
    expect(insights.weakestArea?.topicSlug).toBe("graph");
  });

  it("flags a weak/fundamental-gap/revision-needed topic as neglected only if not practiced this week", () => {
    const insights = buildWeeklyReportInsights(
      weeklyInput({
        submissionsInRange: [submission({ topicSlugs: ["array"], topicNames: { array: "Array" } })],
        masteryAtEnd: [
          mastery({ topicSlug: "array", classification: "Weak" }), // practiced this week -> not neglected
          mastery({ topicSlug: "graph", topicName: "Graph", classification: "Fundamental Gap" }), // not practiced -> neglected
          mastery({ topicSlug: "tree", topicName: "Tree", classification: "Strong" }), // not weak -> never neglected
        ],
      })
    );
    expect(insights.neglectedTopics.map((t) => t.topicSlug)).toEqual(["graph"]);
  });

  it("surfaces a Difficult revision and a mastery decline as important mistakes", () => {
    const insights = buildWeeklyReportInsights(
      weeklyInput({
        revisionHistoryInRange: [revision({ feedback: "Difficult" }), revision({ problemSlug: "climbing-stairs", problemTitle: "Climbing Stairs", feedback: "Easy" })],
        masteryBeforeStart: [raw({ topicSlug: "graph", topicName: "Graph", masteryScore: 60 })],
        masteryAtEnd: [mastery({ topicSlug: "graph", topicName: "Graph", masteryScore: 45 })],
      })
    );
    const kinds = insights.importantMistakes.map((m) => m.kind);
    expect(kinds).toContain("difficult-revision");
    expect(kinds).toContain("mastery-decline");
    expect(insights.importantMistakes).toHaveLength(2); // the Easy-feedback revision shouldn't show up
  });

  it("reports currentlyOverdueCount as whatever was passed in, including null for a completed week", () => {
    const withCount = buildWeeklyReportInsights(weeklyInput({ liveOverdueCount: 3 }));
    expect(withCount.revisionPerformance.currentlyOverdueCount).toBe(3);
    const withoutCount = buildWeeklyReportInsights(weeklyInput({ liveOverdueCount: null }));
    expect(withoutCount.revisionPerformance.currentlyOverdueCount).toBeNull();
  });
});

function monthlyInput(overrides: Partial<MonthlyReportInput> = {}): MonthlyReportInput {
  return {
    period: MONTH,
    totalSolvedEnd: 100,
    submissionsInRange: [],
    revisionHistoryInRange: [],
    masteryAtStart: [],
    masteryAtEnd: [],
    roadmapAtStart: roadmapFixture([]),
    roadmapAtEnd: roadmapFixture([]),
    readinessAtStart: null,
    readinessAtEnd: { score: 50, level: "Building Fundamentals", evidencedTopicCount: 1, averageMasteryOfEvidenced: 50, breadthRatio: 0.5, explanation: "fixture" },
    liveOverdueCount: null,
    previousMonthlyPersistentWeaknesses: [],
    ...overrides,
  };
}

describe("buildMonthlyReportInsights", () => {
  it("derives totalSolvedStart from totalSolvedEnd minus problems solved this month", () => {
    const insights = buildMonthlyReportInsights(
      monthlyInput({ totalSolvedEnd: 100, submissionsInRange: [submission({ problemSlug: "a" }), submission({ problemSlug: "b" })] })
    );
    expect(insights.overallProgress.problemsSolvedThisMonth).toBe(2);
    expect(insights.overallProgress.totalSolvedStart).toBe(98);
  });

  it("classifies topic deltas as improvements/declines only past the significant-delta threshold", () => {
    const insights = buildMonthlyReportInsights(
      monthlyInput({
        masteryAtStart: [mastery({ topicSlug: "array", masteryScore: 50 }), mastery({ topicSlug: "graph", topicName: "Graph", masteryScore: 50 }), mastery({ topicSlug: "tree", topicName: "Tree", masteryScore: 50 })],
        masteryAtEnd: [
          mastery({ topicSlug: "array", masteryScore: 53 }), // +3, below threshold
          mastery({ topicSlug: "graph", topicName: "Graph", masteryScore: 60 }), // +10, improvement
          mastery({ topicSlug: "tree", topicName: "Tree", masteryScore: 40 }), // -10, decline
        ],
      })
    );
    expect(insights.topicImprovements.map((d) => d.topicSlug)).toEqual(["graph"]);
    expect(insights.decliningTopics.map((d) => d.topicSlug)).toEqual(["tree"]);
    expect(insights.masteryChanges).toHaveLength(3);
  });

  it("flags newlyDevelopedStrengths only for topics that weren't already Strong at the start", () => {
    const insights = buildMonthlyReportInsights(
      monthlyInput({
        masteryAtStart: [mastery({ topicSlug: "array", classification: "Weak" }), mastery({ topicSlug: "graph", topicName: "Graph", classification: "Strong" })],
        masteryAtEnd: [mastery({ topicSlug: "array", classification: "Strong" }), mastery({ topicSlug: "graph", topicName: "Graph", classification: "Strong" })],
      })
    );
    expect(insights.newlyDevelopedStrengths.map((t) => t.topicSlug)).toEqual(["array"]);
  });

  it("increments the persistent-weakness streak from the previous report and starts at 1 with no prior streak", () => {
    const insights = buildMonthlyReportInsights(
      monthlyInput({
        masteryAtStart: [mastery({ topicSlug: "graph", topicName: "Graph", classification: "Weak" }), mastery({ topicSlug: "dp", topicName: "DP", classification: "Weak" })],
        masteryAtEnd: [mastery({ topicSlug: "graph", topicName: "Graph", classification: "Fundamental Gap" }), mastery({ topicSlug: "dp", topicName: "DP", classification: "Weak" })],
        previousMonthlyPersistentWeaknesses: [{ topicSlug: "graph", monthsPersistent: 2 }],
      })
    );
    const graph = insights.persistentWeaknesses.find((w) => w.topicSlug === "graph");
    const dp = insights.persistentWeaknesses.find((w) => w.topicSlug === "dp");
    expect(graph?.monthsPersistent).toBe(3);
    expect(dp?.monthsPersistent).toBe(1);
  });

  it("excludes a topic that was only weak at one end of the window from persistentWeaknesses", () => {
    const insights = buildMonthlyReportInsights(
      monthlyInput({
        masteryAtStart: [mastery({ topicSlug: "array", classification: "Strong" })],
        masteryAtEnd: [mastery({ topicSlug: "array", classification: "Weak" })],
      })
    );
    expect(insights.persistentWeaknesses).toHaveLength(0);
  });

  it("diffs roadmap group membership between start and end", () => {
    const insights = buildMonthlyReportInsights(
      monthlyInput({
        roadmapAtStart: roadmapFixture([{ topicSlug: "array", topicName: "Array", status: "Weak" }]),
        roadmapAtEnd: roadmapFixture([{ topicSlug: "array", topicName: "Array", status: "Revision Needed" }]),
      })
    );
    expect(insights.roadmapChanges).toEqual([{ topicSlug: "array", topicName: "Array", fromGroup: "Weak", toGroup: "Revision Needed" }]);
  });

  it("reports a null readiness/interview-readiness start when there's no prior history", () => {
    const insights = buildMonthlyReportInsights(monthlyInput({ readinessAtStart: null }));
    expect(insights.overallProgress.readinessScoreStart).toBeNull();
    expect(insights.interviewReadinessTrend.scoreStart).toBeNull();
    expect(insights.interviewReadinessTrend.delta).toBeNull();
  });
});
