import type { Difficulty, TopicClassification } from "@/lib/analytics/types";
import type { RoadmapStatus } from "@/lib/roadmap/types";

/**
 * Input/output types for the report engine (Phase 10). Same
 * discipline as src/lib/analytics/types.ts: the engine
 * (report-builder.ts) only ever sees these plain types, never a raw
 * DB row. src/repositories/reports-repository.ts is the only place
 * that translates real data into this shape.
 *
 * Critical scoping note, carried over from ANALYTICS_CONFIG's own
 * comment: `RevisionItem` rows are mutated in place (dueAt moves
 * forward on every review), not versioned — so "how many reviews
 * were scheduled/overdue as of a past date" isn't reconstructable
 * the way mastery snapshots are. Every type below that touches
 * revision scheduling marks the past-period fields explicitly
 * nullable rather than inventing a number for history we don't
 * have. See ReportEngineInput.liveOverdueCount.
 */

export type ReportPeriodType = "WEEKLY" | "MONTHLY";

export type PeriodBounds = {
  type: ReportPeriodType;
  /** Inclusive. */
  start: Date;
  /** Exclusive. */
  end: Date;
  /** e.g. "Sep 22 – Sep 28, 2026" (weekly) or "September 2026" (monthly). */
  label: string;
  /** True when `end` is at or after `now` — the in-progress current period, not a completed past one. Only this period gets live revision-scheduling data (see liveOverdueCount above). */
  isCurrent: boolean;
};

export type ReportProblem = {
  slug: string;
  title: string;
  difficulty: Difficulty;
  topicSlugs: string[];
};

export type DifficultyTrend = "increasing" | "steady" | "insufficient-data";

export type TopicDelta = {
  topicSlug: string;
  topicName: string;
  fromScore: number | null; // null = no snapshot before this window — first evidence this period
  toScore: number;
  delta: number | null; // null when fromScore is null
  toClassification: TopicClassification;
};

// ---------- Weekly ----------

export type NeglectedTopic = {
  topicSlug: string;
  topicName: string;
  classification: TopicClassification;
  daysSincePracticed: number | null;
};

export type ImportantMistake = {
  topicSlug: string;
  topicName: string;
  kind: "difficult-revision" | "mastery-decline";
  detail: string;
};

export type FocusItem = {
  topicSlug: string;
  topicName: string;
  reason: string;
};

export type RevisionPerformance = {
  reviewsCompleted: number;
  feedbackBreakdown: { feedback: "Easy" | "Moderate" | "Difficult"; count: number }[];
  /** Live count of items overdue at window end — only populated for the current, in-progress period (see the file-level note above). Null for a completed past period. */
  currentlyOverdueCount: number | null;
};

export type WeeklyReportInsights = {
  period: PeriodBounds;
  problemsSolved: {
    total: number; // distinct problems
    byDifficulty: { difficulty: Difficulty; count: number }[];
    problems: ReportProblem[];
  };
  topicsPracticed: { topicSlug: string; topicName: string; problemCount: number }[];
  strongestImprovement: (TopicDelta & { delta: number }) | null; // null when no topic has both a before- and after-window snapshot
  weakestArea: { topicSlug: string; topicName: string; masteryScore: number; classification: TopicClassification } | null;
  neglectedTopics: NeglectedTopic[];
  revisionPerformance: RevisionPerformance;
  difficultyProgression: {
    easyCount: number;
    mediumCount: number;
    hardCount: number;
    trend: DifficultyTrend;
  };
  importantMistakes: ImportantMistake[];
  nextWeekFocus: FocusItem[];
};

// ---------- Monthly ----------

export type RoadmapChange = {
  topicSlug: string;
  topicName: string;
  fromGroup: RoadmapStatus;
  toGroup: RoadmapStatus;
};

export type PersistentWeakness = {
  topicSlug: string;
  topicName: string;
  classification: TopicClassification;
  /** Best-effort streak: how many consecutive stored monthly reports (including this one) have flagged this topic as persistently weak. 1 if there's no prior stored monthly report to compare against, or this is the first time it shows up. */
  monthsPersistent: number;
};

export type MonthlyReportInsights = {
  period: PeriodBounds;
  overallProgress: {
    /** Derived: totalSolvedEnd - problemsSolvedThisMonth, not a stored historical value (LeetCodeProfile.totalSolved is a live counter, overwritten on every sync). */
    totalSolvedStart: number;
    totalSolvedEnd: number;
    problemsSolvedThisMonth: number;
    readinessScoreStart: number | null;
    readinessScoreEnd: number;
  };
  masteryChanges: TopicDelta[];
  topicImprovements: TopicDelta[]; // subset of masteryChanges, delta >= config threshold
  decliningTopics: TopicDelta[]; // subset of masteryChanges, delta <= -config threshold
  newlyDevelopedStrengths: { topicSlug: string; topicName: string }[]; // Strong now, wasn't at window start
  persistentWeaknesses: PersistentWeakness[];
  revisionConsistency: RevisionPerformance;
  difficultyProgression: {
    easyCount: number;
    mediumCount: number;
    hardCount: number;
    trend: DifficultyTrend;
  };
  interviewReadinessTrend: {
    scoreStart: number | null;
    scoreEnd: number;
    delta: number | null;
    levelStart: string | null;
    levelEnd: string;
  };
  roadmapChanges: RoadmapChange[];
};

// ---------- Narrative (AI layer — see src/lib/reports/narrative.ts) ----------

/**
 * Natural-language interpretation of the structured insights above.
 * Every field is optional/nullable: a report with insights but no
 * narrative (narrator unavailable or failed) is still a complete,
 * useful report — see ReportResult.narrativeError.
 */
export type ReportNarrative = {
  /** 2-4 sentence overview — the "so what" a student reads first. */
  summary: string;
  /** One line per notable insight already in the structured data — never a new claim, just plain-language framing of what's already computed. */
  highlights: string[];
  /** 1-3 sentences of forward-looking advice, grounded in nextWeekFocus / persistentWeaknesses / roadmapChanges. */
  advice: string;
};

export type ReportResult = {
  periodType: ReportPeriodType;
  insights: WeeklyReportInsights | MonthlyReportInsights;
  narrative: ReportNarrative | null;
  /** Set when narration was attempted but failed — insights are still valid and shown; the UI just skips the narrative section instead of erroring the whole report. */
  narrativeError: string | null;
  generatedAt: Date;
  /** True if this exact period was already generated and stored before — the service returned the saved copy rather than recomputing (see reports-service.ts). */
  fromCache: boolean;
};
