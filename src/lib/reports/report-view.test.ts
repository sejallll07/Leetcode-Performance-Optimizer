import { describe, expect, it } from "vitest";
import {
  MAX_PRACTICED_CHIPS,
  buildReportView,
  difficultyMix,
  humanizeStatus,
  scoreChange,
  signed,
  trendLabel,
} from "@/lib/reports/report-view";
import type {
  MonthlyReportInsights,
  PeriodBounds,
  ReportNarrative,
  ReportResult,
  WeeklyReportInsights,
} from "@/lib/reports/types";

const ARROW = "\u2192";

function period(type: "WEEKLY" | "MONTHLY", isCurrent = true): PeriodBounds {
  return {
    type,
    start: new Date("2026-10-05T00:00:00Z"),
    end: new Date("2026-10-12T00:00:00Z"),
    label: type === "WEEKLY" ? "Oct 5 - Oct 11, 2026" : "October 2026",
    isCurrent,
  };
}

function weeklyInsights(overrides: Partial<WeeklyReportInsights> = {}): WeeklyReportInsights {
  return {
    period: period("WEEKLY"),
    problemsSolved: { total: 0, byDifficulty: [], problems: [] },
    topicsPracticed: [],
    strongestImprovement: null,
    weakestArea: null,
    neglectedTopics: [],
    revisionPerformance: { reviewsCompleted: 0, feedbackBreakdown: [], currentlyOverdueCount: 0 },
    difficultyProgression: { easyCount: 0, mediumCount: 0, hardCount: 0, trend: "insufficient-data" },
    importantMistakes: [],
    nextWeekFocus: [],
    ...overrides,
  };
}

function monthlyInsights(overrides: Partial<MonthlyReportInsights> = {}): MonthlyReportInsights {
  return {
    period: period("MONTHLY"),
    overallProgress: { totalSolvedStart: 40, totalSolvedEnd: 52, problemsSolvedThisMonth: 12, readinessScoreStart: 60, readinessScoreEnd: 67 },
    masteryChanges: [],
    topicImprovements: [],
    decliningTopics: [],
    newlyDevelopedStrengths: [],
    persistentWeaknesses: [],
    revisionConsistency: { reviewsCompleted: 0, feedbackBreakdown: [], currentlyOverdueCount: null },
    difficultyProgression: { easyCount: 4, mediumCount: 6, hardCount: 2, trend: "steady" },
    interviewReadinessTrend: { scoreStart: 60, scoreEnd: 67, delta: 7, levelStart: "Developing", levelEnd: "Developing" },
    roadmapChanges: [],
    ...overrides,
  };
}

function report(insights: WeeklyReportInsights | MonthlyReportInsights, extra: Partial<ReportResult> = {}): ReportResult {
  return {
    periodType: insights.period.type,
    insights,
    narrative: null,
    narrativeError: null,
    generatedAt: new Date("2026-10-11T00:00:00Z"),
    fromCache: false,
    ...extra,
  };
}

const sectionKeys = (g: { sections: { key: string }[] }) => g.sections.map((s) => s.key);

describe("formatting helpers", () => {
  it("signs positive numbers and leaves zero and negatives alone", () => {
    expect(signed(5)).toBe("+5");
    expect(signed(0)).toBe("0");
    expect(signed(-3)).toBe("-3");
  });

  it("formats a score change, using New when there was no earlier score", () => {
    expect(scoreChange(48, 57)).toBe(`48 ${ARROW} 57`);
    expect(scoreChange(null, 12)).toBe(`New ${ARROW} 12`);
  });

  it("labels the difficulty trend and the mix", () => {
    expect(trendLabel("increasing")).toBe("Rising");
    expect(trendLabel("steady")).toBe("Steady");
    expect(trendLabel("insufficient-data")).toBe("Not enough data");
    expect(difficultyMix(3, 6, 1)).toBe("3E / 6M / 1H");
  });

  it("humanizes status values", () => {
    expect(humanizeStatus("IN_PROGRESS")).toBe("In progress");
    expect(humanizeStatus("needs-work")).toBe("Needs work");
    expect(humanizeStatus("Recommended")).toBe("Recommended");
  });
});

