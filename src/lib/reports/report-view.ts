import type {
  DifficultyTrend,
  MonthlyReportInsights,
  ReportNarrative,
  ReportPeriodType,
  ReportResult,
  WeeklyReportInsights,
} from "@/lib/reports/types";

/**
 * Pure view model for the Reports page: turns the already-computed
 * weekly/monthly insights into the three things the UI shows -
 * four signal tiles, three bands of insight rows (Going well, Needs
 * attention, Next), and the summary. No I/O and no new analytics:
 * every number here comes straight from the existing insights, this
 * file only decides what is worth showing, in what order, and with
 * what tone. Empty sections are dropped here so the components never
 * render an empty card.
 *
 * Symbols are written as escapes (arrow, middle dot) so the file
 * stays plain ASCII and cannot be mangled by an editor's encoding.
 */

const ARROW = "\u2192";
const DOT = "\u00b7";

/** More practiced-topic chips than this collapse into a "+N more" chip. */
export const MAX_PRACTICED_CHIPS = 8;

export type Tone = "neutral" | "good" | "warn" | "bad";

export type StatTile = {
  key: string;
  label: string;
  value: string;
  note?: string;
  tone: Tone;
};

/** A 0-100 score drawn as a small bar; `from` null means "no earlier score". */
export type ScoreBar = { from: number | null; to: number };

export type InsightRow = {
  key: string;
  label: string;
  badge?: string;
  badgeTone?: Tone;
  detail?: string;
  bar?: ScoreBar;
};

export type InsightSection = {
  key: string;
  title: string;
  rows: InsightRow[];
  chips: string[];
};

export type InsightGroup = {
  key: "good" | "attention" | "next";
  title: string;
  /** Rows in this group are a ranked list (shown with 1, 2, 3 markers). */
  ordered: boolean;
  /** Only sections that have content; an empty array means the whole group is empty. */
  sections: InsightSection[];
  emptyMessage: string;
};

export type ReportViewModel = {
  periodType: ReportPeriodType;
  periodLabel: string;
  isCurrent: boolean;
  summary: ReportNarrative | null;
  narrativeError: string | null;
  tiles: StatTile[];
  /** Always [good, attention, next], in that order. */
  groups: InsightGroup[];
  /** True when both "Going well" and "Needs attention" are empty. */
  isQuiet: boolean;
};

// ---------- Small formatting helpers (exported for tests) ----------

export function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

export function scoreChange(from: number | null, to: number): string {
  return `${from ?? "New"} ${ARROW} ${to}`;
}

export function trendLabel(trend: DifficultyTrend): string {
  if (trend === "increasing") return "Rising";
  if (trend === "steady") return "Steady";
  return "Not enough data";
}

export function difficultyMix(easy: number, medium: number, hard: number): string {
  return `${easy}E / ${medium}M / ${hard}H`;
}

