import { describe, expect, it } from "vitest";
import { computeRecommendations, type RecommendationInput } from "@/lib/analytics/recommendation-engine";
import type {
  MasteryResult,
  ProblemCatalogEntry,
  SkillGraphEdge,
  SubmissionInput,
  TopicAnalytics,
} from "@/lib/analytics/types";

function mastery(overrides: Partial<MasteryResult> = {}): MasteryResult {
  return {
    topicSlug: "array",
    topicName: "Array",
    masteryScore: 50,
    confidence: "Medium",
    classification: "Weak",
    subScores: { exposure: 0.5, difficulty: 0.5, recency: 0.5, diversity: 0.5 },
    explanation: "fixture explanation",
    gapVerdict: "genuinely-weak",
    gapExplanation: "fixture gap explanation",
    weakPrerequisites: [],
    ...overrides,
  };
}

function topicAnalytics(overrides: Partial<TopicAnalytics> = {}): TopicAnalytics {
  return {
    topicSlug: "array",
    topicName: "Array",
    problemCount: 2,
    difficultyDistribution: [
      { difficulty: "Easy", count: 2 },
      { difficulty: "Medium", count: 0 },
      { difficulty: "Hard", count: 0 },
    ],
    lastPracticedAt: new Date(),
    daysSinceLastPracticed: 5,
    diversityCount: 1,
    difficultyTrend: "steady",
    ...overrides,
  };
}

function catalogEntry(overrides: Partial<ProblemCatalogEntry> = {}): ProblemCatalogEntry {
  return {
    slug: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    topicSlugs: ["array"],
    ...overrides,
  };
}

function baseInput(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    mastery: [],
    topics: [],
    forwardLookingGaps: [],
    topicRelationships: [],
    submissions: [],
    catalog: [],
    ...overrides,
  };
}

