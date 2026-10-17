import type { AnalyticsInput, Difficulty, TopicAnalytics } from "@/lib/analytics/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];
const DIFFICULTY_WEIGHT: Record<Difficulty, number> = { Easy: 1, Medium: 2, Hard: 3 };

/**
 * One row per topic the user has *any* sampled evidence for — never
 * the full curriculum list. Topics the user hasn't touched at all
 * aren't analyzed here; that's the separate, larger "fundamental gap
 * against the curriculum" feature noted as deferred in PROJECT_STATUS.md.
 */
export function computeTopicAnalytics(input: AnalyticsInput): TopicAnalytics[] {
  const { submissions, now } = input;

  const byTopic = new Map<string, { name: string; items: typeof submissions }>();
  for (const submission of submissions) {
    for (const slug of submission.topicSlugs) {
      const name = submission.topicNames[slug] ?? slug;
      const existing = byTopic.get(slug);
      if (existing) {
        existing.items.push(submission);
      } else {
        byTopic.set(slug, { name, items: [submission] });
      }
    }
  }

  const results: TopicAnalytics[] = [];

  for (const [topicSlug, { name, items }] of byTopic) {
    const sorted = [...items].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
    const lastPracticedAt = sorted[sorted.length - 1].submittedAt;
    const daysSinceLastPracticed = Math.floor((now.getTime() - lastPracticedAt.getTime()) / DAY_MS);

    const difficultyDistribution = DIFFICULTIES.map((difficulty) => ({
      difficulty,
      count: items.filter((i) => i.difficulty === difficulty).length,
    }));
    const diversityCount = difficultyDistribution.filter((d) => d.count > 0).length;

    // Explainable proxy for "historical performance": compare the
    // average difficulty of the earlier half of this topic's sampled
    // submissions against the later half. We only ever see a handful
    // of recent submissions, so this is a trend across the sample,
    // not a real longitudinal history — see PROJECT_STATUS.md.
    let difficultyTrend: TopicAnalytics["difficultyTrend"] = "insufficient-data";
    if (sorted.length >= 2) {
      const mid = Math.floor(sorted.length / 2);
      const earlier = sorted.slice(0, mid || 1);
      const later = sorted.slice(mid || 1);
      const avg = (group: typeof sorted) =>
        group.reduce((sum, s) => sum + DIFFICULTY_WEIGHT[s.difficulty], 0) / group.length;
      difficultyTrend = avg(later) > avg(earlier) ? "increasing" : "steady";
    }

    results.push({
      topicSlug,
      topicName: name,
      problemCount: items.length,
      difficultyDistribution,
      lastPracticedAt,
      daysSinceLastPracticed,
      diversityCount,
      difficultyTrend,
    });
  }

  return results.sort((a, b) => b.problemCount - a.problemCount);
}
