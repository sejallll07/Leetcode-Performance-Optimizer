import { describe, expect, it } from "vitest";
import { computeInitialSchedule, computeNextSchedule } from "@/lib/revision/revision-scheduler";
import { REVISION_CONFIG } from "@/lib/revision/config";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-06-15T00:00:00Z");

describe("computeInitialSchedule", () => {
  it("starts every new problem at the shortest interval (index 0, 3 days)", () => {
    const result = computeInitialSchedule(NOW);
    expect(result.intervalIndex).toBe(0);
    expect(result.dueAt.getTime()).toBe(NOW.getTime() + 3 * DAY_MS);
  });

  it("schedules relative to when the problem was actually solved, not now", () => {
    const solvedAt = new Date("2026-05-01T00:00:00Z");
    const result = computeInitialSchedule(solvedAt);
    expect(result.dueAt.getTime()).toBe(solvedAt.getTime() + 3 * DAY_MS);
  });
});

describe("computeNextSchedule", () => {
  it("moves forward two steps on Easy", () => {
    const result = computeNextSchedule(0, "Easy", NOW);
    expect(result.intervalIndex).toBe(2); // 3 days -> 2 weeks
    expect(result.dueAt.getTime()).toBe(NOW.getTime() + REVISION_CONFIG.intervalsDays[2] * DAY_MS);
  });

  it("moves forward one step on Moderate — the normal ladder progression", () => {
    const result = computeNextSchedule(0, "Moderate", NOW);
    expect(result.intervalIndex).toBe(1); // 3 days -> 1 week
  });

  it("moves back one step on Difficult", () => {
    const result = computeNextSchedule(2, "Difficult", NOW);
    expect(result.intervalIndex).toBe(1); // 2 weeks -> 1 week
  });

  it("never goes below index 0, even repeatedly struggling at the shortest interval", () => {
    const result = computeNextSchedule(0, "Difficult", NOW);
    expect(result.intervalIndex).toBe(0);
    expect(result.dueAt.getTime()).toBe(NOW.getTime() + REVISION_CONFIG.intervalsDays[0] * DAY_MS);
  });

  it("never exceeds the longest interval, even repeatedly finding it easy", () => {
    const maxIndex = REVISION_CONFIG.intervalsDays.length - 1;
    const result = computeNextSchedule(maxIndex, "Easy", NOW);
    expect(result.intervalIndex).toBe(maxIndex);
  });

  it("caps a large Easy jump at the top of the ladder rather than overshooting", () => {
    const maxIndex = REVISION_CONFIG.intervalsDays.length - 1;
    const result = computeNextSchedule(maxIndex - 1, "Easy", NOW);
    expect(result.intervalIndex).toBe(maxIndex);
  });

  it("always schedules the next due date relative to the review time, not the previous due date", () => {
    const reviewedLate = new Date(NOW.getTime() + 10 * DAY_MS); // reviewed 10 days after it was technically due
    const result = computeNextSchedule(1, "Moderate", reviewedLate);
    expect(result.dueAt.getTime()).toBe(reviewedLate.getTime() + REVISION_CONFIG.intervalsDays[2] * DAY_MS);
  });

  it("walks the full ladder correctly across repeated Moderate reviews", () => {
    let index = 0;
    let current = NOW;
    const seenIndices = [index];
    for (let i = 0; i < 4; i++) {
      const result = computeNextSchedule(index, "Moderate", current);
      index = result.intervalIndex;
      current = result.dueAt;
      seenIndices.push(index);
    }
    expect(seenIndices).toEqual([0, 1, 2, 3, 4]);
  });
});
