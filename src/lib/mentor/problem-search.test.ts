import { describe, expect, it } from "vitest";
import { searchProblemCatalog } from "@/lib/mentor/problem-search";
import { MENTOR_CONFIG } from "@/lib/mentor/config";
import type { ProblemCatalogEntry } from "@/lib/analytics/types";

function entry(overrides: Partial<ProblemCatalogEntry> = {}): ProblemCatalogEntry {
  return {
    slug: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    topicSlugs: ["array"],
    ...overrides,
  };
}

describe("searchProblemCatalog", () => {
  const catalog: ProblemCatalogEntry[] = [
    entry({ slug: "two-sum", title: "Two Sum", difficulty: "Easy", topicSlugs: ["array", "hash-table"] }),
    entry({ slug: "binary-search", title: "Binary Search", difficulty: "Easy", topicSlugs: ["binary-search"] }),
    entry({ slug: "koko-bananas", title: "Koko Eating Bananas", difficulty: "Medium", topicSlugs: ["binary-search"] }),
    entry({ slug: "median-two-arrays", title: "Median of Two Sorted Arrays", difficulty: "Hard", topicSlugs: ["binary-search"] }),
  ];

  it("filters by topic", () => {
    const result = searchProblemCatalog(catalog, { topicSlug: "binary-search" });
    expect(result.map((r) => r.problemSlug).sort()).toEqual(["binary-search", "koko-bananas", "median-two-arrays"]);
  });

  it("filters by difficulty", () => {
    const result = searchProblemCatalog(catalog, { difficulty: "Easy" });
    expect(result.map((r) => r.problemSlug).sort()).toEqual(["binary-search", "two-sum"]);
  });

  it("combines topic and difficulty filters", () => {
    const result = searchProblemCatalog(catalog, { topicSlug: "binary-search", difficulty: "Medium" });
    expect(result.map((r) => r.problemSlug)).toEqual(["koko-bananas"]);
  });

  it("excludes already-solved slugs", () => {
    const result = searchProblemCatalog(catalog, { topicSlug: "binary-search", excludeSlugs: ["binary-search"] });
    expect(result.map((r) => r.problemSlug)).not.toContain("binary-search");
  });

  it("returns everything when no filters are given", () => {
    const result = searchProblemCatalog(catalog, {});
    expect(result).toHaveLength(catalog.length);
  });

  it("puts high interview-relevance problems first", () => {
    const withRelevance: ProblemCatalogEntry[] = [
      entry({ slug: "z-problem", title: "Z Problem", interviewRelevance: undefined }),
      entry({ slug: "a-staple", title: "A Staple", interviewRelevance: "high" }),
    ];
    const result = searchProblemCatalog(withRelevance, {});
    expect(result[0].problemSlug).toBe("a-staple");
  });

  it("caps results at the configured limit", () => {
    const big: ProblemCatalogEntry[] = Array.from({ length: MENTOR_CONFIG.maxCatalogSearchResults + 5 }, (_, i) =>
      entry({ slug: `p${i}`, title: `P${i}` })
    );
    const result = searchProblemCatalog(big, {});
    expect(result).toHaveLength(MENTOR_CONFIG.maxCatalogSearchResults);
  });

  it("returns an empty list rather than throwing when nothing matches", () => {
    const result = searchProblemCatalog(catalog, { topicSlug: "dynamic-programming" });
    expect(result).toEqual([]);
  });
});
