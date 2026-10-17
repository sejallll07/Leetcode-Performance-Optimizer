import { joinNames } from "@/lib/analytics/gap-detection";
import { getAllGraphTopicSlugs, getDependents, getPrerequisites } from "@/lib/analytics/skill-graph";
import type { ForwardLookingGap, MasteryResult, SkillGraphEdge, TopicClassification } from "@/lib/analytics/types";
import type {
  RoadmapAction,
  RoadmapGroups,
  RoadmapPrerequisite,
  RoadmapResult,
  RoadmapStatus,
  RoadmapTier,
  RoadmapTopic,
} from "@/lib/roadmap/types";

/**
 * The recommended action for every evidenced classification — the
 * exact mapping the brief specified (Strong -> Maintain, Revision
 * Needed -> Revise, Weak -> Practice, Fundamental Gap -> Learn
 * fundamentals, Under-Practiced -> Collect more evidence), plus
 * "Emerging", which the brief's example didn't cover but which
 * mastery.ts (Phase 3) can still produce — "Keep practicing" is the
 * plain reading of what Emerging already means ("below Strong, but
 * recent and picking up").
 */
const ACTION_BY_CLASSIFICATION: Record<TopicClassification, RoadmapAction> = {
  Strong: "Maintain",
  "Revision Needed": "Revise",
  Weak: "Practice",
  "Fundamental Gap": "Learn fundamentals",
  "Under-Practiced": "Collect more evidence",
  Emerging: "Keep practicing",
};

export type RoadmapInput = {
  mastery: MasteryResult[];
  forwardLookingGaps: ForwardLookingGap[];
  topicRelationships: SkillGraphEdge[];
  /** Injected, not `new Date()` inside the builder — same determinism discipline as the rest of the engine (see AnalyticsInput.now). Used only for `generatedAt`; nothing here is otherwise time-sensitive (that's already baked into `mastery`/`forwardLookingGaps` by the time they get here). */
  now: Date;
};

/** Collects every topic name mentioned anywhere in the inputs, so every node on the roadmap — evidenced or not — has a display name even if it's only ever shown up as a prerequisite. */
function buildNameMap(
  edges: SkillGraphEdge[],
  mastery: MasteryResult[],
  forwardLookingGaps: ForwardLookingGap[]
): Map<string, string> {
  const names = new Map<string, string>();
  for (const edge of edges) {
    names.set(edge.topicSlug, edge.topicName);
    names.set(edge.prerequisiteSlug, edge.prerequisiteName);
  }
  for (const m of mastery) names.set(m.topicSlug, m.topicName);
  for (const g of forwardLookingGaps) names.set(g.topicSlug, g.topicName);
  return names;
}

/**
 * Topological depth for every topic in `slugs`: 0 for a topic with
 * no known prerequisites, otherwise 1 + the deepest of its direct
 * prerequisites. Deliberately uses *every* edge regardless of Phase
 * 4's `minPrerequisiteStrength` — this is a structural "what order
 * does the curriculum go in" question, not a diagnostic "is this
 * weakness explained by that prerequisite" one, so it shouldn't be
 * filtered by the same threshold. This is what lays the roadmap out
 * as a visual progression rather than a flat list.
 */
function computeTiers(slugs: Set<string>, edges: SkillGraphEdge[]): Map<string, number> {
  const directPrereqs = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!directPrereqs.has(edge.topicSlug)) directPrereqs.set(edge.topicSlug, new Set());
    directPrereqs.get(edge.topicSlug)!.add(edge.prerequisiteSlug);
  }

  const tiers = new Map<string, number>();
  const visiting = new Set<string>(); // cycle guard — the curated graph is a DAG, but a future edit could break that, and a stack overflow is a worse failure mode than a wrong tier

  function tierOf(slug: string): number {
    const cached = tiers.get(slug);
    if (cached !== undefined) return cached;
    if (visiting.has(slug)) return 0;
    visiting.add(slug);
    const prereqs = directPrereqs.get(slug);
    const tier = prereqs && prereqs.size > 0 ? 1 + Math.max(...[...prereqs].map((p) => tierOf(p))) : 0;
    visiting.delete(slug);
    tiers.set(slug, tier);
    return tier;
  }

  for (const slug of slugs) tierOf(slug);
  return tiers;
}

