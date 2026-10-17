import { describe, expect, it } from "vitest";
import {
  ROADMAP_FILTERS,
  buildTopicIndex,
  buildUnlocksMap,
  countByFilter,
  getChain,
  hasEvidence,
  topicMatchesFilter,
} from "@/lib/roadmap/roadmap-view";
import type { RoadmapStatus, RoadmapTopic } from "@/lib/roadmap/types";

const ALL_STATUSES: RoadmapStatus[] = [
  "Strong",
  "Emerging",
  "Under-Practiced",
  "Revision Needed",
  "Weak",
  "Fundamental Gap",
  "Recommended Next",
  "Postponed",
];

function makeTopic(
  slug: string,
  overrides: Partial<Omit<RoadmapTopic, "topicSlug">> = {}
): RoadmapTopic {
  return {
    topicSlug: slug,
    topicName: slug,
    tier: 0,
    status: "Strong",
    masteryScore: 70,
    confidence: "Medium",
    prerequisites: [],
    recommendedAction: "Maintain",
    actionReason: "",
    isPrerequisiteGap: false,
    ...overrides,
  };
}

function prereq(slug: string, isWeak = false) {
  return { topicSlug: slug, topicName: slug, isWeak };
}

describe("status filters", () => {
  it("every roadmap status matches exactly one partition filter", () => {
    const partition = ROADMAP_FILTERS.filter((f) => f.partition);
    for (const status of ALL_STATUSES) {
      const topic = makeTopic("x", { status });
      const matches = partition.filter((f) => f.matches(topic));
      expect(matches, `status "${status}"`).toHaveLength(1);
    }
  });

  it("partition counts always add up to the number of topics", () => {
    const topics = ALL_STATUSES.flatMap((status, i) => [
      makeTopic(`a${i}`, { status }),
      makeTopic(`b${i}`, { status }),
    ]);
    const counts = countByFilter(topics);
    const total = ROADMAP_FILTERS.filter((f) => f.partition).reduce((sum, f) => sum + counts[f.key], 0);
    expect(total).toBe(topics.length);
  });

  it("the prerequisite overlay counts on top of a topic's own status without changing it", () => {
    const counts = countByFilter([makeTopic("a", { status: "Weak", isPrerequisiteGap: true })]);
    expect(counts.weak).toBe(1);
    expect(counts.prereq).toBe(1);
    expect(counts.strong).toBe(0);
  });

  it("returns a zero for every key when there are no topics", () => {
    const counts = countByFilter([]);
    for (const filter of ROADMAP_FILTERS) expect(counts[filter.key]).toBe(0);
  });

  it("topicMatchesFilter: null matches everything, a key matches only its own", () => {
    const weak = makeTopic("a", { status: "Weak" });
    expect(topicMatchesFilter(weak, null)).toBe(true);
    expect(topicMatchesFilter(weak, "weak")).toBe(true);
    expect(topicMatchesFilter(weak, "strong")).toBe(false);
  });
});

describe("hasEvidence", () => {
  it("is false only for topics with no score", () => {
    expect(hasEvidence(makeTopic("a", { masteryScore: 0 }))).toBe(true);
    expect(hasEvidence(makeTopic("a", { masteryScore: null, status: "Postponed" }))).toBe(false);
  });
});

describe("unlocks map and chains", () => {
  // recursion → tree → tree-dp ← dynamic-programming ; recursion → backtracking
  const topics = [
    makeTopic("recursion", { tier: 0 }),
    makeTopic("dynamic-programming", { tier: 0 }),
    makeTopic("tree", { tier: 1, prerequisites: [prereq("recursion")] }),
    makeTopic("backtracking", { tier: 1, prerequisites: [prereq("recursion")] }),
    makeTopic("tree-dp", { tier: 2, prerequisites: [prereq("tree"), prereq("dynamic-programming")] }),
  ];
  const index = buildTopicIndex(topics);
  const unlocks = buildUnlocksMap(topics);

  it("gives every topic an entry, empty for leaves", () => {
    expect([...unlocks.keys()].sort()).toEqual(topics.map((t) => t.topicSlug).sort());
    expect(unlocks.get("tree-dp")).toEqual([]);
  });

  it("lists the direct dependents of a topic, in input order", () => {
    expect(unlocks.get("recursion")!.map((t) => t.topicSlug)).toEqual(["tree", "backtracking"]);
    expect(unlocks.get("dynamic-programming")!.map((t) => t.topicSlug)).toEqual(["tree-dp"]);
  });

  it("upstream is the full prerequisite chain, never including the topic itself", () => {
    const { upstream } = getChain("tree-dp", index, unlocks);
    expect([...upstream].sort()).toEqual(["dynamic-programming", "recursion", "tree"]);
  });

  it("downstream is everything the topic eventually leads to", () => {
    const { downstream } = getChain("recursion", index, unlocks);
    expect([...downstream].sort()).toEqual(["backtracking", "tree", "tree-dp"]);
  });

  it("a root has no upstream and a leaf has no downstream", () => {
    expect(getChain("recursion", index, unlocks).upstream.size).toBe(0);
    expect(getChain("tree-dp", index, unlocks).downstream.size).toBe(0);
  });

  it("terminates safely if a cycle ever sneaks into the graph", () => {
    const cyclic = [
      makeTopic("a", { prerequisites: [prereq("b")] }),
      makeTopic("b", { prerequisites: [prereq("a")] }),
    ];
    const chain = getChain("a", buildTopicIndex(cyclic), buildUnlocksMap(cyclic));
    expect([...chain.upstream]).toEqual(["b"]);
    expect([...chain.downstream]).toEqual(["b"]);
  });
});