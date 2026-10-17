import { describe, expect, it } from "vitest";
import type { ProblemCatalogEntry, Recommendation } from "@/lib/analytics/types";
import { PROBLEM_CATALOG } from "@/lib/analytics/problem-catalog-data";
import { SKILL_GRAPH_TOPICS } from "@/lib/analytics/skill-graph-data";
import { getNewPracticeBand, leetcodeProblemUrl, selectNewPractice } from "@/lib/roadmap/new-practice";
import { PRACTICE_POOL } from "@/lib/roadmap/practice-pool-data";
import type { RoadmapStatus, RoadmapTopic } from "@/lib/roadmap/types";

function makeTopic(status: RoadmapStatus, overrides: Partial<RoadmapTopic> = {}): RoadmapTopic {
  return {
    topicSlug: "t",
    topicName: "Topic T",
    tier: 0,
    status,
    masteryScore: status === "Recommended Next" || status === "Postponed" ? null : 50,
    confidence: "Medium",
    prerequisites: [],
    recommendedAction: "Maintain",
    actionReason: "",
    isPrerequisiteGap: false,
    ...overrides,
  };
}

const entry = (
  slug: string,
  difficulty: ProblemCatalogEntry["difficulty"],
  extra: Partial<ProblemCatalogEntry> = {}
): ProblemCatalogEntry => ({ slug, title: slug.toUpperCase(), difficulty, topicSlugs: ["t"], ...extra });

const slugsOf = (r: { problems: { slug: string }[] }) => r.problems.map((p) => p.slug);
const difficultiesOf = (r: { problems: { difficulty: string }[] }) => r.problems.map((p) => p.difficulty);

describe("getNewPracticeBand", () => {
  it("maps each status to a band, and Postponed to none", () => {
    expect(getNewPracticeBand("Fundamental Gap")).toBe("approachable");
    expect(getNewPracticeBand("Weak")).toBe("approachable");
    expect(getNewPracticeBand("Under-Practiced")).toBe("approachable");
    expect(getNewPracticeBand("Recommended Next")).toBe("approachable");
    expect(getNewPracticeBand("Emerging")).toBe("developing");
    expect(getNewPracticeBand("Revision Needed")).toBe("developing");
    expect(getNewPracticeBand("Strong")).toBe("advanced");
    expect(getNewPracticeBand("Postponed")).toBeNull();
  });
});

describe("selectNewPractice: difficulty by band", () => {
  const catalog = [
    entry("e1", "Easy"),
    entry("e2", "Easy"),
    entry("e3", "Easy"),
    entry("m1", "Medium"),
    entry("m2", "Medium"),
    entry("m3", "Medium"),
    entry("h1", "Hard"),
    entry("h2", "Hard"),
  ];
  const run = (status: RoadmapStatus) =>
    selectNewPractice({ topic: makeTopic(status), catalog, pool: [], solvedSlugs: new Set() });

  it("approachable: two Easy and one approachable Medium, never Hard", () => {
    expect(difficultiesOf(run("Weak"))).toEqual(["Easy", "Easy", "Medium"]);
    expect(difficultiesOf(run("Fundamental Gap"))).toEqual(["Easy", "Easy", "Medium"]);
  });

  it("developing: mostly Medium, never Hard", () => {
    expect(difficultiesOf(run("Emerging"))).toEqual(["Medium", "Medium", "Medium"]);
    expect(difficultiesOf(run("Revision Needed"))).toEqual(["Medium", "Medium", "Medium"]);
  });

  it("advanced: Medium plus one selected Hard", () => {
    expect(difficultiesOf(run("Strong"))).toEqual(["Medium", "Medium", "Hard"]);
  });

  it("Postponed gets nothing", () => {
    expect(run("Postponed")).toEqual({ band: null, problems: [] });
  });

  it("an untouched topic is approachable and gets starter wording", () => {
    const result = selectNewPractice({
      topic: makeTopic("Recommended Next"),
      catalog,
      pool: [],
      solvedSlugs: new Set(),
    });
    expect(result.band).toBe("approachable");
    expect(result.problems[0].reason).toMatch(/starter/i);
  });
});