describe("buildReportView: shell", () => {
  it("carries the period, summary and narrative error through", () => {
    const narrative: ReportNarrative = { summary: "s", highlights: ["h"], advice: "a" };
    const view = buildReportView(report(weeklyInsights(), { narrative }));
    expect(view.periodType).toBe("WEEKLY");
    expect(view.periodLabel).toBe("Oct 5 - Oct 11, 2026");
    expect(view.isCurrent).toBe(true);
    expect(view.summary).toEqual(narrative);

    const failed = buildReportView(report(weeklyInsights(), { narrativeError: "boom" }));
    expect(failed.summary).toBeNull();
    expect(failed.narrativeError).toBe("boom");
  });

  it("always returns the three groups in order with four tiles", () => {
    for (const insights of [weeklyInsights(), monthlyInsights()]) {
      const view = buildReportView(report(insights));
      expect(view.groups.map((g) => g.key)).toEqual(["good", "attention", "next"]);
      expect(view.tiles).toHaveLength(4);
    }
  });
});

describe("buildReportView: weekly tiles", () => {
  it("summarizes problems solved by difficulty", () => {
    const view = buildReportView(
      report(
        weeklyInsights({
          problemsSolved: {
            total: 9,
            byDifficulty: [
              { difficulty: "Easy", count: 3 },
              { difficulty: "Medium", count: 6 },
            ],
            problems: [],
          },
        })
      )
    );
    expect(view.tiles[0]).toMatchObject({ key: "solved", value: "9", note: "3 Easy, 6 Medium" });
  });

  it("says so when nothing was solved or reviewed", () => {
    const view = buildReportView(report(weeklyInsights()));
    expect(view.tiles[0].note).toBe("Nothing solved yet");
    expect(view.tiles[1]).toMatchObject({ value: "0", note: "None yet" });
    expect(view.tiles[2].note).toBe("None completed");
  });

  it("shows a warning Overdue tile when items are overdue", () => {
    const view = buildReportView(
      report(weeklyInsights({ revisionPerformance: { reviewsCompleted: 2, feedbackBreakdown: [{ feedback: "Easy", count: 2 }], currentlyOverdueCount: 3 } }))
    );
    expect(view.tiles[2].note).toBe("2 Easy");
    expect(view.tiles[3]).toMatchObject({ key: "overdue", value: "3", note: "Due for review", tone: "warn" });
  });

  it("shows an All clear tile at zero overdue", () => {
    const view = buildReportView(report(weeklyInsights()));
    expect(view.tiles[3]).toMatchObject({ key: "overdue", value: "0", note: "All clear", tone: "good" });
  });

  it("swaps in the difficulty tile for a past week where overdue is unknown", () => {
    const view = buildReportView(
      report(
        weeklyInsights({
          period: period("WEEKLY", false),
          revisionPerformance: { reviewsCompleted: 0, feedbackBreakdown: [], currentlyOverdueCount: null },
          difficultyProgression: { easyCount: 1, mediumCount: 4, hardCount: 2, trend: "increasing" },
        })
      )
    );
    expect(view.tiles[3]).toMatchObject({ key: "difficulty", value: "Rising", note: "1E / 4M / 2H", tone: "good" });
  });
});

