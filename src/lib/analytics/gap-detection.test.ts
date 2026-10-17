import { describe, expect, it } from "vitest";
import { detectGaps } from "@/lib/analytics/gap-detection";
import type { RawMasteryResult, SkillGraphEdge, TopicClassification } from "@/lib/analytics/types";

function raw(overrides: Partial<RawMasteryResult> = {}): RawMasteryResult {
  return {
    topicSlug: "backtracking",
    topicName: "Backtracking",
    masteryScore: 30,
    confidence: "Medium",
    classification: "Weak",
    subScores: { exposure: 0.3, difficulty: 0.3, recency: 0.3, diversity: 0.3 },
    explanation: "test fixture",
    ...overrides,
  };
}

function edge(overrides: Partial<SkillGraphEdge> = {}): SkillGraphEdge {
  return {
    topicSlug: "backtracking",
    topicName: "Backtracking",
    prerequisiteSlug: "recursion",
    prerequisiteName: "Recursion",
    relationshipType: "PREREQUISITE",
    strength: 0.9,
    ...overrides,
  };
}

describe("detectGaps — verdicts", () => {
  it.each<TopicClassification>(["Strong", "Emerging", "Revision Needed"])(
    "marks %s topics as solid regardless of prerequisites",
    (classification) => {
      const { mastery } = detectGaps(
        [raw({ classification }), raw({ topicSlug: "recursion", topicName: "Recursion", classification: "Weak" })],
        [edge()]
      );
      const backtracking = mastery.find((m) => m.topicSlug === "backtracking");
      expect(backtracking?.gapVerdict).toBe("solid");
    }
  );

  it("marks Under-Practiced topics as insufficient-evidence", () => {
    const { mastery } = detectGaps([raw({ classification: "Under-Practiced" })], [edge()]);
    expect(mastery[0].gapVerdict).toBe("insufficient-evidence");
  });

  it("marks a weak topic with no graph edges as not-applicable", () => {
    const { mastery } = detectGaps([raw({ classification: "Weak" })], []);
    expect(mastery[0].gapVerdict).toBe("not-applicable");
  });

  it("marks a weak topic as genuinely-weak when its evidenced prerequisite is solid", () => {
    const { mastery } = detectGaps(
      [
        raw({ classification: "Weak" }),
        raw({ topicSlug: "recursion", topicName: "Recursion", classification: "Strong" }),
      ],
      [edge()]
    );
    const backtracking = mastery.find((m) => m.topicSlug === "backtracking");
    expect(backtracking?.gapVerdict).toBe("genuinely-weak");
    expect(backtracking?.weakPrerequisites).toEqual([]);
  });

  it("marks a weak topic as genuinely-weak when the prerequisite has no evidence either", () => {
    // Prerequisite isn't in rawResults at all — nothing to blame it on.
    const { mastery } = detectGaps([raw({ classification: "Weak" })], [edge()]);
    expect(mastery[0].gapVerdict).toBe("genuinely-weak");
  });

  it("marks a weak topic as prerequisite-gap when its evidenced prerequisite is also weak", () => {
    const { mastery } = detectGaps(
      [
        raw({ classification: "Weak" }),
        raw({ topicSlug: "recursion", topicName: "Recursion", classification: "Fundamental Gap" }),
      ],
      [edge()]
    );
    const backtracking = mastery.find((m) => m.topicSlug === "backtracking");
    expect(backtracking?.gapVerdict).toBe("prerequisite-gap");
    expect(backtracking?.weakPrerequisites).toHaveLength(1);
    expect(backtracking?.weakPrerequisites[0].topicSlug).toBe("recursion");
  });

  it("produces the expected example-style explanation for a prerequisite gap", () => {
    const { mastery } = detectGaps(
      [
        raw({ topicSlug: "tree-dp", topicName: "Tree DP", classification: "Weak" }),
        raw({ topicSlug: "tree", topicName: "Tree", classification: "Weak" }),
      ],
      [
        edge({
          topicSlug: "tree-dp",
          topicName: "Tree DP",
          prerequisiteSlug: "tree",
          prerequisiteName: "Tree",
          relationshipType: "SUBTOPIC",
          strength: 0.7,
        }),
      ]
    );
    const treeDp = mastery.find((m) => m.topicSlug === "tree-dp");
    expect(treeDp?.gapVerdict).toBe("prerequisite-gap");
    expect(treeDp?.gapExplanation).toBe(
      "Tree DP should not be your immediate priority because your Tree fundamentals are still weak."
    );
  });

  it("ignores prerequisite edges below the configured strength threshold", () => {
    const { mastery } = detectGaps(
      [
        raw({ classification: "Weak" }),
        raw({ topicSlug: "recursion", topicName: "Recursion", classification: "Weak" }),
      ],
      [edge({ strength: 0.2 })] // below default minPrerequisiteStrength (0.5)
    );
    const backtracking = mastery.find((m) => m.topicSlug === "backtracking");
    // No qualifying prerequisite edge -> not-applicable, not prerequisite-gap
    expect(backtracking?.gapVerdict).toBe("not-applicable");
  });

  it("lists multiple weak prerequisites and joins their names in the explanation", () => {
    const { mastery } = detectGaps(
      [
        raw({ topicSlug: "tree-dp", topicName: "Tree DP", classification: "Weak" }),
        raw({ topicSlug: "tree", topicName: "Tree", classification: "Weak" }),
        raw({ topicSlug: "dynamic-programming", topicName: "Dynamic Programming", classification: "Fundamental Gap" }),
      ],
      [
        edge({
          topicSlug: "tree-dp",
          topicName: "Tree DP",
          prerequisiteSlug: "tree",
          prerequisiteName: "Tree",
          strength: 0.7,
        }),
        edge({
          topicSlug: "tree-dp",
          topicName: "Tree DP",
          prerequisiteSlug: "dynamic-programming",
          prerequisiteName: "Dynamic Programming",
          strength: 0.8,
        }),
      ]
    );
    const treeDp = mastery.find((m) => m.topicSlug === "tree-dp");
    expect(treeDp?.weakPrerequisites).toHaveLength(2);
    expect(treeDp?.gapExplanation).toContain("Tree and Dynamic Programming");
  });
});

