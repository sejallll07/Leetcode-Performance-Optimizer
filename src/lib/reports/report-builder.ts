import { REPORTS_CONFIG } from "@/lib/reports/config";
import { computeNextActions } from "@/lib/analytics/next-actions";
import type {
  Difficulty,
  ForwardLookingGap,
  MasteryResult,
  RawMasteryResult,
  ReadinessResult,
  SubmissionInput,
} from "@/lib/analytics/types";
import type { RoadmapResult } from "@/lib/roadmap/types";
import type {
  DifficultyTrend,
  FocusItem,
  ImportantMistake,
  MonthlyReportInsights,
  NeglectedTopic,
  PeriodBounds,
  PersistentWeakness,
  ReportProblem,
  RevisionPerformance,
  TopicDelta,
  WeeklyReportInsights,
} from "@/lib/reports/types";

const { significantDeltaPoints, maxItemsPerSection, difficultyTrend: TREND_CONFIG } = REPORTS_CONFIG;

export type RevisionHistoryEntry = {
  topicSlug: string | null;
  topicName: string | null;
  problemSlug: string;
  problemTitle: string;
  feedback: "Easy" | "Moderate" | "Difficult";
  reviewedAt: Date;
};

// ---------- Shared helpers ----------

function distinctProblems(submissions: SubmissionInput[]): ReportProblem[] {
  const bySlug = new Map<string, ReportProblem>();
  for (const s of submissions) {
    if (!bySlug.has(s.problemSlug)) {
      bySlug.set(s.problemSlug, {
        slug: s.problemSlug,
        title: s.problemTitle,
        difficulty: s.difficulty,
        topicSlugs: s.topicSlugs,
      });
    }
  }
  return [...bySlug.values()];
}

function difficultyBreakdown(problems: ReportProblem[]): { difficulty: Difficulty; count: number }[] {
  const order: Difficulty[] = ["Easy", "Medium", "Hard"];
  return order
    .map((difficulty) => ({ difficulty, count: problems.filter((p) => p.difficulty === difficulty).length }))
    .filter((d) => d.count > 0);
}

function topicsPracticedFrom(problems: ReportProblem[], nameOf: (slug: string) => string) {
  const counts = new Map<string, number>();
  for (const p of problems) {
    for (const slug of p.topicSlugs) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([topicSlug, problemCount]) => ({ topicSlug, topicName: nameOf(topicSlug), problemCount }))
    .sort((a, b) => b.problemCount - a.problemCount);
}

function feedbackBreakdown(entries: RevisionHistoryEntry[]): RevisionPerformance["feedbackBreakdown"] {
  const order: RevisionHistoryEntry["feedback"][] = ["Easy", "Moderate", "Difficult"];
  return order
    .map((feedback) => ({ feedback, count: entries.filter((e) => e.feedback === feedback).length }))
    .filter((f) => f.count > 0);
}

/**
 * Splits the window's submissions in half by time and compares the
 * medium+hard share of each half. A window-scoped analogue of
 * TopicAnalytics.difficultyTrend (which looks at one topic's whole
 * history) — this looks at the whole window across all topics.
 * "insufficient-data" below TREND_CONFIG.minSubmissionsForTrend
 * rather than reading noise from a handful of submissions as a trend.
 */
function computeDifficultyTrend(submissions: SubmissionInput[]): DifficultyTrend {
  if (submissions.length < TREND_CONFIG.minSubmissionsForTrend) return "insufficient-data";

  const sorted = [...submissions].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);

  const mediumHardShare = (list: SubmissionInput[]) =>
    list.length === 0 ? 0 : (list.filter((s) => s.difficulty !== "Easy").length / list.length) * 100;

  const diff = mediumHardShare(secondHalf) - mediumHardShare(firstHalf);
  if (Math.abs(diff) <= TREND_CONFIG.steadyBandPercent) return "steady";
  // A *decreasing* medium/hard share isn't "declining difficulty" in a useful
  // reportable sense — read as steady rather than implying regression from a
  // metric this noisy over a single window.
  return diff > 0 ? "increasing" : "steady";
}

