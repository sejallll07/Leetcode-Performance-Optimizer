import { describe, expect, it } from "vitest";
import { buildMentorContext } from "@/lib/mentor/context-builder";
import { MENTOR_CONFIG } from "@/lib/mentor/config";
import type { AnalyticsEngineResult, MasteryResult, ProgressTrend, SubmissionInput } from "@/lib/analytics/types";
import type { RevisionCenterData } from "@/lib/revision/types";
import type { RoadmapResult } from "@/lib/roadmap/types";

const NOW = new Date("2026-06-15T00:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function mastery(overrides: Partial<MasteryResult> = {}): MasteryResult {
  return {
    topicSlug: "array",
    topicName: "Array",
    masteryScore: 50,
    confidence: "Medium",
    classification: "Weak",
    subScores: { exposure: 1, difficulty: 1, recency: 1, diversity: 1 },
    explanation: "fixture explanation",
    gapVerdict: "genuinely-weak",
    gapExplanation: "fixture gap explanation",
    weakPrerequisites: [],
    ...overrides,
  };
}

function analytics(mastery_: MasteryResult[]): AnalyticsEngineResult {
  return {
    basic: {
      totalSolved: 10,
      easySolved: 5,
      mediumSolved: 3,
      hardSolved: 2,
      recentActivity: { submissionsLast7Days: 2, submissionsLast30Days: 8, mostRecentSubmissionAt: NOW, daysSinceLastSubmission: 1 },
      topicDistribution: [],
      difficultyDistribution: [],
      submissionStats: { acceptedSubmissionsSampled: 10, note: "" },
      sampleCoverage: "complete",
    },
    topics: [],
    mastery: mastery_,
    forwardLookingGaps: [],
    readiness: { score: 62, level: "Building Fundamentals", evidencedTopicCount: 5, averageMasteryOfEvidenced: 60, breadthRatio: 0.3, explanation: "readiness explanation" },
    nextActions: [],
    recommendations: { practiceToday: [], all: [] },
  };
}

function progressTrend(overrides: Partial<ProgressTrend> = {}): ProgressTrend {
  return {
    status: "steady",
    averageDelta: 0,
    topicsImproved: 0,
    topicsDeclined: 0,
    comparedTopicCount: 0,
    previousComputedAt: null,
    latestComputedAt: NOW,
    explanation: "trend explanation",
    ...overrides,
  };
}

function revisionData(overrides: Partial<RevisionCenterData> = {}): RevisionCenterData {
  return {
    overdue: { items: [], totalCount: 0 },
    dueToday: { items: [], totalCount: 0 },
    upcoming: { items: [], totalCount: 0 },
    recentlyCompleted: { items: [], totalCount: 0 },
    ...overrides,
  };
}

function roadmap(overrides: Partial<RoadmapResult> = {}): RoadmapResult {
  return {
    topics: [],
    tiers: [],
    groups: { strong: [], revisionNeeded: [], weak: [], fundamentalGaps: [], prerequisiteTopics: [], recommendedNext: [], postponed: [] },
    recommendedNextTopic: null,
    generatedAt: NOW,
    ...overrides,
  };
}