describe("buildReportView: weekly groups", () => {
  it("is quiet, with no sections, for an empty week", () => {
    const view = buildReportView(report(weeklyInsights()));
    expect(view.isQuiet).toBe(true);
    expect(view.groups.every((g) => g.sections.length === 0)).toBe(true);
    expect(view.groups[0].emptyMessage).toBe("Nothing to highlight yet this week.");
  });

  it("lists a real improvement under Going well with a score bar", () => {
    const view = buildReportView(
      report(weeklyInsights({ strongestImprovement: { topicSlug: "graphs", topicName: "Graphs", fromScore: 48, toScore: 57, delta: 9, toClassification: "Emerging" } }))
    );
    const good = view.groups[0];
    expect(sectionKeys(good)).toEqual(["improvement"]);
    expect(good.sections[0].rows[0]).toMatchObject({
      label: "Graphs",
      badge: "+9",
      badgeTone: "good",
      detail: `48 ${ARROW} 57`,
      bar: { from: 48, to: 57 },
    });
    expect(view.isQuiet).toBe(false);
  });

  it("does not list a zero or negative best delta as going well", () => {
    for (const delta of [0, -4]) {
      const view = buildReportView(
        report(weeklyInsights({ strongestImprovement: { topicSlug: "dp", topicName: "DP", fromScore: 40, toScore: 40 + delta, delta, toClassification: "Weak" } }))
      );
      expect(view.groups[0].sections).toHaveLength(0);
    }
  });

  it("caps practiced-topic chips and adds a +N more chip", () => {
    const topics = Array.from({ length: MAX_PRACTICED_CHIPS + 3 }, (_, i) => ({ topicSlug: `t${i}`, topicName: `Topic ${i}`, problemCount: 1 }));
    const view = buildReportView(report(weeklyInsights({ topicsPracticed: topics })));
    const chips = view.groups[0].sections.find((s) => s.key === "practiced")!.chips;
    expect(chips).toHaveLength(MAX_PRACTICED_CHIPS + 1);
    expect(chips[0]).toContain("Topic 0");
    expect(chips[chips.length - 1]).toBe("+3 more");
  });

  it("does not add a +N more chip at or under the cap", () => {
    const topics = Array.from({ length: MAX_PRACTICED_CHIPS }, (_, i) => ({ topicSlug: `t${i}`, topicName: `Topic ${i}`, problemCount: 2 }));
    const chips = buildReportView(report(weeklyInsights({ topicsPracticed: topics }))).groups[0].sections[0].chips;
    expect(chips).toHaveLength(MAX_PRACTICED_CHIPS);
  });

  it("fills Needs attention from weakest area, neglected topics and mistakes", () => {
    const view = buildReportView(
      report(
        weeklyInsights({
          weakestArea: { topicSlug: "dp", topicName: "Dynamic Programming", masteryScore: 31, classification: "Weak" },
          neglectedTopics: [{ topicSlug: "heaps", topicName: "Heaps", classification: "Revision Needed", daysSincePracticed: null }],
          importantMistakes: [
            { topicSlug: "arrays", topicName: "Arrays", kind: "difficult-revision", detail: "Two Sum came back Difficult." },
            { topicSlug: "trees", topicName: "Trees", kind: "mastery-decline", detail: "Trees dropped 6 points." },
          ],
        })
      )
    );
    const attention = view.groups[1];
    expect(sectionKeys(attention)).toEqual(["weakest", "neglected", "mistakes"]);
    expect(attention.sections[0].rows[0]).toMatchObject({ badge: "31/100", bar: { from: null, to: 31 } });
    expect(attention.sections[1].rows[0]).toMatchObject({ label: "Heaps", badge: "Revision Needed" });
    expect(attention.sections[2].rows.map((r) => r.badge)).toEqual(["Difficult revision", "Mastery drop"]);
    expect(new Set(attention.sections[2].rows.map((r) => r.key)).size).toBe(2);
  });

  it("makes the focus list ordered and keeps each reason", () => {
    const view = buildReportView(
      report(weeklyInsights({ nextWeekFocus: [{ topicSlug: "dp", topicName: "Dynamic Programming", reason: "Weakest area" }] }))
    );
    const next = view.groups[2];
    expect(next.ordered).toBe(true);
    expect(next.sections[0].rows[0]).toMatchObject({ label: "Dynamic Programming", detail: "Weakest area" });
  });
});