function topicDeltas(
  before: RawMasteryResult[] | MasteryResult[],
  after: MasteryResult[],
  nameOf: (slug: string) => string
): TopicDelta[] {
  const beforeBySlug = new Map(before.map((m) => [m.topicSlug, m.masteryScore]));
  const afterBySlug = new Map(after.map((m) => [m.topicSlug, m]));
  const allSlugs = new Set<string>([...beforeBySlug.keys(), ...afterBySlug.keys()]);

  const deltas: TopicDelta[] = [];
  for (const slug of allSlugs) {
    const afterResult = afterBySlug.get(slug);
    if (!afterResult) continue; // dropped out of evidence entirely by window end — nothing current to report
    const fromScore = beforeBySlug.get(slug) ?? null;
    deltas.push({
      topicSlug: slug,
      topicName: nameOf(slug),
      fromScore,
      toScore: afterResult.masteryScore,
      delta: fromScore === null ? null : afterResult.masteryScore - fromScore,
      toClassification: afterResult.classification,
    });
  }
  return deltas.sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
}

// ---------- Weekly ----------

export type WeeklyReportInput = {
  period: PeriodBounds;
  submissionsInRange: SubmissionInput[];
  revisionHistoryInRange: RevisionHistoryEntry[];
  /** Plain scores as of just before the window opened — only used for delta comparisons, so raw is enough (no gap-detection needed on data we're not classifying fresh). */
  masteryBeforeStart: RawMasteryResult[];
  /** Full gap-aware result as of window end (or "now" for the current, in-progress week). */
  masteryAtEnd: MasteryResult[];
  forwardLookingGapsAtEnd: ForwardLookingGap[];
  /** Null unless period.isCurrent — see the file-level note in types.ts. */
  liveOverdueCount: number | null;
};

