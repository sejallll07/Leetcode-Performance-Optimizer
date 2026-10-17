import { describe, expect, it } from "vitest";
import { categorizeRevisionItems } from "@/lib/revision/revision-categorizer";
import {
  FEEDBACK_OPTIONS,
  INITIAL_QUEUE_SIZE,
  buildRevisionView,
  daysFromToday,
  formatDueLabel,
  formatReviewedLabel,
  formatSavedMessage,
  getFeedbackPreviews,
  getSessionProgress,
} from "@/lib/revision/revision-view";
import type { RevisionCenterData, RevisionItemState } from "@/lib/revision/types";

const now = new Date("2026-10-05T10:00:00Z");

function makeItem(id: string, dueAt: string, extra: Partial<RevisionItemState> = {}): RevisionItemState {
  return {
    id,
    problemSlug: `problem-${id}`,
    problemTitle: `Problem ${id}`,
    difficulty: "Medium",
    topicSlug: "array",
    topicName: "Array",
    intervalIndex: 1,
    dueAt: new Date(dueAt),
    lastReviewedAt: null,
    lastFeedback: null,
    reviewCount: 0,
    ...extra,
  };
}

describe("due labels use the same UTC-day boundaries as the categorizer", () => {
  it("fixes the cases where the old label contradicted the section", () => {
    expect(formatDueLabel(new Date("2026-10-04T23:00:00Z"), now)).toBe("Overdue 1 day"); // was "due today"
    expect(formatDueLabel(new Date("2026-10-05T22:00:00Z"), now)).toBe("Due today"); // was "due in 1 day"
    expect(formatDueLabel(new Date("2026-10-06T01:00:00Z"), now)).toBe("Due tomorrow");
    expect(formatDueLabel(new Date("2026-10-04T05:00:00Z"), now)).toBe("Overdue 1 day");
    expect(formatDueLabel(new Date("2026-09-30T05:00:00Z"), now)).toBe("Overdue 5 days");
    expect(formatDueLabel(new Date("2026-10-09T05:00:00Z"), now)).toBe("Due in 4 days");
  });

  it("never disagrees with the categorizer, at any hour from 4 days before to 4 days after", () => {
    for (let hours = -96; hours <= 96; hours += 1) {
      const dueAt = new Date(now.getTime() + hours * 60 * 60 * 1000);
      const data = categorizeRevisionItems([makeItem("x", dueAt.toISOString())], now);
      const label = formatDueLabel(dueAt, now);
      if (data.overdue.totalCount === 1) expect(label, `${hours}h`).toMatch(/^Overdue/);
      else if (data.dueToday.totalCount === 1) expect(label, `${hours}h`).toBe("Due today");
      else expect(label, `${hours}h`).toMatch(/^Due (tomorrow|in)/);
    }
  });

  it("daysFromToday counts whole UTC calendar days", () => {
    expect(daysFromToday(new Date("2026-10-05T23:59:59Z"), now)).toBe(0);
    expect(daysFromToday(new Date("2026-10-06T00:00:00Z"), now)).toBe(1);
    expect(daysFromToday(new Date("2026-10-04T23:59:59Z"), now)).toBe(-1);
  });

  it("reviewed labels", () => {
    expect(formatReviewedLabel(new Date("2026-10-05T01:00:00Z"), now)).toBe("Reviewed today");
    expect(formatReviewedLabel(new Date("2026-10-04T20:00:00Z"), now)).toBe("Reviewed yesterday");
    expect(formatReviewedLabel(new Date("2026-10-01T20:00:00Z"), now)).toBe("Reviewed 4 days ago");
  });
});

describe("feedback", () => {
  it("keeps the stored values and uses the agreed wording", () => {
    expect(FEEDBACK_OPTIONS).toEqual([
      { feedback: "Easy", label: "Easy — got it" },
      { feedback: "Moderate", label: "Moderate — needed a push" },
      { feedback: "Difficult", label: "Difficult — struggled" },
    ]);
  });

  it("previews what the real scheduler would do for each rating", () => {
    expect(getFeedbackPreviews(0, now)).toEqual({ Easy: "2 weeks", Moderate: "1 week", Difficult: "3 days" });
    expect(getFeedbackPreviews(1, now)).toEqual({ Easy: "1 month", Moderate: "2 weeks", Difficult: "3 days" });
    expect(getFeedbackPreviews(2, now)).toEqual({ Easy: "2 months", Moderate: "1 month", Difficult: "1 week" });
  });

  it("clamps at both ends of the ladder", () => {
    expect(getFeedbackPreviews(4, now)).toEqual({ Easy: "2 months", Moderate: "2 months", Difficult: "1 month" });
    expect(getFeedbackPreviews(0, now).Difficult).toBe("3 days");
  });

  it("builds the inline save message", () => {
    expect(formatSavedMessage("Two Sum", "2 weeks")).toBe("Two Sum saved — next review in 2 weeks");
  });
});

