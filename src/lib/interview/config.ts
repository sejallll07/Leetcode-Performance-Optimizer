/**
 * Every tunable number the interview readiness + mock interview
 * engines use, in one place — same convention as
 * src/lib/analytics/config.ts, src/lib/revision/config.ts,
 * src/lib/mentor/config.ts, src/lib/reports/config.ts.
 */
export const INTERVIEW_CONFIG = {
  /** Weights for the 8 named readiness factors — must sum to 1 (checked below, same fail-fast pattern ANALYTICS_CONFIG uses for its own weights). Breadth/depth/medium-performance/weak-topic-count get the heaviest weight as the most direct signals; hard exposure, recency, revision, and activity consistency are supporting signals rather than primary drivers — a student can be genuinely interview-capable without much Hard-problem exposure specifically. */
  weights: {
    topicBreadth: 0.15,
    topicDepth: 0.15,
    mediumPerformance: 0.15,
    hardExposure: 0.1,
    weakTopicCount: 0.15,
    recentPerformance: 0.1,
    revisionConsistency: 0.1,
    problemSolvingConsistency: 0.1,
  },

  /** Deliberately avoids the word "Ready" outright — the spec's own instruction not to imply a guarantee applies to this label too, not just the mock-interview report. */
  levels: [
    { max: 24, label: "Just Starting" },
    { max: 49, label: "Building Readiness" },
    { max: 74, label: "Solid Progress" },
    { max: 100, label: "Well Prepared" },
  ],

  /** How many topics with real evidence count as "full" breadth for the topicBreadth factor — same target ANALYTICS_CONFIG.readiness uses, so the two scores stay conceptually aligned even though they're computed separately. */
  breadthTargetTopics: 8,

  /** Tiered, not linear — even a couple of Hard solves is meaningful interview signal; this shouldn't need dozens to register. Each tier's score, keyed by the *minimum* Hard-problem count that reaches it. */
  hardExposureTiers: [
    { minCount: 6, score: 100 },
    { minCount: 3, score: 70 },
    { minCount: 1, score: 40 },
    { minCount: 0, score: 0 },
  ],

  /** Per-weak-topic penalty for the weakTopicCount factor (Weak + Fundamental Gap combined), off a 100 base. */
  weakTopicPenaltyPerTopic: 12,

  /** Rolling window for "recent" activity — both recentPerformance and problemSolvingConsistency look back this far. */
  recentWindowDays: 30,

  /** recentPerformance blends "how much recent activity" (submission count against this target) with "how much of it was beyond Easy" — both capped/normalized to 0-100. */
  recentActivityTargetSubmissions: 8,

  /** problemSolvingConsistency = distinct active days in the window against this target, capped at 100. Deliberately well under recentWindowDays — solving on roughly a third of days reads as consistent, not daily grinding. */
  consistencyTargetActiveDays: 10,

  /** revisionConsistency = 100 * completed / (completed + currentlyOverdue), clamped. When there's no revision history at all yet (both 0), the factor is scored neutrally rather than 0 — no data isn't the same as bad data. */
  revisionConsistencyNeutralScore: 50,

  /** Suggested time budget per problem role, in minutes — shown to the student as guidance, and used to compute ProblemPerformance.withinSuggestedTime. Not enforced (self-reported, not timed by the app). */
  suggestedTimeMinutes: {
    warmup: 10,
    medium: 20,
    stretch: 30,
  },

  /** Thresholds (on evidencedTopicCount and Strong-topic count) for whether the "stretch" slot leans Hard vs. stays Medium — see problem-selection.ts. */
  stretchDifficulty: {
    minEvidencedTopicsForHard: 5,
    minStrongTopicsForHard: 2,
  },

  /** How many recent mock-interview sessions' problems to avoid repeating. */
  avoidRepeatFromLastNSessions: 3,

  /** The AI narration layer (see src/services/interview/) reuses the exact same ClaudeReportNarrator/FakeReportNarrator classes Phase 10 built — the interface is domain-agnostic (prompt in, {summary, highlights, advice} out), so a second, near-identical provider pair isn't worth the duplication. Model/timeout/token settings are shared from REPORTS_CONFIG.narrator rather than duplicated here. */
} as const;

const weightSum = Object.values(INTERVIEW_CONFIG.weights).reduce((a, b) => a + b, 0);
if (Math.abs(weightSum - 1) > 1e-9) {
  throw new Error(`INTERVIEW_CONFIG.weights must sum to 1, got ${weightSum}`);
}
