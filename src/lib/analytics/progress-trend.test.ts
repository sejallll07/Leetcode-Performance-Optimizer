import { describe, expect, it } from "vitest";
import { computeProgressTrend, type MasterySnapshotEntry } from "@/lib/analytics/progress-trend";

function entry(topicSlug: string, masteryScore: number, daysAgo: number): MasterySnapshotEntry {
  return { topicSlug, masteryScore, computedAt: new Date(Date.now() - daysAgo * 86400000) };
}

describe("computeProgressTrend", () => {
  it("reports not-enough-history when every topic only has one generation", () => {
    const result = computeProgressTrend([entry("array", 50, 1)]);
    expect(result.status).toBe("not-enough-history");
    expect(result.averageDelta).toBeNull();
  });

  it("reports improving when average mastery clearly rose", () => {
    const result = computeProgressTrend([entry("array", 40, 10), entry("array", 60, 1)]);
    expect(result.status).toBe("improving");
    expect(result.averageDelta).toBe(20);
    expect(result.topicsImproved).toBe(1);
  });

  it("reports declining when average mastery clearly fell", () => {
    const result = computeProgressTrend([entry("array", 60, 10), entry("array", 40, 1)]);
    expect(result.status).toBe("declining");
    expect(result.topicsDeclined).toBe(1);
  });

  it("reports steady for a small change within the noise band", () => {
    const result = computeProgressTrend([entry("array", 50, 10), entry("array", 52, 1)]);
    expect(result.status).toBe("steady");
  });

  it("only compares each topic's two most recent generations, ignoring older ones", () => {
    const result = computeProgressTrend([
      entry("array", 10, 100), // oldest — should be ignored
      entry("array", 40, 10), // previous
      entry("array", 60, 1), // latest
    ]);
    expect(result.averageDelta).toBe(20); // 60 - 40, not 60 - 10
  });

  it("averages deltas across multiple topics and counts improved/declined correctly", () => {
    const result = computeProgressTrend([
      entry("array", 40, 10),
      entry("array", 60, 1), // +20
      entry("graph", 60, 10),
      entry("graph", 50, 1), // -10
    ]);
    expect(result.comparedTopicCount).toBe(2);
    expect(result.averageDelta).toBe(5); // (20 + -10) / 2
    expect(result.topicsImproved).toBe(1);
    expect(result.topicsDeclined).toBe(1);
  });

  it("excludes topics with only one generation even when others have two", () => {
    const result = computeProgressTrend([
      entry("array", 40, 10),
      entry("array", 60, 1),
      entry("brand-new-topic", 30, 1), // only one generation
    ]);
    expect(result.comparedTopicCount).toBe(1);
  });
});
