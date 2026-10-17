/**
 * Every tunable number the analytics engine uses, in one place.
 * Nothing in src/lib/analytics/*.ts should hardcode a threshold —
 * import it from here instead. This is what "explainable" means in
 * practice: any score can be traced back to a named constant, and
 * tuning the engine means editing this file, not hunting through
 * scoring logic.
 *
 * IMPORTANT CONTEXT for every threshold below: because ingestion
 * (Phase 2) only pulls each user's ~20 most recent *accepted*
 * submissions — not their full history, and not failed attempts —
 * everything here is scored against a sample, not a complete
 * record. The confidence thresholds exist specifically to keep the
 * engine honest about that (see PROJECT_STATUS.md).
 */
export const ANALYTICS_CONFIG = {
  /** How many of a user's sampled submissions must touch a topic
   *  before we're willing to say anything confident about it. */
  confidence: {
    lowMaxProblems: 1, // 0-1 problems seen -> Low
    mediumMaxProblems: 4, // 2-4 problems seen -> Medium; 5+ -> High
  },

  /** Mastery score (0-100) bands used for classification. */
  mastery: {
    strongThreshold: 70,
    fundamentalGapThreshold: 25,
  },

  /** How "fresh" a topic's most recent practice needs to be. */
  recency: {
    /** Beyond this many days since last practice, a Strong topic
     *  becomes "Revision Needed" instead. */
    staleAfterDays: 45,
    /** A topic counts as "Emerging" only if its activity is
     *  concentrated within this recent a window. */
    emergingWindowDays: 14,
    /** Decay constant for the recency sub-score: recencyScore =
     *  exp(-daysSinceLastPracticed / decayDays). */
    decayDays: 30,
  },

  /** How many accepted problems in a topic count as "full" exposure
   *  for the exposure sub-score (used as a denominator, capped at 1). */
  exposure: {
    targetProblemCount: 6,
  },

  /** Weights for the four mastery sub-scores. Must sum to 1. */
  weights: {
    exposure: 0.4,
    difficulty: 0.3,
    recency: 0.2,
    diversity: 0.1,
  },

  /** Phase 4: how the skill graph is allowed to reinterpret a raw classification. */
  skillGraph: {
    /** A prerequisite only "counts" toward explaining a topic's
     *  weakness if the edge is at least this strong — a loose,
     *  incidental relationship shouldn't get blamed. */
    minPrerequisiteStrength: 0.5,
    /** Raw classifications gap detection treats as "shaky" — both
     *  for the topic itself and for a prerequisite being weak. */
    shakyClassifications: ["Weak", "Fundamental Gap"] as const,
  },

  /** Phase 5: the dashboard's readiness score/level. */
  readiness: {
    /** Topics with evidence at or above this many count toward
     *  "breadth" — Under-Practiced topics don't, since we can't
     *  confidently score them yet. */
    breadthTargetTopics: 8,
    /** Readiness = avgMastery * (breadthFloor + (1-breadthFloor) * breadthRatio).
     *  Thin breadth can cut the score, but never below this floor
     *  fraction of the raw average — one excellent topic still
     *  counts for something. */
    breadthFloor: 0.5,
    levels: [
      { max: 24, label: "Just Starting" },
      { max: 49, label: "Building Fundamentals" },
      { max: 74, label: "Solid Foundation" },
      { max: 100, label: "Strong Across Topics" },
    ],
  },

  /** Phase 5: "am I improving?" — comparing the two most recent
   *  computation generations per topic. */
  progressTrend: {
    /** Average mastery-point delta below which we call it "steady"
     *  rather than improving/declining — avoids reading noise as a trend. */
    steadyBandPoints: 3,
  },

  /** Phase 5: "what should I do next?" — how many action items to surface. */
  nextActions: {
    maxItems: 5,
  },

  /** Phase 6: the practice recommendation engine. */
  recommendations: {
    /** Hard ceiling on the full recommendation list — "avoid excessive numbers of problems". */
    maxTotal: 8,
    /** No more than this many recommendations from the same topic, so
     *  one weak area doesn't crowd out everything else. */
    maxPerTopic: 2,
    /** Size of the "Practice Today" digest — intentionally small. */
    practiceTodayCount: 3,
  },
} as const;

// Fails fast in dev if someone changes the weights without keeping
// them normalized — cheaper than a silently-wrong mastery score.
const weightSum = Object.values(ANALYTICS_CONFIG.weights).reduce((a, b) => a + b, 0);
if (Math.abs(weightSum - 1) > 1e-9) {
  throw new Error(`ANALYTICS_CONFIG.weights must sum to 1, got ${weightSum}`);
}
