import { describe, expect, it } from "vitest";
import {
  buildStages,
  getMoveOnProgress,
  getStageMeta,
  isCoreTopic,
  summarizePosition,
} from "@/lib/roadmap/roadmap-stages";
import { buildUnlocksMap } from "@/lib/roadmap/roadmap-view";
import type { RoadmapTopic } from "@/lib/roadmap/types";

function makeTopic(slug: string, overrides: Partial<Omit<RoadmapTopic, "topicSlug">> = {}): RoadmapTopic {
  return {
    topicSlug: slug,
    topicName: slug,
    tier: 0,
    status: "Strong",
    masteryScore: 80,
    confidence: "High",
    prerequisites: [],
    recommendedAction: "Maintain",
    actionReason: "",
    isPrerequisiteGap: false,
    ...overrides,
  };
}
const prereq = (slug: string, isWeak = false) => ({ topicSlug: slug, topicName: slug, isWeak });

// array → two-pointers → sliding-window  (a 3-stage chain), plus two off-graph topics
const topics = [
  makeTopic("array", { tier: 0 }),
  makeTopic("hash-table", { tier: 0, status: "Weak", masteryScore: 40 }), // off-graph
  makeTopic("math", { tier: 0, status: "Recommended Next", masteryScore: null }), // off-graph
  makeTopic("two-pointers", { tier: 1, status: "Emerging", masteryScore: 55, prerequisites: [prereq("array")] }),
  makeTopic("sliding-window", {
    tier: 2,
    status: "Recommended Next",
    masteryScore: null,
    prerequisites: [prereq("two-pointers")],
  }),
];
const unlocks = buildUnlocksMap(topics);

describe("core vs other topics", () => {
  it("a topic is core if it has a prerequisite or something depends on it", () => {
    expect(isCoreTopic(topics[0], unlocks)).toBe(true); // array: unlocks two-pointers
    expect(isCoreTopic(topics[3], unlocks)).toBe(true); // two-pointers: has prerequisite
    expect(isCoreTopic(topics[4], unlocks)).toBe(true); // sliding-window: has prerequisite
  });

  it("a topic with no edges at all is not core", () => {
    expect(isCoreTopic(topics[1], unlocks)).toBe(false);
    expect(isCoreTopic(topics[2], unlocks)).toBe(false);
  });
});

describe("buildStages", () => {
  const { stages, otherTopics } = buildStages(topics, unlocks);

  it("groups core topics by tier, in order, and sets the rest aside", () => {
    expect(stages.map((s) => [s.level, s.label, s.topics.map((t) => t.topicSlug)])).toEqual([
      [1, "Foundations", ["array"]],
      [2, "Build", ["two-pointers"]],
      [3, "Advance", ["sliding-window"]],
    ]);
    expect(otherTopics.map((t) => t.topicSlug)).toEqual(["hash-table", "math"]);
  });

  it("counts strong and started topics per stage", () => {
    expect(stages[0]).toMatchObject({ strongCount: 1, startedCount: 1 });
    expect(stages[1]).toMatchObject({ strongCount: 0, startedCount: 1 });
    expect(stages[2]).toMatchObject({ strongCount: 0, startedCount: 0 });
  });

  it("skips a tier that has no core topics instead of leaving an empty stage", () => {
    const gap = [makeTopic("a", { tier: 0 }), makeTopic("b", { tier: 2, prerequisites: [prereq("a")] })];
    const result = buildStages(gap, buildUnlocksMap(gap));
    expect(result.stages.map((s) => s.level)).toEqual([1, 3]);
  });

  it("puts every topic in exactly one place", () => {
    const placed = stages.flatMap((s) => s.topics).length + otherTopics.length;
    expect(placed).toBe(topics.length);
  });
});

describe("getStageMeta", () => {
  it("names the first three levels and labels deeper ones by level", () => {
    expect(getStageMeta(1).label).toBe("Foundations");
    expect(getStageMeta(2).label).toBe("Build");
    expect(getStageMeta(3).label).toBe("Advance");
    expect(getStageMeta(4).label).toBe("Advanced · Level 4");
    expect(getStageMeta(5).label).toBe("Advanced · Level 5");
  });

  it("gives every level a description", () => {
    for (const level of [1, 2, 3, 4]) expect(getStageMeta(level).description.length).toBeGreaterThan(10);
  });
});

describe("summarizePosition", () => {
  it("counts core topics and what's been started", () => {
    const summary = summarizePosition(topics, unlocks);
    expect(summary).toMatchObject({ coreTotal: 3, coreStrong: 1, coreStarted: 2, coreNotStarted: 1, otherTotal: 2 });
  });

  it("orders what needs attention: gaps, then weak, then revision, lowest mastery first", () => {
    const mixed = [
      makeTopic("rev", { status: "Revision Needed", masteryScore: 75 }),
      makeTopic("weak-b", { status: "Weak", masteryScore: 50 }),
      makeTopic("gap", { status: "Fundamental Gap", masteryScore: 10 }),
      makeTopic("weak-a", { status: "Weak", masteryScore: 30 }),
      makeTopic("fine", { status: "Strong" }),
    ];
    const summary = summarizePosition(mixed, buildUnlocksMap(mixed));
    expect(summary.needsAttention.map((t) => t.topicSlug)).toEqual(["gap", "weak-a", "weak-b", "rev"]);
  });

  it("does not mutate the input order", () => {
    const input = [makeTopic("b", { status: "Weak", masteryScore: 50 }), makeTopic("a", { status: "Fundamental Gap", masteryScore: 5 })];
    summarizePosition(input, buildUnlocksMap(input));
    expect(input.map((t) => t.topicSlug)).toEqual(["b", "a"]);
  });
});

describe("getMoveOnProgress", () => {
  it("no score yet → nothing to move", () => {
    expect(getMoveOnProgress(makeTopic("x", { status: "Recommended Next", masteryScore: null }))).toEqual({
      kind: "no-evidence",
      target: 70,
    });
  });

  it("Strong → reached", () => {
    expect(getMoveOnProgress(makeTopic("x", { status: "Strong", masteryScore: 82.4 }))).toEqual({
      kind: "reached",
      score: 82,
      target: 70,
    });
  });

  it("Revision Needed → score is fine, practice is stale", () => {
    expect(getMoveOnProgress(makeTopic("x", { status: "Revision Needed", masteryScore: 74 }))).toEqual({
      kind: "needs-refresh",
      score: 74,
      target: 70,
      staleAfterDays: 45,
    });
  });

  it("Under-Practiced → needs more evidence, not just a higher number", () => {
    expect(getMoveOnProgress(makeTopic("x", { status: "Under-Practiced", masteryScore: 40 })).kind).toBe("needs-evidence");
  });

  it("Weak / Emerging / Gap → building, with the points still to go", () => {
    for (const status of ["Weak", "Emerging", "Fundamental Gap"] as const) {
      expect(getMoveOnProgress(makeTopic("x", { status, masteryScore: 55 }))).toEqual({
        kind: "building",
        score: 55,
        target: 70,
        pointsToGo: 15,
      });
    }
  });
});