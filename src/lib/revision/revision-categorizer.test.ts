import { describe, expect, it } from "vitest";
import { categorizeRevisionItems } from "@/lib/revision/revision-categorizer";
import { REVISION_CONFIG } from "@/lib/revision/config";
import type { RevisionItemState } from "@/lib/revision/types";

const NOW = new Date("2026-06-15T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function item(overrides: Partial<RevisionItemState> = {}): RevisionItemState {
  return {
    id: "item-1",
    problemSlug: "two-sum",
    problemTitle: "Two Sum",
    difficulty: "Easy",
    topicSlug: "array",
    topicName: "Array",
    intervalIndex: 0,
    dueAt: NOW,
    lastReviewedAt: null,
    lastFeedback: null,
    reviewCount: 0,
    ...overrides,
  };
}

describe("categorizeRevisionItems", () => {
  it("puts a past-due item in overdue, not due-today", () => {
    const result = categorizeRevisionItems([item({ dueAt: new Date(NOW.getTime() - 3 * DAY_MS) })], NOW);
    expect(result.overdue.items).toHaveLength(1);
    expect(result.overdue.totalCount).toBe(1);
    expect(result.dueToday.items).toHaveLength(0);
  });

  it("puts an item due earlier today in due-today, not overdue", () => {
    const dueEarlierToday = new Date(Date.UTC(2026, 5, 15, 1, 0, 0)); // same UTC calendar day as NOW
    const result = categorizeRevisionItems([item({ dueAt: dueEarlierToday })], NOW);
    expect(result.dueToday.items).toHaveLength(1);
    expect(result.overdue.items).toHaveLength(0);
  });

  it("puts a future item in upcoming only", () => {
    const result = categorizeRevisionItems([item({ dueAt: new Date(NOW.getTime() + 5 * DAY_MS) })], NOW);
    expect(result.upcoming.items).toHaveLength(1);
    expect(result.overdue.items).toHaveLength(0);
    expect(result.dueToday.items).toHaveLength(0);
  });

  it("sorts overdue and upcoming soonest-first", () => {
    const result = categorizeRevisionItems(
      [
        item({ id: "later", dueAt: new Date(NOW.getTime() + 10 * DAY_MS) }),
        item({ id: "sooner", dueAt: new Date(NOW.getTime() + 2 * DAY_MS) }),
      ],
      NOW
    );
    expect(result.upcoming.items.map((i) => i.id)).toEqual(["sooner", "later"]);
  });

  it("includes a recently-reviewed item in recentlyCompleted regardless of its new due date", () => {
    const result = categorizeRevisionItems(
      [
        item({
          lastReviewedAt: new Date(NOW.getTime() - 2 * DAY_MS),
          dueAt: new Date(NOW.getTime() + 7 * DAY_MS), // its new schedule, now in the future
        }),
      ],
      NOW
    );
    expect(result.recentlyCompleted.items).toHaveLength(1);
    expect(result.upcoming.items).toHaveLength(1); // both views are legitimately true at once
  });

  it("excludes a review from long enough ago from recentlyCompleted", () => {
    const result = categorizeRevisionItems(
      [item({ lastReviewedAt: new Date(NOW.getTime() - 30 * DAY_MS), dueAt: new Date(NOW.getTime() + 30 * DAY_MS) })],
      NOW
    );
    expect(result.recentlyCompleted.items).toHaveLength(0);
  });

  it("never includes an item with no review history in recentlyCompleted", () => {
    const result = categorizeRevisionItems([item({ lastReviewedAt: null })], NOW);
    expect(result.recentlyCompleted.items).toHaveLength(0);
  });

  it("sorts recentlyCompleted most-recent-first", () => {
    const result = categorizeRevisionItems(
      [
        item({ id: "older", lastReviewedAt: new Date(NOW.getTime() - 5 * DAY_MS) }),
        item({ id: "newer", lastReviewedAt: new Date(NOW.getTime() - 1 * DAY_MS) }),
      ],
      NOW
    );
    expect(result.recentlyCompleted.items.map((i) => i.id)).toEqual(["newer", "older"]);
  });

  it("handles an empty list without error", () => {
    const result = categorizeRevisionItems([], NOW);
    expect(result).toEqual({
      overdue: { items: [], totalCount: 0 },
      dueToday: { items: [], totalCount: 0 },
      upcoming: { items: [], totalCount: 0 },
      recentlyCompleted: { items: [], totalCount: 0 },
    });
  });

  // --- Phase 7 known-issue fix: no section should grow unbounded ---

  it("caps overdue at its configured limit while still reporting the true total", () => {
    const cap = REVISION_CONFIG.sectionCaps.overdue;
    const items = Array.from({ length: cap + 7 }, (_, i) =>
      item({ id: `overdue-${i}`, dueAt: new Date(NOW.getTime() - (i + 1) * DAY_MS) })
    );
    const result = categorizeRevisionItems(items, NOW);
    expect(result.overdue.items).toHaveLength(cap);
    expect(result.overdue.totalCount).toBe(cap + 7);
  });

  it("keeps the most-overdue items when overdue is capped, not an arbitrary subset", () => {
    const cap = REVISION_CONFIG.sectionCaps.overdue;
    const items = Array.from({ length: cap + 5 }, (_, i) =>
      item({ id: `overdue-${i}`, dueAt: new Date(NOW.getTime() - (i + 1) * DAY_MS) })
    );
    const result = categorizeRevisionItems(items, NOW);
    // Furthest-in-the-past dueAt (largest offset index) is the most overdue and must survive the cap.
    expect(result.overdue.items.map((i) => i.id)).toContain(`overdue-${cap + 4}`);
  });

  it("caps upcoming at its configured limit, keeping the soonest-due items", () => {
    const cap = REVISION_CONFIG.sectionCaps.upcoming;
    const items = Array.from({ length: cap + 10 }, (_, i) =>
      item({ id: `upcoming-${i}`, dueAt: new Date(NOW.getTime() + (i + 2) * DAY_MS) })
    );
    const result = categorizeRevisionItems(items, NOW);
    expect(result.upcoming.items).toHaveLength(cap);
    expect(result.upcoming.totalCount).toBe(cap + 10);
    expect(result.upcoming.items[0].id).toBe("upcoming-0"); // soonest-due, index +2 days, survives the cap
  });

  it("caps dueToday at its configured limit while still reporting the true total", () => {
    const cap = REVISION_CONFIG.sectionCaps.dueToday;
    const items = Array.from({ length: cap + 3 }, (_, i) => item({ id: `today-${i}`, dueAt: NOW }));
    const result = categorizeRevisionItems(items, NOW);
    expect(result.dueToday.items).toHaveLength(cap);
    expect(result.dueToday.totalCount).toBe(cap + 3);
  });

  it("does not cap a section that's already under the limit", () => {
    const result = categorizeRevisionItems([item({ dueAt: new Date(NOW.getTime() - DAY_MS) })], NOW);
    expect(result.overdue.items).toHaveLength(1);
    expect(result.overdue.totalCount).toBe(1);
  });
});