describe("session progress", () => {
  it("is reviewed out of reviewed + still waiting", () => {
    expect(getSessionProgress(0, 8)).toEqual({ reviewed: 0, total: 8, fraction: 0 });
    expect(getSessionProgress(3, 5)).toEqual({ reviewed: 3, total: 8, fraction: 3 / 8 });
    expect(getSessionProgress(8, 0)).toEqual({ reviewed: 8, total: 8, fraction: 1 });
  });

  it("copes with an empty queue", () => {
    expect(getSessionProgress(0, 0)).toEqual({ reviewed: 0, total: 0, fraction: 0 });
  });

  it("shows five items before 'Show more'", () => {
    expect(INITIAL_QUEUE_SIZE).toBe(5);
  });
});

describe("buildRevisionView", () => {
  const data: RevisionCenterData = {
    overdue: {
      totalCount: 3,
      items: [
        makeItem("o1", "2026-09-29T00:00:00Z", { intervalIndex: 2, reviewCount: 2 }), // 6 days overdue
        makeItem("o2", "2026-10-03T00:00:00Z", { topicName: null, topicSlug: null }),
      ],
    },
    dueToday: { totalCount: 1, items: [makeItem("t1", "2026-10-05T00:00:00Z")] },
    upcoming: {
      totalCount: 4,
      items: [makeItem("u1", "2026-10-07T00:00:00Z", { intervalIndex: 3 }), makeItem("u2", "2026-10-12T00:00:00Z")],
    },
    recentlyCompleted: {
      totalCount: 12,
      items: [
        makeItem("c1", "2026-10-19T00:00:00Z", {
          lastReviewedAt: new Date("2026-10-04T12:00:00Z"),
          lastFeedback: "Easy",
          reviewCount: 3,
        }),
      ],
    },
  };
  const view = buildRevisionView(data, now);

  it("merges overdue then due today into one queue, most overdue first", () => {
    expect(view.queue.items.map((i) => [i.id, i.group])).toEqual([
      ["o1", "overdue"],
      ["o2", "overdue"],
      ["t1", "due-today"],
    ]);
  });

  it("reports honest totals, including items the display caps left off", () => {
    expect(view.queue).toMatchObject({ total: 4, overdueTotal: 3, dueTodayTotal: 1, hiddenByCap: 1 });
  });

  it("gives each queue item its labels, ladder position, link and rating previews", () => {
    const first = view.queue.items[0];
    expect(first).toMatchObject({
      daysOverdue: 6,
      dueLabel: "Overdue 6 days",
      ladderStep: 3,
      ladderSteps: 5,
      intervalLabel: "2 weeks",
      reviewCount: 2,
      url: "https://leetcode.com/problems/problem-o1/",
      topic: "Array",
    });
    expect(first.previews).toEqual({ Easy: "2 months", Moderate: "1 month", Difficult: "1 week" });
    expect(view.queue.items[2]).toMatchObject({ daysOverdue: 0, dueLabel: "Due today" });
  });

  it("falls back to 'Uncategorized' when an item has no topic", () => {
    expect(view.queue.items[1].topic).toBe("Uncategorized");
  });

  it("summarises the queue, the upcoming count, recent reviews and what's next", () => {
    expect(view.summary).toEqual({
      dueNow: 4,
      overdue: 3,
      dueToday: 1,
      upcoming: 4,
      reviewedRecently: 12,
      windowDays: 14,
      nextUp: { problemTitle: "Problem u1", dueLabel: "Due in 2 days" },
    });
  });

  it("has no 'next up' when nothing is scheduled", () => {
    const empty = buildRevisionView(
      {
        overdue: { items: [], totalCount: 0 },
        dueToday: { items: [], totalCount: 0 },
        upcoming: { items: [], totalCount: 0 },
        recentlyCompleted: { items: [], totalCount: 0 },
      },
      now
    );
    expect(empty.summary.nextUp).toBeNull();
    expect(empty.queue).toEqual({ items: [], total: 0, overdueTotal: 0, dueTodayTotal: 0, hiddenByCap: 0 });
  });

  it("builds compact rows for upcoming and recently completed", () => {
    expect(view.upcoming.total).toBe(4);
    expect(view.upcoming.rows[0]).toMatchObject({ id: "u1", dueLabel: "Due in 2 days", ladderStep: 4, intervalLabel: "1 month" });
    expect(view.completed).toMatchObject({ total: 12, windowDays: 14 });
    expect(view.completed.rows[0]).toMatchObject({
      id: "c1",
      feedback: "Easy",
      reviewedLabel: "Reviewed yesterday",
      nextReview: "Due in 14 days",
    });
  });

  it("does not mutate its input", () => {
    const before = JSON.stringify(data);
    buildRevisionView(data, now);
    expect(JSON.stringify(data)).toBe(before);
  });
});