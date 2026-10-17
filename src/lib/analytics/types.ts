/**
 * Input/output types for the analytics engine. The engine itself
 * (basic-analytics.ts, topic-analytics.ts, mastery.ts, engine.ts) is
 * pure — it only ever sees these plain types, never a Prisma/pg row
 * or a Date-from-the-DB quirk. src/services/analytics/analytics-service.ts
 * is the only place that translates real data into this shape, which
 * is what makes the engine trivially unit-testable (see the .test.ts
 * files next to each module).
 */

export type Difficulty = "Easy" | "Medium" | "Hard";

export type SubmissionInput = {
  topicSlugs: string[];
  topicNames: Record<string, string>; // slug -> display name, for convenience
  problemSlug: string;
  problemTitle: string;
  difficulty: Difficulty;
  submittedAt: Date;
};

export type SkillGraphEdge = {
  topicSlug: string;
  topicName: string;
  prerequisiteSlug: string;
  prerequisiteName: string;
  relationshipType: "PREREQUISITE" | "SUBTOPIC";
  strength: number;
};

/** A known problem, either curated (src/lib/analytics/problem-catalog-data.ts)
 *  or one that showed up in *any* user's ingested submissions —
 *  both are seeded into the same `problems` table, see
 *  src/repositories/problem-catalog-repository.ts. */
export type ProblemCatalogEntry = {
  slug: string;
  title: string;
  difficulty: Difficulty;
  topicSlugs: string[];
  /** "high" for well-known interview staples, undefined otherwise — a tiebreaker, not a filter. */
  interviewRelevance?: "high" | "medium";
};

/** Everything the engine needs for one user. Built by analytics-service.ts. */
export type AnalyticsInput = {
  userId: string;
  now: Date; // injected, not `new Date()` inside the engine — makes tests deterministic
  /** LeetCode's own authoritative lifetime counts (from LeetCodeProfile). */
  lifetimeStats: {
    totalSolved: number;
    easySolved: number;
    mediumSolved: number;
    hardSolved: number;
  };
  /** The sampled recent-submissions data we actually ingested. */
  submissions: SubmissionInput[];
  /** The curated DSA skill graph — same for every user (Phase 4). */
  topicRelationships: SkillGraphEdge[];
  /** Every known problem available as a recommendation candidate (Phase 6). */
  problemCatalog: ProblemCatalogEntry[];
};

export type BasicAnalytics = {
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  recentActivity: {
    submissionsLast7Days: number;
    submissionsLast30Days: number;
    mostRecentSubmissionAt: Date | null;
    daysSinceLastSubmission: number | null;
  };
  /** Distribution across the *sampled* submissions only — see sampleCoverage. */
  topicDistribution: { topicSlug: string; topicName: string; count: number }[];
  difficultyDistribution: { difficulty: Difficulty; count: number }[];
  submissionStats: {
    acceptedSubmissionsSampled: number;
    note: string;
  };
  /**
   * "complete" if we appear to have ingested at least as many
   * submissions as the user's lifetime solved count (a light or new
   * user) — "partial" if their real history is clearly bigger than
   * our ~20-submission sample. Everything topic-level below should
   * be read through this lens.
   */
  sampleCoverage: "complete" | "partial";
};

export type Confidence = "Low" | "Medium" | "High";

export type TopicClassification =
  | "Strong"
  | "Revision Needed"
  | "Weak"
  | "Fundamental Gap"
  | "Under-Practiced"
  | "Emerging";

export type TopicAnalytics = {
  topicSlug: string;
  topicName: string;
  problemCount: number;
  difficultyDistribution: { difficulty: Difficulty; count: number }[];
  lastPracticedAt: Date | null;
  daysSinceLastPracticed: number | null;
  /** Distinct difficulty levels touched, out of 3 — a simple proxy for "not just farming easy problems". */
  diversityCount: number;
  /** Explainable proxy for "historical performance" given we only see a recent sample — see PROJECT_STATUS.md. */
  difficultyTrend: "increasing" | "steady" | "insufficient-data";
};

