import { REVISION_CONFIG } from "@/lib/revision/config";
import { computeNextSchedule } from "@/lib/revision/revision-scheduler";
import type { RevisionCenterData, RevisionFeedback, RevisionItemState } from "@/lib/revision/types";
import { intervalLabel } from "@/lib/revision-format";

/**
 * Presentation helpers for the redesigned Revision page.
 *
 * Pure and I/O-free, and read-only with respect to scheduling: it never
 * decides when anything is due (that's the categorizer's job, and it
 * runs first) and never reschedules anything (that's the scheduler,
 * which is only *asked* "what would happen if…" to preview the
 * consequence of each rating). It turns the categorizer's output into
 * plain, serializable view data: one merged review queue, a summary,
 * and compact rows for the two informational lists.
 *
 * Every date label here is computed from UTC calendar days — the same
 * boundaries the categorizer uses to put an item in Overdue, Due Today
 * or Upcoming — so a label can never contradict the section the item
 * is in.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUTCDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Whole UTC calendar days from `now`'s day to `date`'s day: negative = earlier, 0 = same day, positive = later. */
export function daysFromToday(date: Date, now: Date): number {
  return Math.round((startOfUTCDay(date) - startOfUTCDay(now)) / DAY_MS);
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

export function formatDueLabel(dueAt: Date, now: Date): string {
  const days = daysFromToday(dueAt, now);
  if (days < 0) return `Overdue ${plural(-days, "day")}`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

export function formatReviewedLabel(reviewedAt: Date, now: Date): string {
  const daysAgo = daysFromToday(now, reviewedAt);
  if (daysAgo <= 0) return "Reviewed today";
  if (daysAgo === 1) return "Reviewed yesterday";
  return `Reviewed ${daysAgo} days ago`;
}

// ---------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------

/** The stored values stay Easy / Moderate / Difficult; only the wording a student sees is friendlier. */
export const FEEDBACK_OPTIONS: { feedback: RevisionFeedback; label: string }[] = [
  { feedback: "Easy", label: "Easy — got it" },
  { feedback: "Moderate", label: "Moderate — needed a push" },
  { feedback: "Difficult", label: "Difficult — struggled" },
];

/**
 * What each rating WOULD schedule next, as an interval label ("1 month",
 * "3 days"). Asks the real scheduler rather than re-deriving its rules,
 * so the preview can't drift from what actually happens.
 */
export function getFeedbackPreviews(intervalIndex: number, now: Date): Record<RevisionFeedback, string> {
  const preview = (feedback: RevisionFeedback) =>
    intervalLabel(computeNextSchedule(intervalIndex, feedback, now).intervalIndex);
  return { Easy: preview("Easy"), Moderate: preview("Moderate"), Difficult: preview("Difficult") };
}

export function formatSavedMessage(problemTitle: string, nextLabel: string): string {
  return `${problemTitle} saved — next review in ${nextLabel}`;
}

// ---------------------------------------------------------------------
// The review queue (Overdue + Due Today, merged)
// ---------------------------------------------------------------------

export type ReviewQueueItem = {
  id: string;
  problemSlug: string;
  problemTitle: string;
  difficulty: "Easy" | "Medium" | "Hard";
  topic: string;
  url: string;
  group: "overdue" | "due-today";
  /** 0 for due-today items. */
  daysOverdue: number;
  dueLabel: string;
  /** Where the problem sits on the interval ladder: 1 (shortest) … ladderSteps (longest). */
  ladderStep: number;
  ladderSteps: number;
  intervalLabel: string;
  reviewCount: number;
  /** The interval each rating would schedule next, e.g. { Easy: "1 month", … }. */
  previews: Record<RevisionFeedback, string>;
};

export type ReviewQueue = {
  /** Overdue (most overdue first), then due today — the categorizer's own order, within its display caps. */
  items: ReviewQueueItem[];
  /** The true number due now, before any display cap. */
  total: number;
  overdueTotal: number;
  dueTodayTotal: number;
  /** Due items the categorizer's display caps left off the list. */
  hiddenByCap: number;
};

/** How many queue items show before "Show N more". */
export const INITIAL_QUEUE_SIZE = 5;

function leetcodeUrl(problemSlug: string): string {
  return `https://leetcode.com/problems/${problemSlug}/`;
}

function toQueueItem(item: RevisionItemState, group: ReviewQueueItem["group"], now: Date): ReviewQueueItem {
  return {
    id: item.id,
    problemSlug: item.problemSlug,
    problemTitle: item.problemTitle,
    difficulty: item.difficulty,
    topic: item.topicName ?? "Uncategorized",
    url: leetcodeUrl(item.problemSlug),
    group,
    daysOverdue: group === "overdue" ? Math.max(0, -daysFromToday(item.dueAt, now)) : 0,
    dueLabel: formatDueLabel(item.dueAt, now),
    ladderStep: item.intervalIndex + 1,
    ladderSteps: REVISION_CONFIG.intervalsDays.length,
    intervalLabel: intervalLabel(item.intervalIndex),
    reviewCount: item.reviewCount,
    previews: getFeedbackPreviews(item.intervalIndex, now),
  };
}

/**
 * Session progress for the current visit: how many have been rated this
 * visit out of everything that's been in the queue this visit
 * (rated + still waiting). The total is derived, not remembered, so it
 * stays right even if more items become due mid-session. It starts over
 * on a fresh page load, since items already rated no longer appear.
 */
export function getSessionProgress(reviewed: number, remaining: number): { reviewed: number; total: number; fraction: number } {
  const total = reviewed + remaining;
  return { reviewed, total, fraction: total === 0 ? 0 : reviewed / total };
}

// ---------------------------------------------------------------------
// Summary and the two informational lists
// ---------------------------------------------------------------------

export type RevisionSummary = {
  dueNow: number;
  overdue: number;
  dueToday: number;
  upcoming: number;
  /** Items reviewed within the recently-completed window. */
  reviewedRecently: number;
  windowDays: number;
  /** The soonest scheduled item after the current queue, if any. */
  nextUp: { problemTitle: string; dueLabel: string } | null;
};

export type UpcomingRow = {
  id: string;
  problemTitle: string;
  url: string;
  topic: string;
  difficulty: "Easy" | "Medium" | "Hard";
  dueLabel: string;
  ladderStep: number;
  ladderSteps: number;
  intervalLabel: string;
};

export type CompletedRow = {
  id: string;
  problemTitle: string;
  url: string;
  topic: string;
  difficulty: "Easy" | "Medium" | "Hard";
  feedback: RevisionFeedback | null;
  reviewedLabel: string;
  /** When it comes back, e.g. "Due in 14 days". */
  nextReview: string;
};

export type RevisionView = {
  queue: ReviewQueue;
  summary: RevisionSummary;
  upcoming: { rows: UpcomingRow[]; total: number };
  completed: { rows: CompletedRow[]; total: number; windowDays: number };
};

/** Turns the categorizer's output into everything the Revision page renders. Doesn't mutate its input. */
export function buildRevisionView(data: RevisionCenterData, now: Date): RevisionView {
  const items = [
    ...data.overdue.items.map((item) => toQueueItem(item, "overdue", now)),
    ...data.dueToday.items.map((item) => toQueueItem(item, "due-today", now)),
  ];
  const total = data.overdue.totalCount + data.dueToday.totalCount;

  const nextUpItem = data.upcoming.items[0];

  return {
    queue: {
      items,
      total,
      overdueTotal: data.overdue.totalCount,
      dueTodayTotal: data.dueToday.totalCount,
      hiddenByCap: Math.max(0, total - items.length),
    },
    summary: {
      dueNow: total,
      overdue: data.overdue.totalCount,
      dueToday: data.dueToday.totalCount,
      upcoming: data.upcoming.totalCount,
      reviewedRecently: data.recentlyCompleted.totalCount,
      windowDays: REVISION_CONFIG.recentlyCompleted.windowDays,
      nextUp: nextUpItem ? { problemTitle: nextUpItem.problemTitle, dueLabel: formatDueLabel(nextUpItem.dueAt, now) } : null,
    },
    upcoming: {
      total: data.upcoming.totalCount,
      rows: data.upcoming.items.map((item) => ({
        id: item.id,
        problemTitle: item.problemTitle,
        url: leetcodeUrl(item.problemSlug),
        topic: item.topicName ?? "Uncategorized",
        difficulty: item.difficulty,
        dueLabel: formatDueLabel(item.dueAt, now),
        ladderStep: item.intervalIndex + 1,
        ladderSteps: REVISION_CONFIG.intervalsDays.length,
        intervalLabel: intervalLabel(item.intervalIndex),
      })),
    },
    completed: {
      total: data.recentlyCompleted.totalCount,
      windowDays: REVISION_CONFIG.recentlyCompleted.windowDays,
      rows: data.recentlyCompleted.items.map((item) => ({
        id: item.id,
        problemTitle: item.problemTitle,
        url: leetcodeUrl(item.problemSlug),
        topic: item.topicName ?? "Uncategorized",
        difficulty: item.difficulty,
        feedback: item.lastFeedback,
        reviewedLabel: item.lastReviewedAt ? formatReviewedLabel(item.lastReviewedAt, now) : "Reviewed",
        nextReview: formatDueLabel(item.dueAt, now),
      })),
    },
  };
}