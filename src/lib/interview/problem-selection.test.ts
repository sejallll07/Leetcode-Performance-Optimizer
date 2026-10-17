import { describe, expect, it } from "vitest";
import { selectMockInterviewProblems } from "@/lib/interview/problem-selection";
import type { MasteryResult, ProblemCatalogEntry } from "@/lib/analytics/types";
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

function catalogEntry(overrides: Partial<ProblemCatalogEntry> = {}): ProblemCatalogEntry {
  return { slug: "fixture-problem", title: "Fixture Problem", difficulty: "Easy", topicSlugs: ["array"], interviewRelevance: "medium", ...overrides };
}

const CATALOG: ProblemCatalogEntry[] = [
  catalogEntry({ slug: "array-easy-1", title: "Array Easy 1", difficulty: "Easy", topicSlugs: ["array"], interviewRelevance: "high" }),
  catalogEntry({ slug: "array-easy-2", title: "Array Easy 2", difficulty: "Easy", topicSlugs: ["array"] }),
  catalogEntry({ slug: "array-medium-1", title: "Array Medium 1", difficulty: "Medium", topicSlugs: ["array"] }),
  catalogEntry({ slug: "graph-weak-medium", title: "Graph Medium", difficulty: "Medium", topicSlugs: ["graph"] }),
  catalogEntry({ slug: "graph-weak-hard", title: "Graph Hard", difficulty: "Hard", topicSlugs: ["graph"] }),
  catalogEntry({ slug: "dp-easy", title: "DP Easy", difficulty: "Easy", topicSlugs: ["dp"] }),
];

function input(overrides: Partial<InterviewProfileInput> = {}): InterviewProfileInput {
  return {
    mastery: [],
    topics: [],
    forwardLookingGaps: [],
    catalog: CATALOG,
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

describe("selectMockInterviewProblems", () => {
  it("always returns exactly 3 picks in warmup/medium/stretch order", () => {
    const picks = selectMockInterviewProblems(input({ mastery: [mastery({ classification: "Strong" })] }));
    expect(picks.map((p) => p.role)).toEqual(["warmup", "medium", "stretch"]);
    expect(picks.every((p) => p.difficulty)).toBe(true);
  });

  it("picks the warm-up as Easy from a Strong or Revision Needed topic", () => {
    const picks = selectMockInterviewProblems(
      input({ mastery: [mastery({ topicSlug: "array", classification: "Strong" }), mastery({ topicSlug: "dp", topicName: "DP", classification: "Weak" })] })
    );
    expect(picks[0].difficulty).toBe("Easy");
    expect(picks[0].topicSlugs).toContain("array"); // Strong topic preferred over dp's Weak
  });

  it("excludes already-solved problems from the top preference stage", () => {
    const picks = selectMockInterviewProblems(
      input({
        mastery: [mastery({ topicSlug: "array", classification: "Strong" })],
        solvedSlugs: new Set(["array-easy-1"]),
      })
    );
    expect(picks[0].slug).not.toBe("array-easy-1");
    expect(picks[0].slug).toBe("array-easy-2");
  });

  it("never returns fewer than 3 picks even with almost no mastery data", () => {
    const picks = selectMockInterviewProblems(input({ mastery: [] }));
    expect(picks).toHaveLength(3);
  });

  it("picks the stretch problem as Hard when the profile is strong enough, Medium otherwise", () => {
    const strongProfile = Array.from({ length: 5 }, (_, i) => mastery({ topicSlug: `s${i}`, topicName: `S${i}`, classification: i < 2 ? "Strong" : "Revision Needed" })).concat([
      mastery({ topicSlug: "graph", topicName: "Graph", classification: "Weak" }),
    ]);
    const strongPicks = selectMockInterviewProblems(input({ mastery: strongProfile }));
    expect(strongPicks[2].difficulty).toBe("Hard");

    const weakProfile = [mastery({ topicSlug: "graph", topicName: "Graph", classification: "Weak" })];
    const weakPicks = selectMockInterviewProblems(input({ mastery: weakProfile }));
    expect(weakPicks[2].difficulty).toBe("Medium");
  });

  it("never picks the same slug twice across the 3 problems", () => {
    // A deliberately narrow catalog to stress the no-duplicate guarantee.
    const narrowCatalog: ProblemCatalogEntry[] = [
      catalogEntry({ slug: "only-easy", difficulty: "Easy", topicSlugs: ["array"] }),
      catalogEntry({ slug: "only-medium", difficulty: "Medium", topicSlugs: ["array"] }),
      catalogEntry({ slug: "only-hard", difficulty: "Hard", topicSlugs: ["array"] }),
    ];
    const picks = selectMockInterviewProblems(input({ catalog: narrowCatalog, mastery: [mastery({ classification: "Strong" })] }));
    const slugs = picks.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(3);
  });
});
