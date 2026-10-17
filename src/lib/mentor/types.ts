import type { Confidence, Difficulty, ProgressTrendStatus } from "@/lib/analytics/types";

export type MentorTopicSummary = {
  topicSlug: string;
  topicName: string;
  masteryScore: number;
  confidence: Confidence;
  /** Lifted straight from mastery.ts's own explanation (or gap-detection's, for a prerequisite-driven weakness) — same "never say anything the engine hasn't already justified" discipline as next-actions.ts and the roadmap. */
  explanation: string;
};

export type MentorRecommendation = {
  problemSlug: string;
  problemTitle: string;
  difficulty: Difficulty;
  topicName: string;
  reason: string;
};

/** A recently solved problem — concrete enough for the mentor to reference by name ("you solved Two Sum 3 days ago"), not just an aggregate stat. */
export type MentorHistoryEntry = {
  problemTitle: string;
  topicNames: string[];
  difficulty: Difficulty;
  daysAgo: number;
};

export type MentorRevisionSummary = {
  overdueCount: number;
  dueTodayCount: number;
  /** A few concrete examples, not the whole backlog — same capped-but-honest spirit as Phase 7's RevisionSectionState, just simpler since the mentor only needs enough to speak concretely, not a full accounting. */
  sample: { problemTitle: string; topicName: string | null }[];
};

export type MentorRoadmapSummary = {
  recommendedNextTopic: { topicName: string; reason: string } | null;
  recommendedNextCount: number;
  postponedCount: number;
};

/**
 * The whole "structured summary of the student's profile" the brief
 * asks for, in place of the AI ever touching the database directly.
 * `hasProfile: false` is its own case (not just empty arrays)
 * because "no LeetCode profile connected yet" is a genuinely
 * different situation the mentor should respond to differently, not
 * a student who's connected but has zero evidence anywhere.
 */
export type MentorContext =
  | { hasProfile: false; studentName: string }
  | {
      hasProfile: true;
      studentName: string;
      readiness: { score: number; level: string; explanation: string };
      strongTopics: MentorTopicSummary[];
      weakTopics: MentorTopicSummary[];
      fundamentalGaps: MentorTopicSummary[];
      revisionNeededTopics: MentorTopicSummary[];
      recentActivity: {
        status: ProgressTrendStatus;
        averageDelta: number | null;
        topicsImproved: number;
        topicsDeclined: number;
        explanation: string;
        daysSinceLastSubmission: number | null;
      };
      revisionDue: MentorRevisionSummary;
      recommendedProblems: MentorRecommendation[];
      roadmap: MentorRoadmapSummary;
      relevantHistory: MentorHistoryEntry[];
    };

/** One turn of the mentor conversation, in the shape the AI provider consumes — a plain role/content pair, independent of the DB row shape (no id/hintLevel/problemSlug metadata leaks into the model's own message array). */
export type MentorChatTurn = { role: "user" | "assistant"; content: string };

/**
 * How far a student has gotten into the 6-level progressive hint
 * ladder for one specific problem, derived from their own stored
 * message history — see hint-tracking.ts. No `problemTitle` here
 * deliberately: mentor_messages stores only the slug (see
 * schema.prisma's comment), so a display name is resolved
 * separately from the problem catalog wherever this is rendered —
 * one source of truth for problem metadata, not a second copy.
 */
export type HintProgressEntry = {
  problemSlug: string;
  currentLevel: number; // 1-6, the highest level given so far
};
