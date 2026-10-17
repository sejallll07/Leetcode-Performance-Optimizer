import type { AnalyticsInput, BasicAnalytics, Difficulty } from "@/lib/analytics/types";

const DAY_MS = 24 * 60 * 60 * 1000;

const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];

export function computeBasicAnalytics(input: AnalyticsInput): BasicAnalytics {
  const { submissions, lifetimeStats, now } = input;

  const submissionsLast7Days = submissions.filter(
    (s) => now.getTime() - s.submittedAt.getTime() <= 7 * DAY_MS
  ).length;
  const submissionsLast30Days = submissions.filter(
    (s) => now.getTime() - s.submittedAt.getTime() <= 30 * DAY_MS
  ).length;

  const mostRecentSubmissionAt =
    submissions.length === 0
      ? null
      : submissions.reduce((latest, s) => (s.submittedAt > latest ? s.submittedAt : latest), submissions[0].submittedAt);

  const daysSinceLastSubmission =
    mostRecentSubmissionAt === null
      ? null
      : Math.floor((now.getTime() - mostRecentSubmissionAt.getTime()) / DAY_MS);

  const topicCounts = new Map<string, { name: string; count: number }>();
  for (const submission of submissions) {
    for (const slug of submission.topicSlugs) {
      const existing = topicCounts.get(slug);
      const name = submission.topicNames[slug] ?? slug;
      topicCounts.set(slug, { name, count: (existing?.count ?? 0) + 1 });
    }
  }
  const topicDistribution = [...topicCounts.entries()]
    .map(([topicSlug, { name, count }]) => ({ topicSlug, topicName: name, count }))
    .sort((a, b) => b.count - a.count);

  const difficultyDistribution = DIFFICULTIES.map((difficulty) => ({
    difficulty,
    count: submissions.filter((s) => s.difficulty === difficulty).length,
  }));

  // A light/new user's full history can fit inside our ~20-submission
  // sample; a prolific solver's can't. This is what tells the rest of
  // the engine (and eventually the UI) how much weight the sample deserves.
  const sampleCoverage: BasicAnalytics["sampleCoverage"] =
    lifetimeStats.totalSolved <= submissions.length ? "complete" : "partial";

  return {
    totalSolved: lifetimeStats.totalSolved,
    easySolved: lifetimeStats.easySolved,
    mediumSolved: lifetimeStats.mediumSolved,
    hardSolved: lifetimeStats.hardSolved,
    recentActivity: {
      submissionsLast7Days,
      submissionsLast30Days,
      mostRecentSubmissionAt,
      daysSinceLastSubmission,
    },
    topicDistribution,
    difficultyDistribution,
    submissionStats: {
      acceptedSubmissionsSampled: submissions.length,
      note:
        "LeetCode's public API only exposes accepted submissions without a login session, so this reflects accepted problems only — attempted-but-failed submissions aren't available yet.",
    },
    sampleCoverage,
  };
}