describe("buildMentorContext", () => {
  it("returns hasProfile:false without touching any of the other data", () => {
    const result = buildMentorContext({ studentName: "Sam", hasProfile: false });
    expect(result).toEqual({ hasProfile: false, studentName: "Sam" });
  });

  it("separates topics into strong/weak/fundamental-gap/revision-needed by classification", () => {
    const result = buildMentorContext({
      studentName: "Sam",
      hasProfile: true,
      analytics: analytics([
        mastery({ topicSlug: "array", classification: "Strong", masteryScore: 90 }),
        mastery({ topicSlug: "recursion", classification: "Weak", masteryScore: 30 }),
        mastery({ topicSlug: "dp", classification: "Fundamental Gap", masteryScore: 10 }),
        mastery({ topicSlug: "graph", classification: "Revision Needed", masteryScore: 65 }),
        mastery({ topicSlug: "trie", classification: "Under-Practiced", masteryScore: 40 }),
      ]),
      progressTrend: progressTrend(),
      revisionData: revisionData(),
      roadmap: roadmap(),
      submissions: [],
      now: NOW,
    });
    if (!result.hasProfile) throw new Error("expected hasProfile true");
    expect(result.strongTopics.map((t) => t.topicSlug)).toEqual(["array"]);
    expect(result.weakTopics.map((t) => t.topicSlug)).toEqual(["recursion"]);
    expect(result.fundamentalGaps.map((t) => t.topicSlug)).toEqual(["dp"]);
    expect(result.revisionNeededTopics.map((t) => t.topicSlug)).toEqual(["graph"]);
    // Under-Practiced isn't one of the 4 buckets above — confirm it's simply absent from all of them.
    const allBucketed = [...result.strongTopics, ...result.weakTopics, ...result.fundamentalGaps, ...result.revisionNeededTopics];
    expect(allBucketed.some((t) => t.topicSlug === "trie")).toBe(false);
  });

  it("sorts weak/fundamental-gap topics weakest-first and strong topics strongest-first", () => {
    const result = buildMentorContext({
      studentName: "Sam",
      hasProfile: true,
      analytics: analytics([
        mastery({ topicSlug: "a", classification: "Weak", masteryScore: 40 }),
        mastery({ topicSlug: "b", classification: "Weak", masteryScore: 10 }),
        mastery({ topicSlug: "c", classification: "Strong", masteryScore: 80 }),
        mastery({ topicSlug: "d", classification: "Strong", masteryScore: 95 }),
      ]),
      progressTrend: progressTrend(),
      revisionData: revisionData(),
      roadmap: roadmap(),
      submissions: [],
      now: NOW,
    });
    if (!result.hasProfile) throw new Error("expected hasProfile true");
    expect(result.weakTopics.map((t) => t.topicSlug)).toEqual(["b", "a"]); // weakest first
    expect(result.strongTopics.map((t) => t.topicSlug)).toEqual(["d", "c"]); // strongest first
  });

  it("caps each topic bucket at its configured limit", () => {
    const manyWeak = Array.from({ length: MENTOR_CONFIG.maxWeakTopicsShown + 4 }, (_, i) =>
      mastery({ topicSlug: `weak-${i}`, classification: "Weak", masteryScore: i })
    );
    const result = buildMentorContext({
      studentName: "Sam",
      hasProfile: true,
      analytics: analytics(manyWeak),
      progressTrend: progressTrend(),
      revisionData: revisionData(),
      roadmap: roadmap(),
      submissions: [],
      now: NOW,
    });
    if (!result.hasProfile) throw new Error("expected hasProfile true");
    expect(result.weakTopics).toHaveLength(MENTOR_CONFIG.maxWeakTopicsShown);
  });

  it("prefers the prerequisite-gap explanation over the plain mastery explanation when the gap is prerequisite-driven", () => {
    const result = buildMentorContext({
      studentName: "Sam",
      hasProfile: true,
      analytics: analytics([
        mastery({
          topicSlug: "backtracking",
          classification: "Weak",
          explanation: "plain mastery explanation",
          gapVerdict: "prerequisite-gap",
          gapExplanation: "root-cause explanation naming Recursion",
        }),
      ]),
      progressTrend: progressTrend(),
      revisionData: revisionData(),
      roadmap: roadmap(),
      submissions: [],
      now: NOW,
    });
    if (!result.hasProfile) throw new Error("expected hasProfile true");
    expect(result.weakTopics[0].explanation).toBe("root-cause explanation naming Recursion");
  });

  it("carries readiness and recentActivity through from the source data untouched", () => {
    const result = buildMentorContext({
      studentName: "Sam",
      hasProfile: true,
      analytics: analytics([]),
      progressTrend: progressTrend({ status: "declining", averageDelta: -4, topicsDeclined: 3, explanation: "you slipped on 3 topics" }),
      revisionData: revisionData(),
      roadmap: roadmap(),
      submissions: [],
      now: NOW,
    });
    if (!result.hasProfile) throw new Error("expected hasProfile true");
    expect(result.readiness).toEqual({ score: 62, level: "Building Fundamentals", explanation: "readiness explanation" });
    expect(result.recentActivity.status).toBe("declining");
    expect(result.recentActivity.explanation).toBe("you slipped on 3 topics");
    expect(result.recentActivity.daysSinceLastSubmission).toBe(1);
  });

  it("summarizes revision-due counts and a small sample, not the whole backlog", () => {
    const overdueItem = (id: string) => ({
      id, problemSlug: id, problemTitle: id, difficulty: "Easy" as const, topicSlug: "array", topicName: "Array",
      intervalIndex: 0, dueAt: NOW, lastReviewedAt: null, lastFeedback: null, reviewCount: 0,
    });
    const result = buildMentorContext({
      studentName: "Sam",
      hasProfile: true,
      analytics: analytics([]),
      progressTrend: progressTrend(),
      revisionData: revisionData({
        overdue: { items: [overdueItem("p1"), overdueItem("p2")], totalCount: 12 },
        dueToday: { items: [], totalCount: 3 },
      }),
      roadmap: roadmap(),
      submissions: [],
      now: NOW,
    });
    if (!result.hasProfile) throw new Error("expected hasProfile true");
    expect(result.revisionDue.overdueCount).toBe(12);
    expect(result.revisionDue.dueTodayCount).toBe(3);
    expect(result.revisionDue.sample).toHaveLength(2);
  });

  it("carries the roadmap's recommended-next pick through, or null when there isn't one", () => {
    const withPick = buildMentorContext({
      studentName: "Sam",
      hasProfile: true,
      analytics: analytics([]),
      progressTrend: progressTrend(),
      revisionData: revisionData(),
      roadmap: roadmap({
        recommendedNextTopic: {
          topicSlug: "stack", topicName: "Stack", tier: 0, status: "Recommended Next", masteryScore: null,
          confidence: "None", prerequisites: [], recommendedAction: "Start here", actionReason: "no prerequisite concerns", isPrerequisiteGap: false,
        },
        groups: { strong: [], revisionNeeded: [], weak: [], fundamentalGaps: [], prerequisiteTopics: [], recommendedNext: [{} as never, {} as never], postponed: [{} as never] },
      }),
      submissions: [],
      now: NOW,
    });
    if (!withPick.hasProfile) throw new Error("expected hasProfile true");
    expect(withPick.roadmap.recommendedNextTopic).toEqual({ topicName: "Stack", reason: "no prerequisite concerns" });
    expect(withPick.roadmap.recommendedNextCount).toBe(2);
    expect(withPick.roadmap.postponedCount).toBe(1);

    const withoutPick = buildMentorContext({
      studentName: "Sam",
      hasProfile: true,
      analytics: analytics([]),
      progressTrend: progressTrend(),
      revisionData: revisionData(),
      roadmap: roadmap(),
      submissions: [],
      now: NOW,
    });
    if (!withoutPick.hasProfile) throw new Error("expected hasProfile true");
    expect(withoutPick.roadmap.recommendedNextTopic).toBeNull();
  });

  it("orders relevant history most-recent-first and computes daysAgo relative to now", () => {
    const submission = (overrides: Partial<SubmissionInput>): SubmissionInput => ({
      topicSlugs: ["array"],
      topicNames: { array: "Array" },
      problemSlug: "x",
      problemTitle: "X",
      difficulty: "Easy",
      submittedAt: NOW,
      ...overrides,
    });
    const result = buildMentorContext({
      studentName: "Sam",
      hasProfile: true,
      analytics: analytics([]),
      progressTrend: progressTrend(),
      revisionData: revisionData(),
      roadmap: roadmap(),
      submissions: [
        submission({ problemTitle: "Older", submittedAt: new Date(NOW.getTime() - 10 * DAY_MS) }),
        submission({ problemTitle: "Newer", submittedAt: new Date(NOW.getTime() - 1 * DAY_MS) }),
      ],
      now: NOW,
    });
    if (!result.hasProfile) throw new Error("expected hasProfile true");
    expect(result.relevantHistory.map((h) => h.problemTitle)).toEqual(["Newer", "Older"]);
    expect(result.relevantHistory[0].daysAgo).toBe(1);
    expect(result.relevantHistory[1].daysAgo).toBe(10);
  });

  it("caps relevant history at its configured limit", () => {
    const submission = (i: number): SubmissionInput => ({
      topicSlugs: ["array"],
      topicNames: { array: "Array" },
      problemSlug: `p${i}`,
      problemTitle: `P${i}`,
      difficulty: "Easy",
      submittedAt: new Date(NOW.getTime() - i * DAY_MS),
    });
    const many = Array.from({ length: MENTOR_CONFIG.maxHistoryEntriesShown + 5 }, (_, i) => submission(i));
    const result = buildMentorContext({
      studentName: "Sam",
      hasProfile: true,
      analytics: analytics([]),
      progressTrend: progressTrend(),
      revisionData: revisionData(),
      roadmap: roadmap(),
      submissions: many,
      now: NOW,
    });
    if (!result.hasProfile) throw new Error("expected hasProfile true");
    expect(result.relevantHistory).toHaveLength(MENTOR_CONFIG.maxHistoryEntriesShown);
  });
});
