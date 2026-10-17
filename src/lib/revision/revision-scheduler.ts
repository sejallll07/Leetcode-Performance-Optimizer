import { REVISION_CONFIG } from "@/lib/revision/config";
import type { RevisionFeedback, ScheduleResult } from "@/lib/revision/types";

const { intervalsDays, stepDelta } = REVISION_CONFIG;
const MAX_INDEX = intervalsDays.length - 1;

function dueAtFromIndex(now: Date, intervalIndex: number): Date {
  const days = intervalsDays[intervalIndex];
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * A newly-solved problem's first revision schedule — always starts
 * at the shortest interval (index 0, 3 days from when it was solved).
 */
export function computeInitialSchedule(solvedAt: Date): ScheduleResult {
  return { intervalIndex: 0, dueAt: dueAtFromIndex(solvedAt, 0) };
}

/**
 * Adaptive rescheduling after a completed revision. Pure — no DB, no
 * clock reads (both `currentIntervalIndex` and `now` are passed in),
 * so it's fully deterministic and unit-testable. Moving the pointer
 * is always clamped to the ladder's bounds: "Difficult" on an
 * already-shortest interval stays at the shortest, not negative;
 * "Easy" on an already-longest interval stays at the longest, not
 * off the end of the ladder.
 */
export function computeNextSchedule(
  currentIntervalIndex: number,
  feedback: RevisionFeedback,
  now: Date
): ScheduleResult {
  const delta = stepDelta[feedback];
  const intervalIndex = Math.min(Math.max(currentIntervalIndex + delta, 0), MAX_INDEX);
  return { intervalIndex, dueAt: dueAtFromIndex(now, intervalIndex) };
}