export function buildWeeklyReportInsights(input: WeeklyReportInput): WeeklyReportInsights {
  const { period, submissionsInRange, revisionHistoryInRange, masteryBeforeStart, masteryAtEnd, forwardLookingGapsAtEnd, liveOverdueCount } = input;

  const nameOf = (slug: string) =>
    masteryAtEnd.find((m) => m.topicSlug === slug)?.topicName ??
    submissionsInRange.flatMap((s) => (s.topicSlugs.includes(slug) ? [s.topicNames[slug]] : []))[0] ??
    slug;

  const problems = distinctProblems(submissionsInRange);
  const topicsPracticed = topicsPracticedFrom(problems, nameOf);
  const practicedSlugs = new Set(topicsPracticed.map((t) => t.topicSlug));

  const deltas = topicDeltas(masteryBeforeStart, masteryAtEnd, nameOf);
  const withDelta = deltas.filter((d): d is TopicDelta & { delta: number } => d.delta !== null);
  const strongestImprovement = withDelta.length > 0 ? withDelta.reduce((a, b) => (b.delta > a.delta ? b : a)) : null;

  const evidencedAtEnd = masteryAtEnd.filter((m) => m.classification !== "Under-Practiced");
  const weakestAtEnd = evidencedAtEnd.length > 0 ? [...evidencedAtEnd].sort((a, b) => a.masteryScore - b.masteryScore)[0] : null;

  const NEGLECT_CLASSIFICATIONS = new Set(["Weak", "Fundamental Gap", "Revision Needed"]);
  const neglectedTopics: NeglectedTopic[] = masteryAtEnd
    .filter((m) => NEGLECT_CLASSIFICATIONS.has(m.classification) && !practicedSlugs.has(m.topicSlug))
    .map((m) => ({
      topicSlug: m.topicSlug,
      topicName: m.topicName,
      classification: m.classification,
      daysSincePracticed: null, // TopicAnalytics carries this live-engine-side; not re-derived here to avoid a second DB round trip for a report-only field — the classification itself already signals urgency
    }))
    .slice(0, maxItemsPerSection);

  const revisionPerformance: RevisionPerformance = {
    reviewsCompleted: revisionHistoryInRange.length,
    feedbackBreakdown: feedbackBreakdown(revisionHistoryInRange),
    currentlyOverdueCount: liveOverdueCount,
  };

  const difficultyCounts = {
    easyCount: problems.filter((p) => p.difficulty === "Easy").length,
    mediumCount: problems.filter((p) => p.difficulty === "Medium").length,
    hardCount: problems.filter((p) => p.difficulty === "Hard").length,
  };

  const importantMistakes: ImportantMistake[] = [
    ...revisionHistoryInRange
      .filter((r) => r.feedback === "Difficult")
      .map((r): ImportantMistake => ({
        topicSlug: r.topicSlug ?? "unknown",
        topicName: r.topicName ?? r.problemTitle,
        kind: "difficult-revision",
        detail: `"${r.problemTitle}" came back as Difficult on revision this week.`,
      })),
    ...deltas
      .filter((d) => d.delta !== null && d.delta < 0)
      .map((d): ImportantMistake => ({
        topicSlug: d.topicSlug,
        topicName: d.topicName,
        kind: "mastery-decline",
        detail: `${d.topicName} mastery dropped ${Math.abs(d.delta as number)} points this week.`,
      })),
  ].slice(0, maxItemsPerSection);

  const nextWeekFocus: FocusItem[] = computeNextActions(masteryAtEnd, forwardLookingGapsAtEnd)
    .slice(0, maxItemsPerSection)
    .map((a) => ({ topicSlug: a.topicSlug, topicName: a.topicName, reason: a.reason }));

  return {
    period,
    problemsSolved: { total: problems.length, byDifficulty: difficultyBreakdown(problems), problems },
    topicsPracticed,
    strongestImprovement,
    weakestArea: weakestAtEnd
      ? { topicSlug: weakestAtEnd.topicSlug, topicName: weakestAtEnd.topicName, masteryScore: weakestAtEnd.masteryScore, classification: weakestAtEnd.classification }
      : null,
    neglectedTopics,
    revisionPerformance,
    difficultyProgression: { ...difficultyCounts, trend: computeDifficultyTrend(submissionsInRange) },
    importantMistakes,
    nextWeekFocus,
  };
}

// ---------- Monthly ----------

export type MonthlyReportInput = {
  period: PeriodBounds;
  totalSolvedEnd: number;
  submissionsInRange: SubmissionInput[];
  revisionHistoryInRange: RevisionHistoryEntry[];
  masteryAtStart: MasteryResult[];
  masteryAtEnd: MasteryResult[];
  roadmapAtStart: RoadmapResult;
  roadmapAtEnd: RoadmapResult;
  /** Null when there's no mastery evidence at all before the window started (this is the student's first tracked month) — distinct from a genuine 0 score. */
  readinessAtStart: ReadinessResult | null;
  readinessAtEnd: ReadinessResult;
  liveOverdueCount: number | null;
  /** From the immediately preceding stored monthly report, if any — see reports-repository.ts's getPreviousReport. Empty array if there's no prior report to compare against. */
  previousMonthlyPersistentWeaknesses: { topicSlug: string; monthsPersistent: number }[];
};

