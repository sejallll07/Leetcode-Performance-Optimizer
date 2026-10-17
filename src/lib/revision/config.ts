/**
 * Every tunable number the revision scheduler uses, in one place —
 * same philosophy as src/lib/analytics/config.ts. Tuning the
 * schedule means editing this file, not hunting through scheduling
 * logic.
 */
export const REVISION_CONFIG = {
  /** The interval ladder, in days: 3 days, 1 week, 2 weeks, 1 month, 2 months. */
  intervalsDays: [3, 7, 14, 30, 60],

  /**
   * How far a review's feedback moves the interval-ladder pointer.
   * The brief only names two directions ("performs well: increase",
   * "struggles: decrease") for three feedback levels — Moderate is
   * read as "performed adequately" (still an increase, the normal
   * forward progression through the ladder), Easy gets an extra
   * step as a bonus for finding it trivial, Difficult steps back.
   */
  stepDelta: {
    Easy: 2,
    Moderate: 1,
    Difficult: -1,
  },

  /** How far back "recently completed" looks, and how many it shows. */
  recentlyCompleted: {
    windowDays: 14,
    maxItems: 10,
  },

  /**
   * Caps how many items each Revision Center list renders, so a
   * very active user's page doesn't grow unbounded (flagged as a
   * known gap since Phase 7). Overdue and Due Today keep the most
   * urgent items (soonest `dueAt` first); Upcoming keeps the
   * soonest-scheduled. This never hides the true count — see
   * `RevisionSectionState.totalCount` — it only limits what's
   * rendered.
   */
  sectionCaps: {
    overdue: 25,
    dueToday: 25,
    upcoming: 15,
  },
} as const;