describe("selectNewPractice: fallbacks when a difficulty runs dry", () => {
  it("approachable falls back to Medium when there are no Easy problems", () => {
    const catalog = [entry("m1", "Medium"), entry("m2", "Medium"), entry("m3", "Medium"), entry("h1", "Hard")];
    const result = selectNewPractice({ topic: makeTopic("Weak"), catalog, pool: [], solvedSlugs: new Set() });
    expect(difficultiesOf(result)).toEqual(["Medium", "Medium", "Medium"]);
  });

  it("developing falls back to Easy, never Hard", () => {
    const catalog = [entry("m1", "Medium"), entry("e1", "Easy"), entry("h1", "Hard")];
    const result = selectNewPractice({ topic: makeTopic("Emerging"), catalog, pool: [], solvedSlugs: new Set() });
    expect(difficultiesOf(result)).toEqual(["Medium", "Easy"]);
  });

  it("advanced uses another Medium instead of a missing Hard", () => {
    const catalog = [entry("m1", "Medium"), entry("m2", "Medium"), entry("m3", "Medium")];
    const result = selectNewPractice({ topic: makeTopic("Strong"), catalog, pool: [], solvedSlugs: new Set() });
    expect(difficultiesOf(result)).toEqual(["Medium", "Medium", "Medium"]);
  });

  it("returns fewer than the limit rather than something that doesn't fit", () => {
    const result = selectNewPractice({
      topic: makeTopic("Weak"),
      catalog: [entry("e1", "Easy")],
      pool: [],
      solvedSlugs: new Set(),
    });
    expect(slugsOf(result)).toEqual(["e1"]);
  });
});

