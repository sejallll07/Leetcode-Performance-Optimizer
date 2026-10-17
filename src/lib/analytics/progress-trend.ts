import { ANALYTICS_CONFIG } from "@/lib/analytics/config";
import type { ProgressTrend } from "@/lib/analytics/types";

const { steadyBandPoints } = ANALYTICS_CONFIG.progressTrend;

export type MasterySnapshotEntry = {
  topicSlug: string;
  masteryScore: number;
  computedAt: Date;
};

/**
 * "Am I improving?" — compares each topic's two most recent
 * computation generations (from the persisted `user_topic_mastery`
 * time series, not a single engine run) and averages the deltas.
 * Pure: takes the full history as plain data, so it's testable
 * without touching Postgres — src/repositories/analytics-repository.ts
 * is the only place that loads the real history.
 *
 * Only topics with *two* generations count — a topic seen for the
 * first time this sync has nothing to compare against yet, and
 * that's excluded rather than treated as "no change."
 */
export function computeProgressTrend(history: MasterySnapshotEntry[]): ProgressTrend {
  const byTopic = new Map<string, MasterySnapshotEntry[]>();
  for (const entry of history) {
    const list = byTopic.get(entry.topicSlug) ?? [];
    list.push(entry);
    byTopic.set(entry.topicSlug, list);
  }

  const deltas: number[] = [];
  let previousComputedAt: Date | null = null;
  let latestComputedAt: Date | null = null;

  for (const entries of byTopic.values()) {
    const sorted = [...entries].sort((a, b) => b.computedAt.getTime() - a.computedAt.getTime());
    if (sorted.length < 2) continue; // only one generation for this topic — nothing to compare

    const [latest, previous] = sorted;
    deltas.push(latest.masteryScore - previous.masteryScore);

    if (!latestComputedAt || latest.computedAt > latestComputedAt) latestComputedAt = latest.computedAt;
    if (!previousComputedAt || previous.computedAt > previousComputedAt) previousComputedAt = previous.computedAt;
  }

  if (deltas.length === 0) {
    return {
      status: "not-enough-history",
      averageDelta: null,
      topicsImproved: 0,
      topicsDeclined: 0,
      comparedTopicCount: 0,
      previousComputedAt: null,
      latestComputedAt: null,
      explanation: "Not enough sync history yet to say whether you're improving — check back after your next sync.",
    };
  }

  const averageDelta = Math.round((deltas.reduce((sum, d) => sum + d, 0) / deltas.length) * 10) / 10;
  const topicsImproved = deltas.filter((d) => d > 0).length;
  const topicsDeclined = deltas.filter((d) => d < 0).length;

  const status: ProgressTrend["status"] =
    Math.abs(averageDelta) <= steadyBandPoints ? "steady" : averageDelta > 0 ? "improving" : "declining";

  const direction = averageDelta > 0 ? "up" : averageDelta < 0 ? "down" : "unchanged";
  const explanation =
    status === "steady"
      ? `Roughly steady since your last sync — average mastery across ${deltas.length} topic${deltas.length === 1 ? "" : "s"} moved ${direction} ${Math.abs(averageDelta)} points, within normal noise.`
      : `Average mastery across ${deltas.length} topic${deltas.length === 1 ? "" : "s"} is ${direction} ${Math.abs(averageDelta)} points since your last sync (${topicsImproved} improved, ${topicsDeclined} declined).`;

  return {
    status,
    averageDelta,
    topicsImproved,
    topicsDeclined,
    comparedTopicCount: deltas.length,
    previousComputedAt,
    latestComputedAt,
    explanation,
  };
}
