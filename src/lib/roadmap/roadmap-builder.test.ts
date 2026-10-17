import { describe, expect, it } from "vitest";
import { buildRoadmap, type RoadmapInput } from "@/lib/roadmap/roadmap-builder";
import type { ForwardLookingGap, MasteryResult, SkillGraphEdge, TopicClassification } from "@/lib/analytics/types";

const NOW = new Date("2026-06-01T00:00:00Z");

const EDGES: SkillGraphEdge[] = [
  {
    topicSlug: "backtracking",
    topicName: "Backtracking",
    prerequisiteSlug: "recursion",
    prerequisiteName: "Recursion",
    relationshipType: "PREREQUISITE",
    strength: 0.9,
  },
  {
    topicSlug: "tree",
    topicName: "Tree",
    prerequisiteSlug: "recursion",
    prerequisiteName: "Recursion",
    relationshipType: "PREREQUISITE",
    strength: 0.7,
  },
  {
    topicSlug: "tree-dp",
    topicName: "Tree DP",
    prerequisiteSlug: "tree",
    prerequisiteName: "Tree",
    relationshipType: "SUBTOPIC",
    strength: 0.7,
  },
  {
    topicSlug: "sliding-window",
    topicName: "Sliding Window",
    prerequisiteSlug: "array",
    prerequisiteName: "Array",
    relationshipType: "SUBTOPIC",
    strength: 0.3, // deliberately below Phase 4's diagnostic threshold — tiering should ignore that
  },
];

function mastery(overrides: Partial<MasteryResult> = {}): MasteryResult {
  return {
    topicSlug: "array",
    topicName: "Array",
    masteryScore: 80,
    confidence: "High",
    classification: "Strong",
    subScores: { exposure: 1, difficulty: 1, recency: 1, diversity: 1 },
    explanation: "fixture explanation",
    gapVerdict: "solid",
    gapExplanation: "fixture gap explanation",
    weakPrerequisites: [],
    ...overrides,
  };
}

function build(overrides: Partial<RoadmapInput> = {}): ReturnType<typeof buildRoadmap> {
  return buildRoadmap({
    mastery: [],
    forwardLookingGaps: [],
    topicRelationships: EDGES,
    now: NOW,
    ...overrides,
  });
}

