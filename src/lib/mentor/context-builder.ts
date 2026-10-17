import { MENTOR_CONFIG } from "@/lib/mentor/config";
import type { MentorContext, MentorTopicSummary } from "@/lib/mentor/types";
import type { AnalyticsEngineResult, MasteryResult, ProgressTrend, SubmissionInput } from "@/lib/analytics/types";
import type { RevisionCenterData } from "@/lib/revision/types";
import type { RoadmapResult } from "@/lib/roadmap/types";

function toTopicSummary(m: MasteryResult): MentorTopicSummary {
  const isPrerequisiteGap = m.gapVerdict === "prerequisite-gap";
  return {
    topicSlug: m.topicSlug,
    topicName: m.topicName,
    masteryScore: m.masteryScore,
    confidence: m.confidence,
    // Same choice as roadmap-builder.ts: prefer the root-cause explanation when there is one.
    explanation: isPrerequisiteGap ? m.gapExplanation : m.explanation,
  };
}

const byScoreAsc = (a: MentorTopicSummary, b: MentorTopicSummary) => a.masteryScore - b.masteryScore;
const byScoreDesc = (a: MentorTopicSummary, b: MentorTopicSummary) => b.masteryScore - a.masteryScore;

export type MentorContextInput =
  | { studentName: string; hasProfile: false }
  | {
      studentName: string;
      hasProfile: true;
      analytics: AnalyticsEngineResult;
      progressTrend: ProgressTrend;
      revisionData: RevisionCenterData;
      roadmap: RoadmapResult;
      submissions: SubmissionInput[];
      now: Date;
    };

/**
 * The one place the "structured summary of the student's profile"
 * the brief asks for gets assembled — pure, no DB, no AI call.
 * Everything here is a re-shaping of data the analytics/revision/
 * roadmap engines already computed elsewhere in the app; this file
 * never scores or classifies anything itself. That boundary (AI
 * gets explanations and summaries, never does the scoring) has held
 * since Phase 0 and this phase doesn't change it.
 */
export function buildMentorContext(input: MentorContextInput): MentorContext {
  if (!input.hasProfile) {
    return { hasProfile: false, studentName: input.studentName };
  }

  const { analytics, progressTrend, revisionData, roadmap, submissions, now } = input;

  const strongTopics = analytics.mastery
    .filter((m) => m.classification === "Strong")
    .map(toTopicSummary)
    .sort(byScoreDesc)
    .slice(0, MENTOR_CONFIG.maxStrongTopicsShown);

  const weakTopics = analytics.mastery
    .filter((m) => m.classification === "Weak")
    .map(toTopicSummary)
    .sort(byScoreAsc)
    .slice(0, MENTOR_CONFIG.maxWeakTopicsShown);

  const fundamentalGaps = analytics.mastery
    .filter((m) => m.classification === "Fundamental Gap")
    .map(toTopicSummary)
    .sort(byScoreAsc)
    .slice(0, MENTOR_CONFIG.maxFundamentalGapsShown);

  const revisionNeededTopics = analytics.mastery
    .filter((m) => m.classification === "Revision Needed")
    .map(toTopicSummary)
    .sort(byScoreAsc)
    .slice(0, MENTOR_CONFIG.maxRevisionNeededShown);

  const recommendedProblems = analytics.recommendations.practiceToday
    .slice(0, MENTOR_CONFIG.maxRecommendationsShown)
    .map((r) => ({
      problemSlug: r.problemSlug,
      problemTitle: r.problemTitle,
      difficulty: r.difficulty,
      topicName: r.topicName,
      reason: r.reason,
    }));

  const revisionDue = {
    overdueCount: revisionData.overdue.totalCount,
    dueTodayCount: revisionData.dueToday.totalCount,
    sample: revisionData.overdue.items.slice(0, MENTOR_CONFIG.maxRevisionSampleShown).map((i) => ({
      problemTitle: i.problemTitle,
      topicName: i.topicName,
    })),
  };

  const roadmapSummary = {
    recommendedNextTopic: roadmap.recommendedNextTopic
      ? { topicName: roadmap.recommendedNextTopic.topicName, reason: roadmap.recommendedNextTopic.actionReason }
      : null,
    recommendedNextCount: roadmap.groups.recommendedNext.length,
    postponedCount: roadmap.groups.postponed.length,
  };

  const DAY_MS = 24 * 60 * 60 * 1000;
  const relevantHistory = [...submissions]
    .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime()) // most recent first
    .slice(0, MENTOR_CONFIG.maxHistoryEntriesShown)
    .map((s) => ({
      problemTitle: s.problemTitle,
      topicNames: s.topicSlugs.map((slug) => s.topicNames[slug] ?? slug),
      difficulty: s.difficulty,
      daysAgo: Math.max(0, Math.floor((now.getTime() - s.submittedAt.getTime()) / DAY_MS)),
    }));

  return {
    hasProfile: true,
    studentName: input.studentName,
    readiness: {
      score: analytics.readiness.score,
      level: analytics.readiness.level,
      explanation: analytics.readiness.explanation,
    },
    strongTopics,
    weakTopics,
    fundamentalGaps,
    revisionNeededTopics,
    recentActivity: {
      status: progressTrend.status,
      averageDelta: progressTrend.averageDelta,
      topicsImproved: progressTrend.topicsImproved,
      topicsDeclined: progressTrend.topicsDeclined,
      explanation: progressTrend.explanation,
      daysSinceLastSubmission: analytics.basic.recentActivity.daysSinceLastSubmission,
    },
    revisionDue,
    recommendedProblems,
    roadmap: roadmapSummary,
    relevantHistory,
  };
}
