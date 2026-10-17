/**
 * Every tunable number/string the report engine and narrator use, in
 * one place — same philosophy as src/lib/analytics/config.ts,
 * src/lib/revision/config.ts, and src/lib/mentor/config.ts.
 */
export const REPORTS_CONFIG = {
  /** Mastery-point delta (over the window) at or beyond which a topic counts as a real improvement/decline for topicImprovements/decliningTopics — deliberately separate from ANALYTICS_CONFIG.progressTrend.steadyBandPoints (that one compares two *sync* generations; this compares a whole week/month, so a slightly higher bar makes sense). */
  significantDeltaPoints: 5,

  /** How many topics/items each report list shows before truncating — reports are meant to read as "insights", not a full dump. */
  maxItemsPerSection: 8,

  /** Difficulty-progression trend (per report window): split the window's submissions into first-half / second-half by submittedAt, compare each half's medium+hard share. Below this many total submissions in the window, there's not enough signal to call a trend either way. */
  difficultyTrend: {
    minSubmissionsForTrend: 4,
    /** Percentage-point difference in medium+hard share (second half vs first half) below which the trend reads as "steady" rather than increasing. */
    steadyBandPercent: 10,
  },

  /** The AI narration layer (see src/services/reports/claude-report-narrator.ts) — same model choice and reasoning as MENTOR_CONFIG.model: real reasoning needed (turning structured deltas into a coherent "here's how your week went" summary), but runs once per report view/generation, not in a tight loop. */
  narrator: {
    model: "claude-sonnet-5",
    maxOutputTokens: 900,
    requestTimeoutMs: 30_000,
  },
} as const;
