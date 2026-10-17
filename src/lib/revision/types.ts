export type RevisionFeedback = "Easy" | "Moderate" | "Difficult";

export type ScheduleResult = {
  intervalIndex: number;
  dueAt: Date;
};

export type RevisionItemState = {
  id: string;
  problemSlug: string;
  problemTitle: string;
  difficulty: "Easy" | "Medium" | "Hard";
  topicSlug: string | null;
  topicName: string | null;
  intervalIndex: number;
  dueAt: Date;
  lastReviewedAt: Date | null;
  lastFeedback: RevisionFeedback | null;
  reviewCount: number;
};

/**
 * A capped, display-ready slice of one Revision Center list, plus
 * the true count before capping. `totalCount` is what the UI's
 * count badge and any "X more not shown" note are built from — the
 * cap is a display concern, never a silent one; nothing should ever
 * report a number the person can't otherwise reconcile.
 */
export type RevisionSectionState = {
  items: RevisionItemState[];
  totalCount: number;
};

export type RevisionCenterData = {
  overdue: RevisionSectionState;
  dueToday: RevisionSectionState;
  upcoming: RevisionSectionState;
  recentlyCompleted: RevisionSectionState;
};
