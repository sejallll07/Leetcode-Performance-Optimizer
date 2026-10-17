import { MENTOR_CONFIG } from "@/lib/mentor/config";
import type { Difficulty, ProblemCatalogEntry } from "@/lib/analytics/types";

export type ProblemSearchFilters = {
  topicSlug?: string;
  difficulty?: Difficulty;
  /** Normally the student's own already-solved slugs, so "give me a problem" doesn't hand back one they've already done. */
  excludeSlugs?: string[];
};

export type ProblemSearchResult = {
  problemSlug: string;
  problemTitle: string;
  difficulty: Difficulty;
  topicSlugs: string[];
};

/**
 * Filters the curated problem catalog (the same one Phase 6's
 * recommendation engine draws from — see problem-catalog-data.ts)
 * down to real matches for a mentor request like "give me a Binary
 * Search problem". Pure and synchronous: the catalog is loaded once
 * per turn by the service layer and handed in, same pattern as the
 * analytics engine's own inputs.
 */
export function searchProblemCatalog(
  catalog: ProblemCatalogEntry[],
  filters: ProblemSearchFilters
): ProblemSearchResult[] {
  const excludeSet = new Set(filters.excludeSlugs ?? []);

  const matches = catalog.filter((p) => {
    if (filters.topicSlug && !p.topicSlugs.includes(filters.topicSlug)) return false;
    if (filters.difficulty && p.difficulty !== filters.difficulty) return false;
    if (excludeSet.has(p.slug)) return false;
    return true;
  });

  // Well-known interview staples first (a tiebreaker per ProblemCatalogEntry's own
  // doc comment, not a filter), then alphabetical for a stable, explainable order.
  const sorted = matches.sort((a, b) => {
    const relevanceRank = (p: ProblemCatalogEntry) => (p.interviewRelevance === "high" ? 0 : 1);
    const relevanceDiff = relevanceRank(a) - relevanceRank(b);
    if (relevanceDiff !== 0) return relevanceDiff;
    return a.title.localeCompare(b.title);
  });

  return sorted.slice(0, MENTOR_CONFIG.maxCatalogSearchResults).map((p) => ({
    problemSlug: p.slug,
    problemTitle: p.title,
    difficulty: p.difficulty,
    topicSlugs: p.topicSlugs,
  }));
}