describe("buildReportView: monthly tiles", () => {
  it("shows solved problems with the lifetime range", () => {
    const tile = buildReportView(report(monthlyInsights())).tiles[0];
    expect(tile).toMatchObject({ value: "12", note: `Lifetime 40 ${ARROW} 52` });
  });

  it("shows readiness gain as a good tile", () => {
    const tile = buildReportView(report(monthlyInsights())).tiles[1];
    expect(tile.value).toBe("67");
    expect(tile.tone).toBe("good");
    expect(tile.note).toContain("+7 from 60");
    expect(tile.note).toContain("Developing");
  });

  it("shows a level change and a readiness drop as a warning", () => {
    const tile = buildReportView(
      report(monthlyInsights({ interviewReadinessTrend: { scoreStart: 70, scoreEnd: 64, delta: -6, levelStart: "Ready", levelEnd: "Developing" } }))
    ).tiles[1];
    expect(tile.tone).toBe("warn");
    expect(tile.note).toContain("-6 from 70");
    expect(tile.note).toContain(`Ready ${ARROW} Developing`);
  });

  it("handles the first tracked month and a flat month", () => {
    const first = buildReportView(
      report(monthlyInsights({ interviewReadinessTrend: { scoreStart: null, scoreEnd: 20, delta: null, levelStart: null, levelEnd: "Early" } }))
    ).tiles[1];
    expect(first.tone).toBe("neutral");
    expect(first.note).toContain("First tracked month");

    const flat = buildReportView(
      report(monthlyInsights({ interviewReadinessTrend: { scoreStart: 50, scoreEnd: 50, delta: 0, levelStart: "Developing", levelEnd: "Developing" } }))
    ).tiles[1];
    expect(flat.tone).toBe("neutral");
    expect(flat.note).toContain("No change from 50");
  });

  it("shows difficulty trend and mix", () => {
    expect(buildReportView(report(monthlyInsights())).tiles[3]).toMatchObject({ value: "Steady", note: "4E / 6M / 2H", tone: "neutral" });
  });
});

describe("buildReportView: monthly groups", () => {
  it("is quiet for a month with no movement", () => {
    const view = buildReportView(report(monthlyInsights()));
    expect(view.isQuiet).toBe(true);
    expect(view.groups[2].emptyMessage).toBe("No roadmap group changes this month.");
  });

  it("splits improvements and strengths into Going well", () => {
    const view = buildReportView(
      report(
        monthlyInsights({
          topicImprovements: [{ topicSlug: "graphs", topicName: "Graphs", fromScore: 40, toScore: 55, delta: 15, toClassification: "Emerging" }],
          newlyDevelopedStrengths: [{ topicSlug: "arrays", topicName: "Arrays" }],
        })
      )
    );
    const good = view.groups[0];
    expect(sectionKeys(good)).toEqual(["improved", "strengths"]);
    expect(good.sections[0].rows[0]).toMatchObject({ badge: "+15", badgeTone: "good", bar: { from: 40, to: 55 } });
    expect(good.sections[1].rows[0]).toMatchObject({ label: "Arrays", badge: "Now Strong" });
  });

  it("puts declines and persistent weaknesses under Needs attention", () => {
    const view = buildReportView(
      report(
        monthlyInsights({
          decliningTopics: [{ topicSlug: "trees", topicName: "Trees", fromScore: 60, toScore: 52, delta: -8, toClassification: "Emerging" }],
          persistentWeaknesses: [
            { topicSlug: "dp", topicName: "DP", classification: "Weak", monthsPersistent: 1 },
            { topicSlug: "greedy", topicName: "Greedy", classification: "Fundamental Gap", monthsPersistent: 3 },
          ],
        })
      )
    );
    const attention = view.groups[1];
    expect(sectionKeys(attention)).toEqual(["declining", "persistent"]);
    expect(attention.sections[0].rows[0]).toMatchObject({ badge: "-8", badgeTone: "bad" });
    expect(attention.sections[1].rows.map((r) => r.detail)).toEqual(["1 month running", "3 months running"]);
  });

  it("shows roadmap moves with readable status names", () => {
    const view = buildReportView(
      report(monthlyInsights({ roadmapChanges: [{ topicSlug: "graphs", topicName: "Graphs", fromGroup: "Weak", toGroup: "Recommended Next" }] }))
    );
    const next = view.groups[2];
    expect(next.title).toBe("Roadmap moves");
    expect(next.sections[0].rows[0].detail).toBe(`Weak ${ARROW} Recommended next`);
  });

  it("omits a delta badge when there is no earlier score", () => {
    const view = buildReportView(
      report(monthlyInsights({ topicImprovements: [{ topicSlug: "new", topicName: "New topic", fromScore: null, toScore: 30, delta: null, toClassification: "Weak" }] }))
    );
    const row = view.groups[0].sections[0].rows[0];
    expect(row.badge).toBeUndefined();
    expect(row.detail).toBe(`New ${ARROW} 30`);
  });
});