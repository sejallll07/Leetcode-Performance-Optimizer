import type { Confidence, TopicClassification } from "@/lib/analytics/types";

/**
 * Every roadmap topic gets one of Phase 3's six classifications
 * (when there's evidence to classify), or one of two roadmap-only
 * statuses for topics the student hasn't touched at all yet.
 * "Postponed" reuses the exact same reasoning as Phase 4's
 * forward-looking gaps (a weak, evidenced prerequisite); "Recommended
 * Next" is its mirror image — zero evidence, but nothing in the
 * graph says to hold off.
 */
export type RoadmapStatus = TopicClassification | "Recommended Next" | "Postponed";

export type RoadmapAction =
  | "Maintain"
  | "Revise"
  | "Practice"
  | "Learn fundamentals"
  | "Collect more evidence"
  | "Keep practicing"
  | "Start here"
  | "Hold off";

export type RoadmapPrerequisite = {
  topicSlug: string;
  topicName: string;
  /** True when this prerequisite itself has evidence and is currently shaky — the same signal Phase 4 uses. Always false when there's no evidence either way (not "confirmed fine", just "nothing says otherwise"). */
  isWeak: boolean;
};

export type RoadmapTopic = {
  topicSlug: string;
  topicName: string;
  /** 0-based topological depth in the skill graph (0 = no prerequisites) — the axis the roadmap's tiered visual progression is laid out on. Structural, not diagnostic: computed from every edge touching this topic, regardless of Phase 4's strength threshold. */
  tier: number;
  status: RoadmapStatus;
  /** null for the two zero-evidence statuses — there's no score to show yet, and showing 0 would misleadingly read as "assessed and bad". */
  masteryScore: number | null;
  confidence: Confidence | "None";
  prerequisites: RoadmapPrerequisite[];
  recommendedAction: RoadmapAction;
  /** Always lifted from an explanation string the engine already computed elsewhere (mastery.explanation, gapDetection's gapExplanation, or a forwardLookingGap's explanation) — same discipline as next-actions.ts, so nothing here says anything the rest of the app hasn't already justified. */
  actionReason: string;
    /** Phase 4's gapVerdict, reduced to a single flag: true when this topic's weakness traces back to a shaky prerequisite. Orthogonal to `status` — a topic can be "Weak" without this being true (the weakness is its own), or this can be true for a topic not otherwise flagged as weak. Mirrors how the Dashboard's Fundamentals tab already treats prerequisite gaps as a root-cause overlay, not a replacement classification. */
  isPrerequisiteGap: boolean;
};

export type RoadmapTier = { tier: number; topics: RoadmapTopic[] };

export type RoadmapGroups = {
  /** Topics already strong. */
  strong: RoadmapTopic[];
  /** Topics requiring revision. */
  revisionNeeded: RoadmapTopic[];
  /** Weak topics. */
  weak: RoadmapTopic[];
  /** Fundamental gaps. */
  fundamentalGaps: RoadmapTopic[];
  /** Prerequisite topics — evidenced topics whose weakness traces to a shaky prerequisite (isPrerequisiteGap). An overlay: entries here may also appear in weak/fundamentalGaps above, deliberately — same "different lens, explicitly labeled" pattern as the dashboard's Fundamentals card. */
  prerequisiteTopics: RoadmapTopic[];
  /** Recommended next topics — zero evidence, prerequisites clear. */
  recommendedNext: RoadmapTopic[];
  /** Topics that should be postponed — zero evidence, a prerequisite is currently weak. Identical population to AnalyticsEngineResult.forwardLookingGaps, reshaped as roadmap nodes. */
  postponed: RoadmapTopic[];
};

export type RoadmapResult = {
  /** One row per topic the roadmap has anything to say about — every classified topic, plus every skill-graph topic (evidenced or not). Sorted by tier, then name; this is what `tiers` and `groups` below are both derived from, never a second, separately-computed list. */
  topics: RoadmapTopic[];
  /** The same topics grouped tier by tier — the roadmap's visual progression. */
  tiers: RoadmapTier[];
  groups: RoadmapGroups;
  /** A single confident "work on this next" pick from `groups.recommendedNext`, for a highlighted card — null when there's no zero-evidence topic the graph is currently comfortable recommending. */
  recommendedNextTopic: RoadmapTopic | null;
  generatedAt: Date;
};
