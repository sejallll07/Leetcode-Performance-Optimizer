import type { Difficulty, ForwardLookingGap, MasteryResult, ProblemCatalogEntry, TopicAnalytics } from "@/lib/analytics/types";

/**
 * Phase 11. Deliberately a *separate* readiness metric from
 * src/lib/analytics/readiness.ts's ReadinessResult — that score is
 * already load-bearing elsewhere (Dashboard, Roadmap, and Reports'
 * interviewReadinessTrend all depend on its current meaning), so
 * this phase doesn't redefine it. This is a purpose-built, more
 * granular "how ready for an interview specifically" read, combining
 * eight named factors instead of the general score's two.
 */

// ---------- Interview Readiness ----------

export type InterviewReadinessFactorKey =
  | "topicBreadth"
  | "topicDepth"
  | "mediumPerformance"
  | "hardExposure"
  | "weakTopicCount"
  | "recentPerformance"
  | "revisionConsistency"
  | "problemSolvingConsistency";

export type InterviewReadinessFactor = {
  key: InterviewReadinessFactorKey;
  label: string;
  /** 0-100. Always framed so higher is better, even for factors phrased negatively in the spec (e.g. "weak-topic count" -> fewer weak topics scores higher). */
  score: number;
  weight: number;
  explanation: string;
};

export type InterviewReadinessResult = {
  /** Weighted 0-100 combination of every factor below. */
  score: number;
  level: string;
  factors: InterviewReadinessFactor[];
  explanation: string;
};

// ---------- Mock Interview: problem selection ----------

export type MockInterviewProblemRole = "warmup" | "medium" | "stretch";

export type MockInterviewProblemPick = {
  role: MockInterviewProblemRole;
  slug: string;
  title: string;
  difficulty: Difficulty;
  topicSlugs: string[];
  topicNames: string[];
  /** Shown to the student — why this specific problem, not just "here are 3 problems". */
  reason: string;
};

// ---------- Mock Interview: self-reported outcomes + performance report ----------

export type MockInterviewOutcome = "Solved" | "Attempted" | "Skipped";

export type MockInterviewProblemOutcome = {
  slug: string;
  outcome: MockInterviewOutcome;
  timeTakenMinutes: number | null;
  usedHints: boolean;
};

export type ProblemPerformance = MockInterviewProblemPick & {
  outcome: MockInterviewOutcome;
  timeTakenMinutes: number | null;
  usedHints: boolean;
  /** Null when not solved or no time was reported — there's nothing to compare against the allotted budget. */
  withinSuggestedTime: boolean | null;
};

export type MockInterviewSessionSummary = "Strong Session" | "Solid Session" | "Mixed Session" | "Tough Session";

export const NO_GUARANTEE_DISCLAIMER =
  "This reflects one practice session, self-reported by you — it's a data point, not a verdict, and it doesn't guarantee how a real interview will go.";

export type MockInterviewPerformanceReport = {
  problems: ProblemPerformance[];
  solvedCount: number;
  attemptedCount: number;
  summary: MockInterviewSessionSummary;
  /** Topics where the student solved cleanly (no hints, within the suggested time) — genuine signal, not just "didn't skip it". */
  strengthsShown: { topicSlug: string; topicName: string }[];
  /** Topics tied to a skipped, unsolved, or hint-assisted problem — worth another look. */
  areasToRevisit: { topicSlug: string; topicName: string }[];
  disclaimer: string;
};

// ---------- Mock Interview: narrative (AI layer, reuses the Phase 10 narrator shape) ----------

export type MockInterviewNarrative = {
  summary: string;
  highlights: string[];
  advice: string;
};

export type MockInterviewSessionResult = {
  sessionId: string;
  status: "IN_PROGRESS" | "COMPLETED";
  problems: MockInterviewProblemPick[];
  startedAt: Date;
  completedAt: Date | null;
  report: MockInterviewPerformanceReport | null;
  narrative: MockInterviewNarrative | null;
  narrativeError: string | null;
};

/** Plain input bundle the pure engines in this folder consume — repositories/services translate real DB rows into this, same split as every other phase. */
export type InterviewProfileInput = {
  mastery: MasteryResult[];
  topics: TopicAnalytics[];
  forwardLookingGaps: ForwardLookingGap[];
  catalog: ProblemCatalogEntry[];
  solvedSlugs: Set<string>;
  /** From recent mock-interview sessions — avoid handing back the same 3 problems every time. */
  recentlyUsedSlugs: Set<string>;
  /** Submissions in a recent rolling window (see config.recentWindowDays) — for the recentPerformance factor. */
  recentSubmissionCount: number;
  recentMediumHardSubmissionCount: number;
  /** Distinct calendar days with at least one submission in the same rolling window — for problemSolvingConsistency. */
  distinctActiveDays: number;
  /** From reports-repository's revision queries — reused rather than re-querying the same tables. */
  revisionReviewsCompletedRecently: number;
  currentlyOverdueRevisionCount: number;
};
