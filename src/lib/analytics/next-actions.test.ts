import { describe, expect, it } from "vitest";
import { computeNextActions } from "@/lib/analytics/next-actions";
import type { ForwardLookingGap, MasteryResult } from "@/lib/analytics/types";

function mastery(overrides: Partial<MasteryResult> = {}): MasteryResult {
  return {
    topicSlug: "array",
    topicName: "Array",
    masteryScore: 50,
    confidence: "Medium",
    classification: "Weak",
    subScores: { exposure: 0.5, difficulty: 0.5, recency: 0.5, diversity: 0.5 },
    explanation: "raw explanation fixture",
    gapVerdict: "genuinely-weak",
    gapExplanation: "gap explanation fixture",
    weakPrerequisites: [],
    ...overrides,
  };
}

describe("computeNextActions", () => {
  it("prioritizes a Fundamental Gap with an identified prerequisite cause first", () => {
    const actions = computeNextActions(
      [
        mastery({
          topicSlug: "backtracking",
          topicName: "Backtracking",
          classification: "Fundamental Gap",
          gapVerdict: "prerequisite-gap",
          weakPrerequisites: [{ topicSlug: "recursion", topicName: "Recursion", classification: "Weak", strength: 0.9 }],
        }),
        mastery({ topicSlug: "revision-topic", topicName: "Revision Topic", classification: "Revision Needed" }),
      ],
      []
    );
    expect(actions[0].kind).toBe("prerequisite-gap");
    expect(actions[0].topicSlug).toBe("backtracking");
  });

  it("never invents a reason — reason text always matches an existing explanation field", () => {
    const raw = mastery({ classification: "Fundamental Gap", explanation: "the real explanation" });
    const actions = computeNextActions([raw], []);
    expect(actions[0].reason).toBe("the real explanation");
  });

  it("includes forward-looking gaps as preventive action items", () => {
    const gap: ForwardLookingGap = {
      topicSlug: "tree-dp",
      topicName: "Tree DP",
      weakPrerequisites: [{ topicSlug: "tree", topicName: "Tree", classification: "Weak", strength: 0.7 }],
      explanation: "forward-looking explanation fixture",
    };
    const actions = computeNextActions([], [gap]);
    expect(actions).toHaveLength(1);
    expect(actions[0].kind).toBe("forward-looking-gap");
    expect(actions[0].reason).toBe("forward-looking explanation fixture");
  });

  it("skips Strong, Emerging, and Under-Practiced topics entirely", () => {
    const actions = computeNextActions(
      [
        mastery({ topicSlug: "a", classification: "Strong" }),
        mastery({ topicSlug: "b", classification: "Emerging" }),
        mastery({ topicSlug: "c", classification: "Under-Practiced" }),
      ],
      []
    );
    expect(actions).toEqual([]);
  });

  it("caps the list at the configured maximum", () => {
    const many = Array(20)
      .fill(0)
      .map((_, i) => mastery({ topicSlug: `weak-${i}`, topicName: `Weak ${i}`, classification: "Weak" }));
    const actions = computeNextActions(many, []);
    expect(actions.length).toBeLessThanOrEqual(5);
  });

  it("ranks a plain Weak topic below a Revision Needed one", () => {
    const actions = computeNextActions(
      [
        mastery({ topicSlug: "weak", topicName: "Weak", classification: "Weak" }),
        mastery({ topicSlug: "stale", topicName: "Stale", classification: "Revision Needed" }),
      ],
      []
    );
    const weakIndex = actions.findIndex((a) => a.topicSlug === "weak");
    const staleIndex = actions.findIndex((a) => a.topicSlug === "stale");
    expect(staleIndex).toBeLessThan(weakIndex);
  });
});
