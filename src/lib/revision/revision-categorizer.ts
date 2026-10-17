import { REVISION_CONFIG } from "@/lib/revision/config";
import type { RevisionCenterData, RevisionItemState, RevisionSectionState } from "@/lib/revision/types";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Wraps an already-sorted list into a capped section, keeping the true count alongside it. */
function toSection(sortedItems: RevisionItemState[], cap: number): RevisionSectionState {
  return { items: sortedItems.slice(0, cap), totalCount: sortedItems.length };
}

/**
 * Splits a flat list of revision items into the four views the
 * Revision Center shows. Pure — takes `now` as a parameter, so it's
 * deterministic and testable without touching the DB.
 *
 * Overdue / due today / upcoming are mutually exclusive (based on
 * `dueAt` relative to today). "Recently completed" is a separate,
 * overlapping view based on `lastReviewedAt` — a problem just
 * reviewed today is both "recently completed" (what you just did)
 * and, with its new schedule, likely "upcoming" (what's next) —
 * both are true and both are useful to see.
 */
export function categorizeRevisionItems(items: RevisionItemState[], now: Date): RevisionCenterData {
  const todayStart = startOfUTCDay(now);
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);
  const recentCutoff = new Date(now.getTime() - REVISION_CONFIG.recentlyCompleted.windowDays * DAY_MS);

  const overdue = items.filter((i) => i.dueAt < todayStart).sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const dueToday = items
    .filter((i) => i.dueAt >= todayStart && i.dueAt < tomorrowStart)
    .sort((a, b) => a.problemTitle.localeCompare(b.problemTitle));
  const upcoming = items
    .filter((i) => i.dueAt >= tomorrowStart)
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

  const recentlyCompletedSorted = items
    .filter((i) => i.lastReviewedAt !== null && i.lastReviewedAt >= recentCutoff)
    .sort((a, b) => (b.lastReviewedAt as Date).getTime() - (a.lastReviewedAt as Date).getTime());

  return {
    // Overdue keeps the most-overdue-first items — the ones that have waited longest.
    overdue: toSection(overdue, REVISION_CONFIG.sectionCaps.overdue),
    dueToday: toSection(dueToday, REVISION_CONFIG.sectionCaps.dueToday),
    // Upcoming keeps the soonest-scheduled — what's coming up next.
    upcoming: toSection(upcoming, REVISION_CONFIG.sectionCaps.upcoming),
    recentlyCompleted: toSection(recentlyCompletedSorted, REVISION_CONFIG.recentlyCompleted.maxItems),
  };
}
