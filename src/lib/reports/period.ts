import type { PeriodBounds, ReportPeriodType } from "@/lib/reports/types";

/**
 * All period math is done in UTC deliberately — src/lib/db.ts fixed
 * a real bug this session where local-timezone date handling caused
 * visibly wrong values on a non-UTC machine. Report periods are
 * calendar-based ("this week", "this month"), so getting the
 * boundary math wrong would silently put submissions in the wrong
 * week/month for anyone not on UTC. `now` is always injected by the
 * caller, never `new Date()` here — same determinism discipline as
 * AnalyticsInput.now.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

function formatDay(d: Date): string {
  return `${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}`;
}

/** Monday=1 ... Sunday=7 (ISO), so the week always starts on Monday regardless of what day `now` falls on. */
function startOfIsoWeekUTC(d: Date): Date {
  const day = d.getUTCDay() || 7; // Sunday (0) -> 7
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (day - 1));
  return start;
}

/**
 * Bounds for a calendar week or month, `offset` periods back from the
 * one containing `now`. offset=0 is the current (in-progress) period,
 * offset=1 the previous one, and so on — this is what "page back
 * through past weeks/months" pages through.
 */
export function computePeriodBounds(type: ReportPeriodType, now: Date, offset: number): PeriodBounds {
  if (offset < 0) throw new Error(`offset must be >= 0, got ${offset}`);

  if (type === "WEEKLY") {
    const currentWeekStart = startOfIsoWeekUTC(now);
    const start = new Date(currentWeekStart.getTime() - offset * 7 * MS_PER_DAY);
    const end = new Date(start.getTime() + 7 * MS_PER_DAY);
    const lastDay = new Date(end.getTime() - MS_PER_DAY);
    const label =
      start.getUTCFullYear() === lastDay.getUTCFullYear()
        ? `${formatDay(start)} – ${formatDay(lastDay)}, ${lastDay.getUTCFullYear()}`
        : `${formatDay(start)}, ${start.getUTCFullYear()} – ${formatDay(lastDay)}, ${lastDay.getUTCFullYear()}`;
    return { type, start, end, label, isCurrent: now >= start && now < end };
  }

  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() - offset, 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const label = `${MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
  return { type, start, end, label, isCurrent: now >= start && now < end };
}