function toPrerequisites(
  edges: SkillGraphEdge[],
  topicSlug: string,
  weakSlugs: Set<string>
): RoadmapPrerequisite[] {
  return getPrerequisites(edges, topicSlug).map((edge) => ({
    topicSlug: edge.prerequisiteSlug,
    topicName: edge.prerequisiteName,
    isWeak: weakSlugs.has(edge.prerequisiteSlug),
  }));
}

/**
 * The reason string for a "Recommended Next" node. Deliberately
 * doesn't claim the prerequisites are confirmed strong — only that
 * nothing in the student's data currently flags them as weak, the
 * same "never overclaim from sparse data" discipline the rest of
 * the engine follows. Mirrors gap-detection's "solid" phrasing
 * ("No prerequisite concerns for X right now") so the voice is
 * consistent whether a topic is being cleared for practice
 * (here) or cleared of blame (gap-detection).
 */
function buildRecommendedNextReason(topicName: string, prerequisites: RoadmapPrerequisite[], dependentCount: number): string {
  const prereqPhrase =
    prerequisites.length === 0
      ? "it has no tracked prerequisites"
      : `none of its prerequisites (${joinNames(prerequisites.map((p) => p.topicName))}) show up as weak in your data`;
  const dependentPhrase =
    dependentCount > 0
      ? ` Building it up will also help with ${dependentCount} other topic${dependentCount === 1 ? "" : "s"} that lead on from it.`
      : "";
  return `No prerequisite concerns for ${topicName} right now — ${prereqPhrase}, so it's a reasonable next topic.${dependentPhrase}`;
}

function statusRank(status: RoadmapStatus): number {
  // Lower first within a tier: attention-worthy statuses read before comfortable ones.
  const order: RoadmapStatus[] = [
    "Fundamental Gap",
    "Weak",
    "Postponed",
    "Revision Needed",
    "Under-Practiced",
    "Recommended Next",
    "Emerging",
    "Strong",
  ];
  const index = order.indexOf(status);
  return index === -1 ? order.length : index;
}

function sortTopics(topics: RoadmapTopic[]): RoadmapTopic[] {
  return [...topics].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (statusRank(a.status) !== statusRank(b.status)) return statusRank(a.status) - statusRank(b.status);
    return a.topicName.localeCompare(b.topicName);
  });
}

/**
 * Picks a single highlighted "work on this next" topic out of the
 * full Recommended Next group. Foundational (lower-tier) topics win
 * first — no point highlighting something three tiers deep while an
 * earlier topic is still unstarted — then the one that unblocks the
 * most other topics, so the pick is explainable as "this opens up
 * the most doors", not arbitrary.
 */
function pickRecommendedNextTopic(candidates: RoadmapTopic[], edges: SkillGraphEdge[]): RoadmapTopic | null {
  if (candidates.length === 0) return null;
  const ranked = candidates
    .map((topic) => ({ topic, dependents: getDependents(edges, topic.topicSlug).length }))
    .sort((a, b) => {
      if (a.topic.tier !== b.topic.tier) return a.topic.tier - b.topic.tier;
      if (a.dependents !== b.dependents) return b.dependents - a.dependents;
      return a.topic.topicName.localeCompare(b.topic.topicName);
    });
  return ranked[0].topic;
}

/**
 * Builds the personalized DSA roadmap: one node per topic the
 * engine has anything to say about, tiered into a visual
 * progression, and grouped into the 7 categories the brief asks
 * for. Pure — no DB, no network, entirely derived from what the
 * rest of the analytics engine already computed this run (mastery,
 * gap detection, forward-looking gaps) plus the skill graph. Two
 * students with different histories get different roadmaps because
 * `input` is different, never because of any per-user branching in
 * this file — there is none.
 */
