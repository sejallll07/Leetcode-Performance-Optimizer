import { ANALYTICS_CONFIG } from "@/lib/analytics/config";
import type { SkillGraphEdge } from "@/lib/analytics/types";

/**
 * Pure graph lookups over a plain edge list — no DB, no seed data
 * import. Works over whatever edges the caller hands it, which is
 * what makes it trivially testable with a small synthetic graph
 * instead of the full real one. The real seeded graph is loaded by
 * src/repositories/skill-graph-repository.ts and passed in as
 * AnalyticsInput.topicRelationships.
 */

/** Direct prerequisites of `topicSlug`, at or above the configured strength threshold. */
export function getPrerequisites(
  edges: SkillGraphEdge[],
  topicSlug: string,
  minStrength: number = ANALYTICS_CONFIG.skillGraph.minPrerequisiteStrength
): SkillGraphEdge[] {
  return edges.filter((edge) => edge.topicSlug === topicSlug && edge.strength >= minStrength);
}

/** Topics that directly depend on `topicSlug` (the reverse direction) — not used by gap detection yet, kept for completeness/future use (e.g. a future roadmap feature). */
export function getDependents(edges: SkillGraphEdge[], topicSlug: string): SkillGraphEdge[] {
  return edges.filter((edge) => edge.prerequisiteSlug === topicSlug);
}

/** Every distinct topic slug mentioned anywhere in the edge list, either as a topic or a prerequisite. */
export function getAllGraphTopicSlugs(edges: SkillGraphEdge[]): Set<string> {
  const slugs = new Set<string>();
  for (const edge of edges) {
    slugs.add(edge.topicSlug);
    slugs.add(edge.prerequisiteSlug);
  }
  return slugs;
}