describe("detectGaps — forward-looking gaps", () => {
  it("surfaces a topic with zero evidence when its evidenced prerequisite is weak", () => {
    const { forwardLookingGaps } = detectGaps(
      [raw({ topicSlug: "tree", topicName: "Tree", classification: "Weak" })],
      [
        edge({
          topicSlug: "tree-dp",
          topicName: "Tree DP",
          prerequisiteSlug: "tree",
          prerequisiteName: "Tree",
          strength: 0.7,
        }),
      ]
    );
    expect(forwardLookingGaps).toHaveLength(1);
    expect(forwardLookingGaps[0].topicSlug).toBe("tree-dp");
    expect(forwardLookingGaps[0].explanation).toContain("Tree DP");
  });

  it("does not surface a zero-evidence topic when its prerequisite is solid", () => {
    const { forwardLookingGaps } = detectGaps(
      [raw({ topicSlug: "tree", topicName: "Tree", classification: "Strong" })],
      [
        edge({
          topicSlug: "tree-dp",
          topicName: "Tree DP",
          prerequisiteSlug: "tree",
          prerequisiteName: "Tree",
          strength: 0.7,
        }),
      ]
    );
    expect(forwardLookingGaps).toEqual([]);
  });

  it("does not surface a zero-evidence topic when its prerequisite also has no evidence", () => {
    const { forwardLookingGaps } = detectGaps(
      [],
      [
        edge({
          topicSlug: "tree-dp",
          topicName: "Tree DP",
          prerequisiteSlug: "tree",
          prerequisiteName: "Tree",
          strength: 0.7,
        }),
      ]
    );
    expect(forwardLookingGaps).toEqual([]);
  });

  it("never surfaces a topic that already has direct evidence as a forward-looking gap", () => {
    const { forwardLookingGaps } = detectGaps(
      [
        raw({ topicSlug: "tree-dp", topicName: "Tree DP", classification: "Under-Practiced" }),
        raw({ topicSlug: "tree", topicName: "Tree", classification: "Weak" }),
      ],
      [
        edge({
          topicSlug: "tree-dp",
          topicName: "Tree DP",
          prerequisiteSlug: "tree",
          prerequisiteName: "Tree",
          strength: 0.7,
        }),
      ]
    );
    // tree-dp has its own (Under-Practiced) entry in `mastery`, so it
    // must not also appear in forwardLookingGaps.
    expect(forwardLookingGaps.find((g) => g.topicSlug === "tree-dp")).toBeUndefined();
  });
});