describe("computeRecommendations — selection and reasons", () => {
  it("never recommends a problem the student already solved", () => {
    const solved: SubmissionInput = {
      topicSlugs: ["array"],
      topicNames: { array: "Array" },
      problemSlug: "two-sum",
      problemTitle: "Two Sum",
      difficulty: "Easy",
      submittedAt: new Date(),
    };
    const result = computeRecommendations(
      baseInput({
        mastery: [mastery({ classification: "Weak" })],
        topics: [topicAnalytics()],
        submissions: [solved],
        catalog: [catalogEntry({ slug: "two-sum" })], // only candidate is already solved
      })
    );
    expect(result.all.find((r) => r.problemSlug === "two-sum")).toBeUndefined();
  });

  it("every recommendation has a non-empty reason", () => {
    const result = computeRecommendations(
      baseInput({
        mastery: [mastery({ classification: "Fundamental Gap" })],
        topics: [topicAnalytics()],
        catalog: [catalogEntry()],
      })
    );
    expect(result.all.length).toBeGreaterThan(0);
    for (const rec of result.all) {
      expect(rec.reason.length).toBeGreaterThan(10);
    }
  });

  it("uses the example-style phrasing for a stretch recommendation on a strong topic missing a subtopic", () => {
    const edges: SkillGraphEdge[] = [
      {
        topicSlug: "binary-search-on-answer",
        topicName: "Binary Search on Answer",
        prerequisiteSlug: "binary-search",
        prerequisiteName: "Binary Search",
        relationshipType: "SUBTOPIC",
        strength: 0.9,
      },
    ];
    const result = computeRecommendations(
      baseInput({
        mastery: [mastery({ topicSlug: "binary-search", topicName: "Binary Search", classification: "Strong", masteryScore: 90 })],
        topics: [topicAnalytics({ topicSlug: "binary-search", topicName: "Binary Search" })],
        topicRelationships: edges,
        catalog: [
          catalogEntry({
            slug: "koko-eating-bananas",
            title: "Koko Eating Bananas",
            difficulty: "Medium",
            topicSlugs: ["binary-search-on-answer"],
          }),
        ],
      })
    );
    const stretch = result.all.find((r) => r.kind === "stretch" && r.topicSlug === "binary-search-on-answer");
    expect(stretch).toBeDefined();
    expect(stretch?.reason).toContain("strong basic Binary Search skills");
    expect(stretch?.reason).toContain("limited practice with Binary Search on Answer");
  });

  it("does not offer a subtopic stretch when the subtopic already has real evidence", () => {
    const edges: SkillGraphEdge[] = [
      {
        topicSlug: "binary-search-on-answer",
        topicName: "Binary Search on Answer",
        prerequisiteSlug: "binary-search",
        prerequisiteName: "Binary Search",
        relationshipType: "SUBTOPIC",
        strength: 0.9,
      },
    ];
    const result = computeRecommendations(
      baseInput({
        mastery: [
          mastery({ topicSlug: "binary-search", topicName: "Binary Search", classification: "Strong" }),
          mastery({ topicSlug: "binary-search-on-answer", topicName: "Binary Search on Answer", classification: "Emerging" }),
        ],
        topics: [
          topicAnalytics({ topicSlug: "binary-search" }),
          topicAnalytics({
            topicSlug: "binary-search-on-answer",
            difficultyDistribution: [
              { difficulty: "Easy", count: 0 },
              { difficulty: "Medium", count: 1 },
              { difficulty: "Hard", count: 1 },
            ],
          }),
        ],
        topicRelationships: edges,
        catalog: [catalogEntry({ slug: "koko", title: "Koko", topicSlugs: ["binary-search-on-answer"] })],
      })
    );
    expect(result.all.find((r) => r.kind === "stretch")).toBeUndefined();
  });

  it("regression: recommends nothing for a topic rather than falling back to a too-hard problem", () => {
    // Caught by the integration test: when a Weak topic's only
    // unsolved catalog entry is Hard, pickCandidate used to fall
    // back to "any difficulty" and hand it back anyway, defeating
    // the "never Hard for a shaky topic" rule entirely.
    const result = computeRecommendations(
      baseInput({
        mastery: [mastery({ classification: "Weak" })],
        topics: [topicAnalytics()],
        catalog: [catalogEntry({ slug: "only-hard-one", difficulty: "Hard" })],
      })
    );
    expect(result.all.find((r) => r.topicSlug === "array")).toBeUndefined();
  });

  it("never recommends Hard difficulty for a Weak or Fundamental Gap topic", () => {
    const result = computeRecommendations(
      baseInput({
        mastery: [mastery({ classification: "Fundamental Gap" })],
        topics: [topicAnalytics()],
        catalog: [
          catalogEntry({ slug: "easy-one", difficulty: "Easy" }),
          catalogEntry({ slug: "hard-one", difficulty: "Hard" }),
        ],
      })
    );
    expect(result.all.every((r) => r.difficulty !== "Hard")).toBe(true);
  });

  it("assigns High priority to prerequisite-gap and Fundamental Gap topics", () => {
    const result = computeRecommendations(
      baseInput({
        mastery: [mastery({ classification: "Fundamental Gap", gapVerdict: "prerequisite-gap" })],
        topics: [topicAnalytics()],
        catalog: [catalogEntry()],
      })
    );
    expect(result.all[0].priority).toBe("High");
  });

  it("recommends a previously-solved problem for Revision Needed, flagged as revision", () => {
    const solved: SubmissionInput = {
      topicSlugs: ["array"],
      topicNames: { array: "Array" },
      problemSlug: "two-sum",
      problemTitle: "Two Sum",
      difficulty: "Easy",
      submittedAt: new Date(),
    };
    const result = computeRecommendations(
      baseInput({
        mastery: [mastery({ classification: "Revision Needed" })],
        topics: [topicAnalytics()],
        submissions: [solved],
      })
    );
    const revision = result.all.find((r) => r.kind === "revision");
    expect(revision).toBeDefined();
    expect(revision?.isRevision).toBe(true);
    expect(revision?.problemSlug).toBe("two-sum");
  });

  it("never recommends a forward-looking gap topic directly", () => {
    const result = computeRecommendations(
      baseInput({
        forwardLookingGaps: [
          {
            topicSlug: "tree-dp",
            topicName: "Tree DP",
            weakPrerequisites: [],
            explanation: "fixture",
          },
        ],
        catalog: [catalogEntry({ slug: "house-robber-iii", topicSlugs: ["tree-dp"] })],
      })
    );
    expect(result.all.find((r) => r.topicSlug === "tree-dp")).toBeUndefined();
  });

  it("skips Strong topics that already have Hard exposure — no stretch needed", () => {
    const result = computeRecommendations(
      baseInput({
        mastery: [mastery({ classification: "Strong" })],
        topics: [
          topicAnalytics({
            difficultyDistribution: [
              { difficulty: "Easy", count: 1 },
              { difficulty: "Medium", count: 1 },
              { difficulty: "Hard", count: 1 },
            ],
          }),
        ],
        catalog: [catalogEntry({ slug: "hard-array", difficulty: "Hard" })],
      })
    );
    expect(result.all.find((r) => r.kind === "stretch")).toBeUndefined();
  });
});