/** "IN_PROGRESS" or "in-progress" becomes "In progress"; already-friendly text is only re-cased. */
export function humanizeStatus(value: string): string {
  const text = value.replace(/[_-]+/g, " ").trim().toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function feedbackNote(breakdown: { feedback: string; count: number }[]): string {
  return breakdown.length > 0 ? breakdown.map((f) => `${f.count} ${f.feedback}`).join(", ") : "None completed";
}

function practicedChips(topics: { topicName: string; problemCount: number }[]): string[] {
  const shown = topics.slice(0, MAX_PRACTICED_CHIPS).map((t) => `${t.topicName} ${DOT} ${t.problemCount}`);
  const extra = topics.length - MAX_PRACTICED_CHIPS;
  return extra > 0 ? [...shown, `+${extra} more`] : shown;
}

function section(key: string, title: string, rows: InsightRow[] = [], chips: string[] = []): InsightSection {
  return { key, title, rows, chips };
}

function hasContent(s: InsightSection): boolean {
  return s.rows.length > 0 || s.chips.length > 0;
}

function group(
  key: InsightGroup["key"],
  title: string,
  emptyMessage: string,
  sections: InsightSection[],
  ordered = false
): InsightGroup {
  return { key, title, ordered, emptyMessage, sections: sections.filter(hasContent) };
}

// ---------- Weekly ----------

function weeklyTiles(r: WeeklyReportInsights): StatTile[] {
  const solvedNote =
    r.problemsSolved.byDifficulty.length > 0
      ? r.problemsSolved.byDifficulty.map((d) => `${d.count} ${d.difficulty}`).join(", ")
      : "Nothing solved yet";
  const overdue = r.revisionPerformance.currentlyOverdueCount;
  const d = r.difficultyProgression;

  // Overdue is only knowable for the in-progress week, so a past week shows
  // the difficulty mix instead of a blank tile.
  const fourth: StatTile =
    overdue === null
      ? { key: "difficulty", label: "Difficulty", value: trendLabel(d.trend), note: difficultyMix(d.easyCount, d.mediumCount, d.hardCount), tone: d.trend === "increasing" ? "good" : "neutral" }
      : { key: "overdue", label: "Overdue", value: String(overdue), note: overdue > 0 ? "Due for review" : "All clear", tone: overdue > 0 ? "warn" : "good" };

  return [
    { key: "solved", label: "Problems solved", value: String(r.problemsSolved.total), note: solvedNote, tone: "neutral" },
    { key: "topics", label: "Topics practiced", value: String(r.topicsPracticed.length), note: r.topicsPracticed.length > 0 ? "This week" : "None yet", tone: "neutral" },
    { key: "reviews", label: "Revisions done", value: String(r.revisionPerformance.reviewsCompleted), note: feedbackNote(r.revisionPerformance.feedbackBreakdown), tone: "neutral" },
    fourth,
  ];
}

function weeklyGroups(r: WeeklyReportInsights): InsightGroup[] {
  const best = r.strongestImprovement;
  // The engine picks the largest delta even when every topic slipped; only a real gain counts as "going well".
  const improvement: InsightRow[] =
    best && best.delta > 0
      ? [{ key: best.topicSlug, label: best.topicName, badge: signed(best.delta), badgeTone: "good", detail: scoreChange(best.fromScore, best.toScore), bar: { from: best.fromScore, to: best.toScore } }]
      : [];

  const weakest: InsightRow[] = r.weakestArea
    ? [{ key: r.weakestArea.topicSlug, label: r.weakestArea.topicName, badge: `${r.weakestArea.masteryScore}/100`, badgeTone: "warn", detail: r.weakestArea.classification, bar: { from: null, to: r.weakestArea.masteryScore } }]
    : [];

  const neglected: InsightRow[] = r.neglectedTopics.map((t) => ({
    key: t.topicSlug,
    label: t.topicName,
    badge: t.classification,
    badgeTone: "warn",
    detail: "Not touched this week",
  }));

  const mistakes: InsightRow[] = r.importantMistakes.map((m, i) => ({
    key: `${m.topicSlug}-${i}`,
    label: m.topicName,
    badge: m.kind === "difficult-revision" ? "Difficult revision" : "Mastery drop",
    badgeTone: "warn",
    detail: m.detail,
  }));

  const focus: InsightRow[] = r.nextWeekFocus.map((f) => ({ key: f.topicSlug, label: f.topicName, detail: f.reason }));

  return [
    group("good", "Going well", "Nothing to highlight yet this week.", [
      section("improvement", "Strongest improvement", improvement),
      section("practiced", "Topics practiced", [], practicedChips(r.topicsPracticed)),
    ]),
    group("attention", "Needs attention", "Nothing flagged this week.", [
      section("weakest", "Weakest area", weakest),
      section("neglected", "Neglected topics", neglected),
      section("mistakes", "Important mistakes", mistakes),
    ]),
    group("next", "Next week's focus", "No specific focus right now. Keep syncing for fresh recommendations.", [section("focus", "Focus", focus)], true),
  ];
}

// ---------- Monthly ----------

function monthlyTiles(r: MonthlyReportInsights): StatTile[] {
  const op = r.overallProgress;
  const rt = r.interviewReadinessTrend;
  const d = r.difficultyProgression;

  const change =
    rt.delta === null || rt.scoreStart === null
      ? "First tracked month"
      : rt.delta === 0
        ? `No change from ${rt.scoreStart}`
        : `${signed(rt.delta)} from ${rt.scoreStart}`;
  const level = rt.levelStart && rt.levelStart !== rt.levelEnd ? `${rt.levelStart} ${ARROW} ${rt.levelEnd}` : rt.levelEnd;

  return [
    { key: "solved", label: "Problems solved", value: String(op.problemsSolvedThisMonth), note: `Lifetime ${op.totalSolvedStart} ${ARROW} ${op.totalSolvedEnd}`, tone: "neutral" },
    { key: "readiness", label: "Readiness", value: String(rt.scoreEnd), note: `${change} ${DOT} ${level}`, tone: rt.delta === null || rt.delta === 0 ? "neutral" : rt.delta > 0 ? "good" : "warn" },
    { key: "reviews", label: "Revisions done", value: String(r.revisionConsistency.reviewsCompleted), note: feedbackNote(r.revisionConsistency.feedbackBreakdown), tone: "neutral" },
    { key: "difficulty", label: "Difficulty", value: trendLabel(d.trend), note: difficultyMix(d.easyCount, d.mediumCount, d.hardCount), tone: d.trend === "increasing" ? "good" : "neutral" },
  ];
}

function monthlyGroups(r: MonthlyReportInsights): InsightGroup[] {
  const improved: InsightRow[] = r.topicImprovements.map((t) => ({
    key: t.topicSlug,
    label: t.topicName,
    badge: t.delta === null ? undefined : signed(t.delta),
    badgeTone: "good",
    detail: scoreChange(t.fromScore, t.toScore),
    bar: { from: t.fromScore, to: t.toScore },
  }));

  const strengths: InsightRow[] = r.newlyDevelopedStrengths.map((t) => ({
    key: t.topicSlug,
    label: t.topicName,
    badge: "Now Strong",
    badgeTone: "good",
  }));

  const declining: InsightRow[] = r.decliningTopics.map((t) => ({
    key: t.topicSlug,
    label: t.topicName,
    badge: t.delta === null ? undefined : signed(t.delta),
    badgeTone: "bad",
    detail: scoreChange(t.fromScore, t.toScore),
    bar: { from: t.fromScore, to: t.toScore },
  }));

  const persistent: InsightRow[] = r.persistentWeaknesses.map((w) => ({
    key: w.topicSlug,
    label: w.topicName,
    badge: w.classification,
    badgeTone: "warn",
    detail: `${w.monthsPersistent} month${w.monthsPersistent === 1 ? "" : "s"} running`,
  }));

  const moves: InsightRow[] = r.roadmapChanges.map((c) => ({
    key: c.topicSlug,
    label: c.topicName,
    detail: `${humanizeStatus(c.fromGroup)} ${ARROW} ${humanizeStatus(c.toGroup)}`,
  }));

  return [
    group("good", "Going well", "Nothing to highlight yet this month.", [
      section("improved", "Topic improvements", improved),
      section("strengths", "Newly developed strengths", strengths),
    ]),
    group("attention", "Needs attention", "Nothing flagged this month.", [
      section("declining", "Declining topics", declining),
      section("persistent", "Persistent weaknesses", persistent),
    ]),
    group("next", "Roadmap moves", "No roadmap group changes this month.", [section("moves", "Moves", moves)]),
  ];
}

// ---------- Entry point ----------

export function buildReportView(report: ReportResult): ReportViewModel {
  const isWeekly = report.periodType === "WEEKLY";
  const weekly = report.insights as WeeklyReportInsights;
  const monthly = report.insights as MonthlyReportInsights;
  const groups = isWeekly ? weeklyGroups(weekly) : monthlyGroups(monthly);

  return {
    periodType: report.periodType,
    periodLabel: report.insights.period.label,
    isCurrent: report.insights.period.isCurrent,
    summary: report.narrative,
    narrativeError: report.narrativeError,
    tiles: isWeekly ? weeklyTiles(weekly) : monthlyTiles(monthly),
    groups,
    isQuiet: groups[0].sections.length === 0 && groups[1].sections.length === 0,
  };
}