export function buildRoadmap(input: RoadmapInput): RoadmapResult {
  const { mastery, forwardLookingGaps, topicRelationships: edges, now } = input;

  const names = buildNameMap(edges, mastery, forwardLookingGaps);
  const graphSlugs = getAllGraphTopicSlugs(edges);
  const masteryBySlug = new Map(mastery.map((m) => [m.topicSlug, m]));
  const gapBySlug = new Map(forwardLookingGaps.map((g) => [g.topicSlug, g]));

  const allSlugs = new Set<string>([...graphSlugs, ...masteryBySlug.keys()]);
  const tiers = computeTiers(allSlugs, edges);

  const topics: RoadmapTopic[] = [];

  for (const slug of allSlugs) {
    const topicName = names.get(slug) ?? slug;
    const tier = tiers.get(slug) ?? 0;
    const m = masteryBySlug.get(slug);

    if (m) {
      const weakSlugs = new Set(m.weakPrerequisites.map((w) => w.topicSlug));
      const isPrerequisiteGap = m.gapVerdict === "prerequisite-gap";
      topics.push({
        topicSlug: slug,
        topicName,
        tier,
        status: m.classification,
        masteryScore: m.masteryScore,
        confidence: m.confidence,
        prerequisites: toPrerequisites(edges, slug, weakSlugs),
        recommendedAction: ACTION_BY_CLASSIFICATION[m.classification],
        actionReason: isPrerequisiteGap ? m.gapExplanation : m.explanation,
        isPrerequisiteGap,
      });
      continue;
    }

    // No evidence at all — only reachable for graph topics (forwardLookingGaps and
    // the "recommended next" candidates below are both graph-derived concepts).
    const gap = gapBySlug.get(slug);
    if (gap) {
      const weakSlugs = new Set(gap.weakPrerequisites.map((w) => w.topicSlug));
      topics.push({
        topicSlug: slug,
        topicName,
        tier,
        status: "Postponed",
        masteryScore: null,
        confidence: "None",
        prerequisites: toPrerequisites(edges, slug, weakSlugs),
        recommendedAction: "Hold off",
        actionReason: gap.explanation,
        isPrerequisiteGap: false,
      });
      continue;
    }

    const prerequisites = toPrerequisites(edges, slug, new Set());
    const dependentCount = getDependents(edges, slug).length;
    topics.push({
      topicSlug: slug,
      topicName,
      tier,
      status: "Recommended Next",
      masteryScore: null,
      confidence: "None",
      prerequisites,
      recommendedAction: "Start here",
      actionReason: buildRecommendedNextReason(topicName, prerequisites, dependentCount),
      isPrerequisiteGap: false,
    });
  }

  const sortedTopics = sortTopics(topics);

  const tierGroups = new Map<number, RoadmapTopic[]>();
  for (const topic of sortedTopics) {
    const list = tierGroups.get(topic.tier) ?? [];
    list.push(topic);
    tierGroups.set(topic.tier, list);
  }
  const tierList: RoadmapTier[] = [...tierGroups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([tier, tierTopics]) => ({ tier, topics: tierTopics }));

  const byMasteryAsc = (a: RoadmapTopic, b: RoadmapTopic) => (a.masteryScore ?? 0) - (b.masteryScore ?? 0);
  const byMasteryDesc = (a: RoadmapTopic, b: RoadmapTopic) => (b.masteryScore ?? 0) - (a.masteryScore ?? 0);

  const groups: RoadmapGroups = {
    strong: sortedTopics.filter((t) => t.status === "Strong").sort(byMasteryDesc),
    revisionNeeded: sortedTopics.filter((t) => t.status === "Revision Needed").sort(byMasteryAsc),
    weak: sortedTopics.filter((t) => t.status === "Weak").sort(byMasteryAsc),
    fundamentalGaps: sortedTopics.filter((t) => t.status === "Fundamental Gap").sort(byMasteryAsc),
    prerequisiteTopics: sortedTopics.filter((t) => t.isPrerequisiteGap).sort(byMasteryAsc),
    recommendedNext: sortedTopics.filter((t) => t.status === "Recommended Next"),
    postponed: sortedTopics.filter((t) => t.status === "Postponed"),
  };

  return {
    topics: sortedTopics,
    tiers: tierList,
    groups,
    recommendedNextTopic: pickRecommendedNextTopic(groups.recommendedNext, edges),
    generatedAt: now,
  };
}