describe("buildRoadmap", () => {
  it("returns empty everything for a student with no evidence and no graph", () => {
    const result = buildRoadmap({ mastery: [], forwardLookingGaps: [], topicRelationships: [], now: NOW });
    expect(result.topics).toEqual([]);
    expect(result.tiers).toEqual([]);
    expect(result.recommendedNextTopic).toBeNull();
    expect(result.groups.strong).toEqual([]);
  });

  it("builds a node for every evidenced topic with tier 0 when it has no prerequisites", () => {
    const result = build({ mastery: [mastery({ topicSlug: "array", topicName: "Array", classification: "Strong" })] });
    const array = result.topics.find((t) => t.topicSlug === "array")!;
    expect(array.tier).toBe(0);
    expect(array.status).toBe("Strong");
    expect(array.masteryScore).toBe(80);
    expect(array.recommendedAction).toBe("Maintain");
  });

  it("computes tiers topologically from the full edge list, independent of gap-detection's strength threshold", () => {
    const result = build({
      mastery: [
        mastery({ topicSlug: "recursion", topicName: "Recursion", classification: "Strong" }),
        mastery({ topicSlug: "backtracking", topicName: "Backtracking", classification: "Strong" }),
        mastery({ topicSlug: "tree", topicName: "Tree", classification: "Strong" }),
        mastery({ topicSlug: "tree-dp", topicName: "Tree DP", classification: "Strong" }),
      ],
    });
    const byTier = Object.fromEntries(result.topics.map((t) => [t.topicSlug, t.tier]));
    expect(byTier.recursion).toBe(0);
    expect(byTier.backtracking).toBe(1);
    expect(byTier.tree).toBe(1);
    expect(byTier["tree-dp"]).toBe(2);
  });

  it("maps every evidenced classification to the brief's recommended action", () => {
    const cases: [TopicClassification, string][] = [
      ["Strong", "Maintain"],
      ["Revision Needed", "Revise"],
      ["Weak", "Practice"],
      ["Fundamental Gap", "Learn fundamentals"],
      ["Under-Practiced", "Collect more evidence"],
      ["Emerging", "Keep practicing"],
    ];
    for (const [classification, action] of cases) {
      const result = build({ mastery: [mastery({ topicSlug: "array", classification })] });
      const array = result.topics.find((t) => t.topicSlug === "array")!;
      expect(array.recommendedAction).toBe(action);
    }
  });

  it("classifies a zero-evidence graph topic with a weak prerequisite as Postponed", () => {
    const gap: ForwardLookingGap = {
      topicSlug: "tree-dp",
      topicName: "Tree DP",
      weakPrerequisites: [{ topicSlug: "tree", topicName: "Tree", classification: "Weak", strength: 0.7 }],
      explanation: "Not enough evidence on Tree DP yet — and its Tree fundamentals are currently weak, so that's worth strengthening first.",
    };
    const result = build({
      mastery: [mastery({ topicSlug: "tree", topicName: "Tree", classification: "Weak", masteryScore: 30 })],
      forwardLookingGaps: [gap],
    });
    const treeDp = result.topics.find((t) => t.topicSlug === "tree-dp")!;
    expect(treeDp.status).toBe("Postponed");
    expect(treeDp.masteryScore).toBeNull();
    expect(treeDp.confidence).toBe("None");
    expect(treeDp.recommendedAction).toBe("Hold off");
    expect(treeDp.actionReason).toBe(gap.explanation);
    expect(treeDp.prerequisites).toEqual([{ topicSlug: "tree", topicName: "Tree", isWeak: true }]);
    expect(result.groups.postponed.map((t) => t.topicSlug)).toEqual(["tree-dp"]);
  });

  it("classifies a zero-evidence graph topic with no weak prerequisite as Recommended Next", () => {
    const result = build({ mastery: [] });
    const recursion = result.topics.find((t) => t.topicSlug === "recursion")!;
    expect(recursion.status).toBe("Recommended Next");
    expect(recursion.recommendedAction).toBe("Start here");
    expect(recursion.actionReason).toContain("No prerequisite concerns for Recursion");
    expect(result.groups.recommendedNext.map((t) => t.topicSlug)).toContain("recursion");
  });

  it("flags prerequisite-gap topics via isPrerequisiteGap without replacing their status", () => {
    const result = build({
      mastery: [
        mastery({
          topicSlug: "backtracking",
          topicName: "Backtracking",
          classification: "Weak",
          masteryScore: 20,
          gapVerdict: "prerequisite-gap",
          gapExplanation: "Backtracking should not be your immediate priority because your Recursion fundamentals are still weak.",
          weakPrerequisites: [{ topicSlug: "recursion", topicName: "Recursion", classification: "Weak", strength: 0.9 }],
        }),
        mastery({ topicSlug: "recursion", topicName: "Recursion", classification: "Weak", masteryScore: 20 }),
      ],
    });
    const backtracking = result.topics.find((t) => t.topicSlug === "backtracking")!;
    expect(backtracking.status).toBe("Weak"); // status is untouched
    expect(backtracking.isPrerequisiteGap).toBe(true);
    expect(backtracking.actionReason).toBe(backtracking.actionReason); // sanity
    expect(backtracking.actionReason).toContain("should not be your immediate priority");
    expect(result.groups.weak.map((t) => t.topicSlug)).toContain("backtracking");
    expect(result.groups.prerequisiteTopics.map((t) => t.topicSlug)).toContain("backtracking");
  });

  it("picks the lowest-tier Recommended Next topic, breaking ties by dependent count", () => {
    // recursion (tier 0, 2 dependents: backtracking, tree) vs array (tier 0, 1 dependent: sliding-window)
    const result = build({ mastery: [] });
    expect(result.recommendedNextTopic?.topicSlug).toBe("recursion");
  });

  it("prefers a lower tier over a higher-dependent-count topic", () => {
    const result = build({
      // Evidence recursion and array so only deeper topics remain zero-evidence.
      mastery: [
        mastery({ topicSlug: "recursion", topicName: "Recursion", classification: "Strong" }),
        mastery({ topicSlug: "array", topicName: "Array", classification: "Strong" }),
      ],
    });
    // backtracking/tree (tier 1) should be preferred over tree-dp (tier 2), regardless of dependents.
    expect(["backtracking", "tree"]).toContain(result.recommendedNextTopic?.topicSlug);
  });

  it("groups strong/weak/fundamental-gap/revision-needed topics by classification, weakest first where relevant", () => {
    const result = build({
      mastery: [
        mastery({ topicSlug: "array", topicName: "Array", classification: "Strong", masteryScore: 90 }),
        mastery({ topicSlug: "recursion", topicName: "Recursion", classification: "Weak", masteryScore: 40 }),
        mastery({ topicSlug: "tree", topicName: "Tree", classification: "Weak", masteryScore: 20 }),
      ],
    });
    expect(result.groups.strong.map((t) => t.topicSlug)).toEqual(["array"]);
    expect(result.groups.weak.map((t) => t.topicSlug)).toEqual(["tree", "recursion"]); // weakest (lowest score) first
  });

  it("lays topics out into tiers sorted ascending, one entry per distinct tier present in the graph", () => {
    const result = build({
      mastery: [
        mastery({ topicSlug: "recursion", topicName: "Recursion", classification: "Strong" }),
        mastery({ topicSlug: "backtracking", topicName: "Backtracking", classification: "Strong" }),
      ],
    });
    // The full EDGES fixture also contains tree/sliding-window (tier 1) and tree-dp (tier 2)
    // as zero-evidence Recommended Next nodes, so all three tiers are present.
    expect(result.tiers.map((t) => t.tier)).toEqual([0, 1, 2]);
    expect(result.tiers[0].topics.map((t) => t.topicSlug)).toContain("recursion");
    expect(result.tiers[1].topics.map((t) => t.topicSlug)).toContain("backtracking");
    expect(result.tiers[2].topics.map((t) => t.topicSlug)).toContain("tree-dp");
  });
});