describe("selectNewPractice: what's allowed in", () => {
  it("never returns a problem in the solved set", () => {
    const catalog = [entry("e1", "Easy"), entry("e2", "Easy"), entry("e3", "Easy"), entry("m1", "Medium")];
    const result = selectNewPractice({
      topic: makeTopic("Weak"),
      catalog,
      pool: [],
      solvedSlugs: new Set(["e1", "m1"]),
    });
    expect(slugsOf(result)).toEqual(["e2", "e3"]);
  });

  it("only returns problems tagged with the topic", () => {
    const catalog = [entry("on", "Easy"), entry("off", "Easy", { topicSlugs: ["other"] })];
    const result = selectNewPractice({ topic: makeTopic("Weak"), catalog, pool: [], solvedSlugs: new Set() });
    expect(slugsOf(result)).toEqual(["on"]);
  });

  it("returns no duplicates, even if a slug appears in both pools", () => {
    const result = selectNewPractice({
      topic: makeTopic("Weak"),
      catalog: [entry("dup", "Easy"), entry("e2", "Easy")],
      pool: [entry("dup", "Easy"), entry("e3", "Easy")],
      solvedSlugs: new Set(),
    });
    const slugs = slugsOf(result);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("respects the limit", () => {
    const catalog = Array.from({ length: 10 }, (_, i) => entry(`e${i}`, "Easy"));
    const result = selectNewPractice({ topic: makeTopic("Weak"), catalog, pool: [], solvedSlugs: new Set(), limit: 2 });
    expect(result.problems).toHaveLength(2);
  });
});

describe("selectNewPractice: ordering", () => {
  it("prefers the catalog over the pool at the same difficulty", () => {
    const result = selectNewPractice({
      topic: makeTopic("Weak"),
      catalog: [entry("cat-easy", "Easy")],
      pool: [entry("pool-easy", "Easy", { interviewRelevance: "high" }), entry("pool-easy-2", "Easy")],
      solvedSlugs: new Set(),
    });
    expect(slugsOf(result).slice(0, 2)).toEqual(["cat-easy", "pool-easy"]);
    expect(result.problems.map((p) => p.source).slice(0, 2)).toEqual(["catalog", "pool"]);
  });

  it("uses the pool to fill a gap the catalog can't", () => {
    const result = selectNewPractice({
      topic: makeTopic("Weak"),
      catalog: [entry("cat-easy", "Easy")],
      pool: [entry("pool-easy", "Easy"), entry("pool-med", "Medium")],
      solvedSlugs: new Set(),
    });
    expect(slugsOf(result)).toEqual(["cat-easy", "pool-easy", "pool-med"]);
  });

  it("within the same source, high interview relevance comes first, then original order", () => {
    const result = selectNewPractice({
      topic: makeTopic("Emerging"),
      catalog: [
        entry("m-none", "Medium"),
        entry("m-medium", "Medium", { interviewRelevance: "medium" }),
        entry("m-high", "Medium", { interviewRelevance: "high" }),
        entry("m-high-2", "Medium", { interviewRelevance: "high" }),
      ],
      pool: [],
      solvedSlugs: new Set(),
    });
    expect(slugsOf(result)).toEqual(["m-high", "m-high-2", "m-medium"]);
  });
});

describe("selectNewPractice: the engine's own picks", () => {
  const engine = (slug: string, difficulty: Recommendation["difficulty"], extra: Partial<Recommendation> = {}): Recommendation => ({
    problemSlug: slug,
    problemTitle: slug.toUpperCase(),
    difficulty,
    topicSlug: "t",
    topicName: "Topic T",
    priority: "High",
    kind: "weak-topic",
    reason: `engine says ${slug}`,
    isRevision: false,
    ...extra,
  });
  const catalog = [entry("e1", "Easy"), entry("e2", "Easy"), entry("e3", "Easy"), entry("m1", "Medium"), entry("m2", "Medium")];

  it("leads with the engine's pick and keeps its reason", () => {
    const result = selectNewPractice({
      topic: makeTopic("Weak"),
      catalog,
      pool: [],
      solvedSlugs: new Set(),
      enginePicks: [engine("e2", "Easy")],
    });
    expect(result.problems[0]).toMatchObject({ slug: "e2", source: "engine", reason: "engine says e2" });
  });

  it("an engine pick uses up a matching slot instead of adding a fourth problem", () => {
    const result = selectNewPractice({
      topic: makeTopic("Weak"),
      catalog,
      pool: [],
      solvedSlugs: new Set(),
      enginePicks: [engine("e2", "Easy")],
    });
    expect(result.problems).toHaveLength(3);
    expect(difficultiesOf(result)).toEqual(["Easy", "Easy", "Medium"]);
    expect(new Set(slugsOf(result)).size).toBe(3);
  });

  it("ignores revision picks, other topics' picks and solved problems", () => {
    const result = selectNewPractice({
      topic: makeTopic("Weak"),
      catalog,
      pool: [],
      solvedSlugs: new Set(["e1"]),
      enginePicks: [engine("x1", "Easy", { isRevision: true }), engine("x2", "Easy", { topicSlug: "other" }), engine("e1", "Easy")],
    });
    expect(result.problems.every((p) => p.source !== "engine")).toBe(true);
    expect(slugsOf(result)).not.toContain("e1");
  });
});

describe("selectNewPractice: output shape", () => {
  it("gives every problem a title, difficulty, topic, short reason and link", () => {
    const result = selectNewPractice({
      topic: makeTopic("Emerging"),
      catalog: [entry("m1", "Medium", { interviewRelevance: "high" })],
      pool: [],
      solvedSlugs: new Set(),
    });
    expect(result.problems[0]).toMatchObject({
      slug: "m1",
      title: "M1",
      difficulty: "Medium",
      topicName: "Topic T",
      url: leetcodeProblemUrl("m1"),
    });
    expect(result.problems[0].reason).toContain("Common interview question");
    expect(leetcodeProblemUrl("two-sum")).toBe("https://leetcode.com/problems/two-sum/");
  });
});

describe("selectNewPractice: against the real catalog and pool", () => {
  const topics = [...SKILL_GRAPH_TOPICS.map((t) => t.slug), "hash-table", "string", "linked-list"];
  const allStatuses: RoadmapStatus[] = [
    "Strong",
    "Emerging",
    "Under-Practiced",
    "Revision Needed",
    "Weak",
    "Fundamental Gap",
    "Recommended Next",
  ];

  it("gives every topic at least two new problems at every status, all on-topic and unsolved", () => {
    for (const topicSlug of topics) {
      for (const status of allStatuses) {
        const result = selectNewPractice({
          topic: makeTopic(status, { topicSlug }),
          catalog: PROBLEM_CATALOG,
          pool: PRACTICE_POOL,
          solvedSlugs: new Set(),
        });
        expect(result.problems.length, `${topicSlug} / ${status}`).toBeGreaterThanOrEqual(2);
        for (const problem of result.problems) {
          const source = [...PROBLEM_CATALOG, ...PRACTICE_POOL].find((p) => p.slug === problem.slug);
          expect(source?.topicSlugs, `${problem.slug} on ${topicSlug}`).toContain(topicSlug);
        }
      }
    }
  });

  it("still finds new problems after the student has solved a good part of a topic", () => {
    const all = [...PROBLEM_CATALOG, ...PRACTICE_POOL].filter((p) => p.topicSlugs.includes("dynamic-programming"));
    const solved = new Set(all.slice(0, 5).map((p) => p.slug));
    const result = selectNewPractice({
      topic: makeTopic("Emerging", { topicSlug: "dynamic-programming" }),
      catalog: PROBLEM_CATALOG,
      pool: PRACTICE_POOL,
      solvedSlugs: solved,
    });
    expect(result.problems.length).toBeGreaterThanOrEqual(2);
    expect(result.problems.some((p) => solved.has(p.slug))).toBe(false);
  });

  it("never offers a Hard to an approachable or developing topic", () => {
    for (const topicSlug of topics) {
      for (const status of ["Weak", "Fundamental Gap", "Emerging", "Revision Needed", "Under-Practiced"] as const) {
        const result = selectNewPractice({
          topic: makeTopic(status, { topicSlug }),
          catalog: PROBLEM_CATALOG,
          pool: PRACTICE_POOL,
          solvedSlugs: new Set(),
        });
        expect(difficultiesOf(result), `${topicSlug} / ${status}`).not.toContain("Hard");
      }
    }
  });
});