import { describe, expect, it } from "vitest";
import { computePeriodBounds } from "@/lib/reports/period";

describe("computePeriodBounds — WEEKLY", () => {
  it("returns the current Monday-Sunday week for offset 0, isCurrent true", () => {
    const now = new Date("2026-09-30T12:00:00Z"); // a Wednesday
    const period = computePeriodBounds("WEEKLY", now, 0);
    expect(period.start.toISOString()).toBe("2026-09-28T00:00:00.000Z"); // Monday
    expect(period.end.toISOString()).toBe("2026-10-05T00:00:00.000Z"); // next Monday, exclusive
    expect(period.isCurrent).toBe(true);
  });

  it("steps back a full 7 days per offset", () => {
    const now = new Date("2026-09-30T12:00:00Z");
    const lastWeek = computePeriodBounds("WEEKLY", now, 1);
    expect(lastWeek.start.toISOString()).toBe("2026-09-21T00:00:00.000Z");
    expect(lastWeek.end.toISOString()).toBe("2026-09-28T00:00:00.000Z");
    expect(lastWeek.isCurrent).toBe(false);
  });

  it("treats Sunday as the last day of its own week, not the start of the next", () => {
    const sunday = new Date("2026-10-04T12:00:00Z"); // Sunday
    const period = computePeriodBounds("WEEKLY", sunday, 0);
    expect(period.start.toISOString()).toBe("2026-09-28T00:00:00.000Z");
    expect(period.isCurrent).toBe(true);
  });

  it("labels a week that spans two months with both month abbreviations", () => {
    const now = new Date("2026-09-30T12:00:00Z");
    const period = computePeriodBounds("WEEKLY", now, 0);
    expect(period.label).toBe("Sep 28 – Oct 4, 2026");
  });

  it("labels a week that spans a year boundary with both years", () => {
    const now = new Date("2026-12-31T12:00:00Z"); // Thursday
    const period = computePeriodBounds("WEEKLY", now, 0);
    expect(period.label).toContain("2026");
    expect(period.label).toContain("2027");
  });

  it("throws on a negative offset", () => {
    expect(() => computePeriodBounds("WEEKLY", new Date(), -1)).toThrow();
  });
});

describe("computePeriodBounds — MONTHLY", () => {
  it("returns the current calendar month for offset 0", () => {
    const now = new Date("2026-09-30T12:00:00Z");
    const period = computePeriodBounds("MONTHLY", now, 0);
    expect(period.start.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(period.label).toBe("September 2026");
    expect(period.isCurrent).toBe(true);
  });

  it("steps back across a year boundary correctly", () => {
    const now = new Date("2026-01-15T12:00:00Z");
    const lastMonth = computePeriodBounds("MONTHLY", now, 1);
    expect(lastMonth.start.toISOString()).toBe("2025-12-01T00:00:00.000Z");
    expect(lastMonth.end.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(lastMonth.label).toBe("December 2025");
    expect(lastMonth.isCurrent).toBe(false);
  });

  it("steps back several months, including a leap-year February", () => {
    const now = new Date("2028-03-10T00:00:00Z");
    const twoBack = computePeriodBounds("MONTHLY", now, 2); // January 2028
    expect(twoBack.label).toBe("January 2028");
    const oneBack = computePeriodBounds("MONTHLY", now, 1); // February 2028 (leap year, 29 days)
    expect(oneBack.start.toISOString()).toBe("2028-02-01T00:00:00.000Z");
    expect(oneBack.end.toISOString()).toBe("2028-03-01T00:00:00.000Z");
  });
});
