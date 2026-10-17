import type { BadgeVariant } from "@/lib/dashboard-format";
import type { RoadmapTopic } from "@/lib/roadmap/types";

/**
 * Presentation helpers for the Roadmap's interactive skill map.
 *
 * Pure and I/O-free like everything else under src/lib: nothing here
 * decides what a topic's status or score IS (that stays in
 * roadmap-builder.ts) — it only decides how the already-computed
 * topics are grouped into filter chips, counted, and linked together
 * for hover/selection in the UI.
 */

export type RoadmapFilterKey =
  | "strong"
  | "emerging"
  | "underPracticed"
  | "revision"
  | "weak"
  | "gap"
  | "next"
  | "postponed"
  | "prereq";

export type RoadmapFilterDef = {
  key: RoadmapFilterKey;
  /** Short chip label — the count is appended by the UI. */
  label: string;
  /** Same color the topic's badge uses elsewhere in the app, so the chip doubles as the legend. */
  variant: BadgeVariant;
  /** Hollow dot for the two zero-evidence statuses (nothing measured yet), solid for everything else. */
  hollow: boolean;
  /** True for the filters that split topics by status — every topic matches exactly one of them. False for the prerequisite overlay, which cuts across the others. */
  partition: boolean;
  /** One-line meaning, shown as a tooltip instead of a paragraph under each group. */
  description: string;
  matches: (topic: RoadmapTopic) => boolean;
};

/** Display order: good → needs-work → not-started, then the overlay last. Also the status bar's segment order. */
export const ROADMAP_FILTERS: RoadmapFilterDef[] = [
  {
    key: "strong",
    label: "Strong",
    variant: "success",
    hollow: false,
    partition: true,
    description: "Holding up well under real evidence — the goal here is just to maintain it.",
    matches: (t) => t.status === "Strong",
  },
  {
    key: "emerging",
    label: "Emerging",
    variant: "brand",
    hollow: false,
    partition: true,
    description: "Below the Strong bar, but recent activity here is picking up.",
    matches: (t) => t.status === "Emerging",
  },
  {
    key: "underPracticed",
    label: "Under-practiced",
    variant: "neutral",
    hollow: false,
    partition: true,
    description: "Not enough evidence yet to assess this topic confidently.",
    matches: (t) => t.status === "Under-Practiced",
  },
  {
    key: "revision",
    label: "Revision",
    variant: "warning",
    hollow: false,
    partition: true,
    description: "Was solid overall, but it's been a while since it was touched.",
    matches: (t) => t.status === "Revision Needed",
  },
  {
    key: "weak",
    label: "Weak",
    variant: "warning",
    hollow: false,
    partition: true,
    description: "Enough evidence to judge, and the signal isn't strong yet.",
    matches: (t) => t.status === "Weak",
  },
  {
    key: "gap",
    label: "Gap",
    variant: "danger",
    hollow: false,
    partition: true,
    description: "Enough attempts to judge, and the gap looks real — not just inexperience.",
    matches: (t) => t.status === "Fundamental Gap",
  },
  {
    key: "next",
    label: "Next",
    variant: "brand",
    hollow: true,
    partition: true,
    description: "No evidence yet, but nothing in the graph says to hold off — reasonable topics to start.",
    matches: (t) => t.status === "Recommended Next",
  },
  {
    key: "postponed",
    label: "Postponed",
    variant: "neutral",
    hollow: true,
    partition: true,
    description: "No evidence yet, and a prerequisite is currently weak — worth waiting on until that firms up.",
    matches: (t) => t.status === "Postponed",
  },
  {
    key: "prereq",
    label: "Prereq gap",
    variant: "danger",
    hollow: false,
    partition: false,
    description:
      "A root-cause view: weakness that traces back to a shaky prerequisite. A topic can appear here and under its own status.",
    matches: (t) => t.isPrerequisiteGap,
  },
];

const FILTER_BY_KEY = new Map<RoadmapFilterKey, RoadmapFilterDef>(ROADMAP_FILTERS.map((f) => [f.key, f]));

export function getFilterDef(key: RoadmapFilterKey): RoadmapFilterDef {
  // Every key in the union is in ROADMAP_FILTERS, so this can't be undefined at runtime.
  return FILTER_BY_KEY.get(key)!;
}

/** `null` means "no filter active" — everything matches. */
export function topicMatchesFilter(topic: RoadmapTopic, filter: RoadmapFilterKey | null): boolean {
  if (filter === null) return true;
  return getFilterDef(filter).matches(topic);
}

export function countByFilter(topics: RoadmapTopic[]): Record<RoadmapFilterKey, number> {
  const counts = Object.fromEntries(ROADMAP_FILTERS.map((f) => [f.key, 0])) as Record<RoadmapFilterKey, number>;
  for (const topic of topics) {
    for (const filter of ROADMAP_FILTERS) {
      if (filter.matches(topic)) counts[filter.key] += 1;
    }
  }
  return counts;
}

/** A topic with no score yet (Recommended Next / Postponed) — the UI shows no bar for these rather than a misleading 0. */
export function hasEvidence(topic: RoadmapTopic): boolean {
  return topic.masteryScore !== null;
}

export function buildTopicIndex(topics: RoadmapTopic[]): Map<string, RoadmapTopic> {
  return new Map(topics.map((t) => [t.topicSlug, t]));
}

/**
 * The reverse of `prerequisites`: for each topic, the topics that
 * list it as a prerequisite ("what this unlocks"). Derived purely from
 * the topics already on the roadmap — no extra data needed. Every
 * topic gets an entry (possibly empty), and each list keeps the
 * input's order (tier, then name).
 */
export function buildUnlocksMap(topics: RoadmapTopic[]): Map<string, RoadmapTopic[]> {
  const unlocks = new Map<string, RoadmapTopic[]>(topics.map((t) => [t.topicSlug, []]));
  for (const topic of topics) {
    for (const prerequisite of topic.prerequisites) {
      const list = unlocks.get(prerequisite.topicSlug);
      if (list) list.push(topic);
    }
  }
  return unlocks;
}

/**
 * The full prerequisite chain behind a topic (`upstream`: everything
 * it ultimately depends on) and everything it eventually leads to
 * (`downstream`). Used for the hover spotlight. The graph is a small
 * DAG, but the visited sets also make this safe against a cycle
 * slipping in via a future graph edit. The topic itself is never in
 * either set.
 */
export function getChain(
  slug: string,
  topicsBySlug: Map<string, RoadmapTopic>,
  unlocks: Map<string, RoadmapTopic[]>
): { upstream: Set<string>; downstream: Set<string> } {
  const upstream = new Set<string>();
  const upstreamQueue = [slug];
  while (upstreamQueue.length > 0) {
    const current = upstreamQueue.pop()!;
    for (const prerequisite of topicsBySlug.get(current)?.prerequisites ?? []) {
      if (prerequisite.topicSlug === slug || upstream.has(prerequisite.topicSlug)) continue;
      upstream.add(prerequisite.topicSlug);
      upstreamQueue.push(prerequisite.topicSlug);
    }
  }

  const downstream = new Set<string>();
  const downstreamQueue = [slug];
  while (downstreamQueue.length > 0) {
    const current = downstreamQueue.pop()!;
    for (const dependent of unlocks.get(current) ?? []) {
      if (dependent.topicSlug === slug || downstream.has(dependent.topicSlug)) continue;
      downstream.add(dependent.topicSlug);
      downstreamQueue.push(dependent.topicSlug);
    }
  }

  return { upstream, downstream };
}