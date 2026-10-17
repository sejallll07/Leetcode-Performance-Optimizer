import { ANALYTICS_CONFIG } from "@/lib/analytics/config";
import type { RoadmapTopic } from "@/lib/roadmap/types";

/**
 * Student-facing structure for the Roadmap: which topics are part of
 * the curated progression and which stage each belongs to, a
 * "where you are" summary, and what "ready to move on" means for a
 * topic.
 *
 * Pure and I/O-free. Nothing here scores, classifies or reorders
 * anything — it only labels and groups what the roadmap builder
 * already computed, and the one threshold it quotes (the Strong
 * bar) is read from the analytics config rather than redefined.
 */

// ---------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------

export type RoadmapStage = {
  /** 1-based, = the builder's tier + 1 (the longest prerequisite chain behind these topics, counting itself). */
  level: number;
  label: string;
  /** One short student-facing line on what this stage means. */
  description: string;
  topics: RoadmapTopic[];
  /** Topics in this stage that are currently Strong. */
  strongCount: number;
  /** Topics in this stage with any evidence at all (a score). */
  startedCount: number;
};

const NAMED_STAGES: { label: string; description: string }[] = [
  { label: "Foundations", description: "Core topics with no prerequisite in your roadmap." },
  { label: "Build", description: "Topics that build on foundation skills." },
  { label: "Advance", description: "Topics that combine or depend on multiple skills." },
];

/**
 * Name and meaning for a stage level. The first three are named;
 * any deeper level (the graph can grow) keeps the same principle
 * with a clear label instead of a bare tier number.
 */
export function getStageMeta(level: number): { label: string; description: string } {
  const named = NAMED_STAGES[level - 1];
  if (named) return named;
  return { label: `Advanced · Level ${level}`, description: "Topics that build further on Advance skills." };
}

/**
 * True for topics that are part of the curated skill graph: they
 * have a prerequisite, or something else lists them as one. Topics
 * the student has practiced that the graph doesn't know about (Hash
 * Table, String, Math…) have no edges at all and all land in tier 0
 * of the roadmap — which is why they have to be told apart here or
 * they swamp the first stage.
 */
export function isCoreTopic(topic: RoadmapTopic, unlocks: Map<string, RoadmapTopic[]>): boolean {
  return topic.prerequisites.length > 0 || (unlocks.get(topic.topicSlug)?.length ?? 0) > 0;
}

/**
 * Groups the curated-graph topics into stages by their roadmap tier,
 * and returns everything else separately. Stage order is ascending
 * tier; a tier with no curated topics produces no stage. Topic order
 * within a stage is preserved from the input.
 */
export function buildStages(
  topics: RoadmapTopic[],
  unlocks: Map<string, RoadmapTopic[]>
): { stages: RoadmapStage[]; otherTopics: RoadmapTopic[] } {
  const byTier = new Map<number, RoadmapTopic[]>();
  const otherTopics: RoadmapTopic[] = [];

  for (const topic of topics) {
    if (!isCoreTopic(topic, unlocks)) {
      otherTopics.push(topic);
      continue;
    }
    const list = byTier.get(topic.tier);
    if (list) list.push(topic);
    else byTier.set(topic.tier, [topic]);
  }

  const stages = [...byTier.entries()]
    .sort(([a], [b]) => a - b)
    .map(([tier, stageTopics]): RoadmapStage => {
      const level = tier + 1;
      return {
        level,
        ...getStageMeta(level),
        topics: stageTopics,
        strongCount: stageTopics.filter((t) => t.status === "Strong").length,
        startedCount: stageTopics.filter((t) => t.masteryScore !== null).length,
      };
    });

  return { stages, otherTopics };
}

// ---------------------------------------------------------------------
// Where you are
// ---------------------------------------------------------------------

export type PositionSummary = {
  /** Curated-graph topics, and how many of them are Strong / have any evidence. */
  coreTotal: number;
  coreStrong: number;
  coreStarted: number;
  coreNotStarted: number;
  /** Topics outside the curated graph that the student has practiced. */
  otherTotal: number;
  /** Everything (graph or not) that needs work, most urgent first: Fundamental Gap, then Weak, then Revision Needed; lowest mastery first within each. */
  needsAttention: RoadmapTopic[];
};

const ATTENTION_ORDER: Partial<Record<RoadmapTopic["status"], number>> = {
  "Fundamental Gap": 0,
  Weak: 1,
  "Revision Needed": 2,
};

export function summarizePosition(topics: RoadmapTopic[], unlocks: Map<string, RoadmapTopic[]>): PositionSummary {
  const core = topics.filter((t) => isCoreTopic(t, unlocks));

  const needsAttention = topics
    .filter((t) => ATTENTION_ORDER[t.status] !== undefined)
    .sort(
      (a, b) =>
        ATTENTION_ORDER[a.status]! - ATTENTION_ORDER[b.status]! || (a.masteryScore ?? 0) - (b.masteryScore ?? 0)
    );

  const coreStarted = core.filter((t) => t.masteryScore !== null).length;

  return {
    coreTotal: core.length,
    coreStrong: core.filter((t) => t.status === "Strong").length,
    coreStarted,
    coreNotStarted: core.length - coreStarted,
    otherTotal: topics.length - core.length,
    needsAttention,
  };
}

// ---------------------------------------------------------------------
// Ready to move on
// ---------------------------------------------------------------------

/**
 * What "done with this topic" looks like for the student, using the
 * engine's own Strong bar. Mirrors the classification rules in
 * mastery.ts without re-deciding anything: a topic is Strong at
 * `target` or above AND with enough evidence AND recent practice, so
 * the cases below are the ways a topic can fall short of that.
 */
export type MoveOnProgress =
  /** Nothing practiced yet — there's no score to move. */
  | { kind: "no-evidence"; target: number }
  /** Already Strong. */
  | { kind: "reached"; score: number; target: number }
  /** Score is already at the bar, but the practice is stale — a refresher restores Strong. */
  | { kind: "needs-refresh"; score: number; target: number; staleAfterDays: number }
  /** Too little evidence to trust the score yet (the engine calls this Under-Practiced). */
  | { kind: "needs-evidence"; score: number; target: number }
  /** A real score below the bar — `pointsToGo` is the gap to it. */
  | { kind: "building"; score: number; target: number; pointsToGo: number };

export function getMoveOnProgress(topic: RoadmapTopic): MoveOnProgress {
  const target = ANALYTICS_CONFIG.mastery.strongThreshold;
  if (topic.masteryScore === null) return { kind: "no-evidence", target };

  const score = Math.round(topic.masteryScore);

  switch (topic.status) {
    case "Strong":
      return { kind: "reached", score, target };
    case "Revision Needed":
      return { kind: "needs-refresh", score, target, staleAfterDays: ANALYTICS_CONFIG.recency.staleAfterDays };
    case "Under-Practiced":
      return { kind: "needs-evidence", score, target };
    default:
      return { kind: "building", score, target, pointsToGo: Math.max(0, target - score) };
  }
}