export function buildMonthlyReportInsights(input: MonthlyReportInput): MonthlyReportInsights {
  const {
    period,
    totalSolvedEnd,
    submissionsInRange,
    revisionHistoryInRange,
    masteryAtStart,
    masteryAtEnd,
    roadmapAtStart,
    roadmapAtEnd,
    readinessAtStart,
    readinessAtEnd,
    liveOverdueCount,
    previousMonthlyPersistentWeaknesses,
  } = input;

  const nameOf = (slug: string) =>
    masteryAtEnd.find((m) => m.topicSlug === slug)?.topicName ?? masteryAtStart.find((m) => m.topicSlug === slug)?.topicName ?? slug;

  const problems = distinctProblems(submissionsInRange);
  const masteryChanges = topicDeltas(masteryAtStart, masteryAtEnd, nameOf);

  const topicImprovements = masteryChanges.filter((d) => d.delta !== null && d.delta >= significantDeltaPoints).slice(0, maxItemsPerSection);
  const decliningTopics = masteryChanges.filter((d) => d.delta !== null && d.delta <= -significantDeltaPoints).slice(0, maxItemsPerSection);

  const startClassBySlug = new Map(masteryAtStart.map((m) => [m.topicSlug, m.classification]));
  const newlyDevelopedStrengths = masteryAtEnd
    .filter((m) => m.classification === "Strong" && startClassBySlug.get(m.topicSlug) !== "Strong")
    .map((m) => ({ topicSlug: m.topicSlug, topicName: m.topicName }))
    .slice(0, maxItemsPerSection);

  const WEAK_CLASSIFICATIONS = new Set(["Weak", "Fundamental Gap"]);
  const previousStreakBySlug = new Map(previousMonthlyPersistentWeaknesses.map((p) => [p.topicSlug, p.monthsPersistent]));
  const persistentWeaknesses: PersistentWeakness[] = masteryAtEnd
    .filter((m) => WEAK_CLASSIFICATIONS.has(m.classification) && WEAK_CLASSIFICATIONS.has(startClassBySlug.get(m.topicSlug) ?? ""))
    .map((m) => ({
      topicSlug: m.topicSlug,
      topicName: m.topicName,
      classification: m.classification,
      monthsPersistent: (previousStreakBySlug.get(m.topicSlug) ?? 0) + 1,
    }))
    .sort((a, b) => b.monthsPersistent - a.monthsPersistent)
    .slice(0, maxItemsPerSection);

  const revisionConsistency: RevisionPerformance = {
    reviewsCompleted: revisionHistoryInRange.length,
    feedbackBreakdown: feedbackBreakdown(revisionHistoryInRange),
    currentlyOverdueCount: liveOverdueCount,
  };

  const difficultyCounts = {
    easyCount: problems.filter((p) => p.difficulty === "Easy").length,
    mediumCount: problems.filter((p) => p.difficulty === "Medium").length,
    hardCount: problems.filter((p) => p.difficulty === "Hard").length,
  };

  const groupBySlug = (roadmap: RoadmapResult) => new Map(roadmap.topics.map((t) => [t.topicSlug, t.status]));
  const startGroups = groupBySlug(roadmapAtStart);
  const endGroups = groupBySlug(roadmapAtEnd);
  const roadmapChanges = [...endGroups.entries()]
    .filter(([slug, toGroup]) => startGroups.has(slug) && startGroups.get(slug) !== toGroup)
    .map(([slug, toGroup]) => ({
      topicSlug: slug,
      topicName: roadmapAtEnd.topics.find((t) => t.topicSlug === slug)?.topicName ?? slug,
      fromGroup: startGroups.get(slug)!,
      toGroup,
    }))
    .slice(0, maxItemsPerSection);

  return {
    period,
    overallProgress: {
      totalSolvedStart: totalSolvedEnd - problems.length,
      totalSolvedEnd,
      problemsSolvedThisMonth: problems.length,
      readinessScoreStart: readinessAtStart?.score ?? null,
      readinessScoreEnd: readinessAtEnd.score,
    },
    masteryChanges,
    topicImprovements,
    decliningTopics,
    newlyDevelopedStrengths,
    persistentWeaknesses,
    revisionConsistency,
    difficultyProgression: { ...difficultyCounts, trend: computeDifficultyTrend(submissionsInRange) },
    interviewReadinessTrend: {
      scoreStart: readinessAtStart?.score ?? null,
      scoreEnd: readinessAtEnd.score,
      delta: readinessAtStart ? readinessAtEnd.score - readinessAtStart.score : null,
      levelStart: readinessAtStart?.level ?? null,
      levelEnd: readinessAtEnd.level,
    },
    roadmapChanges,
  };
}