/** What mastery.ts (Phase 3, unchanged) computes — pure scoring, no graph awareness. */
export type RawMasteryResult = {
  topicSlug: string;
  topicName: string;
  masteryScore: number; // 0-100
  confidence: Confidence;
  classification: TopicClassification;
  subScores: {
    exposure: number;
    difficulty: number;
    recency: number;
    diversity: number;
  };
  explanation: string;
};

export type GapVerdict =
  | "solid"
  | "genuinely-weak"
  | "prerequisite-gap"
  | "insufficient-evidence"
  | "not-applicable";

export type WeakPrerequisite = {
  topicSlug: string;
  topicName: string;
  classification: TopicClassification;
  strength: number;
};

/**
 * The full, final per-topic result — Phase 3's raw scoring plus
 * Phase 4's skill-graph-aware read on it. Produced by
 * gap-detection.ts, which takes a RawMasteryResult[] and enriches
 * each one; never constructed by mastery.ts directly.
 */
export type MasteryResult = RawMasteryResult & {
  /**
   * "not-applicable" when the topic has no graph edges, or its raw
   * classification isn't one gap detection has an opinion about
   * (e.g. Strong, Under-Practiced — those already speak for
   * themselves). See src/lib/analytics/gap-detection.ts.
   */
  gapVerdict: GapVerdict;
  gapExplanation: string;
  weakPrerequisites: WeakPrerequisite[];
};

/**
 * A topic the user has *no* sampled evidence for, but which the
 * skill graph can still say something useful about because one of
 * its prerequisites *does* have evidence and is currently weak.
 * E.g. "Tree DP" before the user has attempted any Tree DP problems,
 * but their Tree fundamentals are shaky. Computed by the engine but
 * not persisted this phase — see PROJECT_STATUS.md.
 */
export type ForwardLookingGap = {
  topicSlug: string;
  topicName: string;
  weakPrerequisites: WeakPrerequisite[];
  explanation: string;
};

export type AnalyticsEngineResult = {
  basic: BasicAnalytics;
  topics: TopicAnalytics[];
  mastery: MasteryResult[];
  /** Topics with zero evidence but a weak, evidenced prerequisite — see ForwardLookingGap. */
  forwardLookingGaps: ForwardLookingGap[];
  readiness: ReadinessResult;
  nextActions: NextAction[];
  recommendations: RecommendationResult;
};

export type RecommendationPriority = "High" | "Medium" | "Low";

export type RecommendationKind =
  | "fundamental-gap"
  | "prerequisite-gap"
  | "weak-topic"
  | "revision"
  | "stretch"
  | "diversity";

export type Recommendation = {
  problemSlug: string;
  problemTitle: string;
  difficulty: Difficulty;
  topicSlug: string;
  topicName: string;
  priority: RecommendationPriority;
  kind: RecommendationKind;
  reason: string;
  /** True when this is intentionally a problem the student already solved, recommended again for spaced revision. */
  isRevision: boolean;
};

export type RecommendationResult = {
  /** A small, balanced daily subset of `all` — never the whole list. */
  practiceToday: Recommendation[];
  all: Recommendation[];
};

export type ReadinessResult = {
  score: number; // 0-100
  level: string; // e.g. "Building Fundamentals"
  evidencedTopicCount: number;
  averageMasteryOfEvidenced: number; // 0-100, before the breadth adjustment
  breadthRatio: number; // 0-1
  explanation: string;
};

export type NextActionKind =
  | "fundamental-gap"
  | "prerequisite-gap"
  | "revision"
  | "forward-looking-gap"
  | "weak-topic";

export type NextAction = {
  kind: NextActionKind;
  topicSlug: string;
  topicName: string;
  title: string;
  reason: string; // always traces back to an existing explanation/gapExplanation string
};

export type ProgressTrendStatus = "improving" | "steady" | "declining" | "not-enough-history";

export type ProgressTrend = {
  status: ProgressTrendStatus;
  averageDelta: number | null; // mastery points, latest - previous
  topicsImproved: number;
  topicsDeclined: number;
  comparedTopicCount: number;
  previousComputedAt: Date | null;
  latestComputedAt: Date | null;
  explanation: string;
};
