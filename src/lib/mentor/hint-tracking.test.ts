import { describe, expect, it } from "vitest";
import { clampHintLevel, computeHintProgress } from "@/lib/mentor/hint-tracking";

describe("clampHintLevel", () => {
  it("passes a valid level through unchanged", () => {
    expect(clampHintLevel(3)).toBe(3);
  });

  it("returns null for null, undefined, NaN, and non-finite values", () => {
    expect(clampHintLevel(null)).toBeNull();
    expect(clampHintLevel(undefined)).toBeNull();
    expect(clampHintLevel(NaN)).toBeNull();
    expect(clampHintLevel(Infinity)).toBeNull();
  });

  it("treats 0 and negative numbers as not-a-hint, not level 0", () => {
    expect(clampHintLevel(0)).toBeNull();
    expect(clampHintLevel(-2)).toBeNull();
  });

  it("caps anything above the max at the max level", () => {
    expect(clampHintLevel(9)).toBe(6);
  });

  it("rounds a fractional level to the nearest integer", () => {
    expect(clampHintLevel(2.6)).toBe(3);
  });
});

describe("computeHintProgress", () => {
  it("returns nothing for an empty history", () => {
    expect(computeHintProgress([])).toEqual([]);
  });

  it("ignores messages with no problemSlug or no hintLevel", () => {
    const result = computeHintProgress([
      { problemSlug: null, hintLevel: 2 },
      { problemSlug: "two-sum", hintLevel: null },
    ]);
    expect(result).toEqual([]);
  });

  it("tracks the highest hint level reached per problem, not the most recent", () => {
    const result = computeHintProgress([
      { problemSlug: "two-sum", hintLevel: 1 },
      { problemSlug: "two-sum", hintLevel: 3 },
      { problemSlug: "two-sum", hintLevel: 2 }, // a later message at a *lower* level shouldn't regress progress
    ]);
    expect(result).toEqual([{ problemSlug: "two-sum", currentLevel: 3 }]);
  });

  it("tracks multiple problems independently", () => {
    const result = computeHintProgress([
      { problemSlug: "two-sum", hintLevel: 2 },
      { problemSlug: "binary-search", hintLevel: 4 },
    ]);
    expect(result).toContainEqual({ problemSlug: "two-sum", currentLevel: 2 });
    expect(result).toContainEqual({ problemSlug: "binary-search", currentLevel: 4 });
    expect(result).toHaveLength(2);
  });
});