describe("computeRecommendations — limits and diversity", () => {
  it("caps the total list at the configured maximum", () => {
    const many = Array(10)
      .fill(0)
      .map((_, i) => mastery({ topicSlug: `topic-${i}`, topicName: `Topic ${i}`, classification: "Weak" }));
    const topics = many.map((m) => topicAnalytics({ topicSlug: m.topicSlug, topicName: m.topicName }));
    const catalog = many.map((m) => catalogEntry({ slug: `p-${m.topicSlug}`, title: `Problem for ${m.topicSlug}`, topicSlugs: [m.topicSlug] }));
    const result = computeRecommendations(baseInput({ mastery: many, topics, catalog }));
    expect(result.all.length).toBeLessThanOrEqual(8);
  });

  it("caps recommendations per topic for diversity", () => {
    const result = computeRecommendations(
      baseInput({
        mastery: [mastery({ classification: "Strong" })],
        topics: [topicAnalytics({ difficultyDistribution: [{ difficulty: "Easy", count: 2 }, { difficulty: "Medium", count: 0 }, { difficulty: "Hard", count: 0 }] })],
        topicRelationships: [
          {
            topicSlug: "sub-a",
            topicName: "Sub A",
            prerequisiteSlug: "array",
            prerequisiteName: "Array",
            relationshipType: "SUBTOPIC",
            strength: 0.9,
          },
          {
            topicSlug: "sub-b",
            topicName: "Sub B",
            prerequisiteSlug: "array",
            prerequisiteName: "Array",
            relationshipType: "SUBTOPIC",
            strength: 0.9,
          },
        ],
        catalog: [
          catalogEntry({ slug: "hard-array", difficulty: "Hard", topicSlugs: ["array"] }),
          catalogEntry({ slug: "sub-a-problem", topicSlugs: ["sub-a"], difficulty: "Medium" }),
          catalogEntry({ slug: "sub-b-problem", topicSlugs: ["sub-b"], difficulty: "Medium" }),
        ],
      })
    );
    const perTopic = new Map<string, number>();
    for (const r of result.all) perTopic.set(r.topicSlug, (perTopic.get(r.topicSlug) ?? 0) + 1);
    expect([...perTopic.values()].every((count) => count <= 2)).toBe(true);
  });

  it("Practice Today is smaller than or equal to the full list and never empty when recommendations exist", () => {
    const result = computeRecommendations(
      baseInput({
        mastery: [mastery({ classification: "Fundamental Gap" })],
        topics: [topicAnalytics()],
        catalog: [catalogEntry()],
      })
    );
    expect(result.practiceToday.length).toBeGreaterThan(0);
    expect(result.practiceToday.length).toBeLessThanOrEqual(result.all.length);
    expect(result.practiceToday.length).toBeLessThanOrEqual(3);
  });

  it("Practice Today balances across priorities rather than taking only the top-priority topic", () => {
    const result = computeRecommendations(
      baseInput({
        mastery: [
          mastery({ topicSlug: "a", topicName: "A", classification: "Fundamental Gap" }),
          mastery({ topicSlug: "b", topicName: "B", classification: "Weak" }),
          mastery({ topicSlug: "c", topicName: "C", classification: "Under-Practiced" }),
        ],
        topics: [
          topicAnalytics({ topicSlug: "a", topicName: "A" }),
          topicAnalytics({ topicSlug: "b", topicName: "B" }),
          topicAnalytics({ topicSlug: "c", topicName: "C" }),
        ],
        catalog: [
          catalogEntry({ slug: "pa", topicSlugs: ["a"] }),
          catalogEntry({ slug: "pb", topicSlugs: ["b"] }),
          catalogEntry({ slug: "pc", topicSlugs: ["c"] }),
        ],
      })
    );
    const priorities = new Set(result.practiceToday.map((r) => r.priority));
    expect(priorities.size).toBeGreaterThan(1);
  });

  it("returns nothing when there is no mastery data and no catalog", () => {
    const result = computeRecommendations(baseInput());
    expect(result.all).toEqual([]);
    expect(result.practiceToday).toEqual([]);
  });
});
