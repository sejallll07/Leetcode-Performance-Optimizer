import { INTERVIEW_CONFIG } from "@/lib/interview/config";
import { NO_GUARANTEE_DISCLAIMER } from "@/lib/interview/types";
import type { MockInterviewPerformanceReport, MockInterviewProblemOutcome, MockInterviewProblemPick, MockInterviewSessionSummary, ProblemPerformance } from "@/lib/interview/types";

const { suggestedTimeMinutes } = INTERVIEW_CONFIG;

function summaryFor(solvedCount: number, anyHintsOnSolved: boolean): MockInterviewSessionSummary {
  if (solvedCount === 3 && !anyHintsOnSolved) return "Strong Session";
  if (solvedCount >= 2) return "Solid Session";
  if (solvedCount === 1) return "Mixed Session";
  return "Tough Session";
}

function dedupeTopics(picks: { topicSlugs: string[]; topicNames: string[] }[]): { topicSlug: string; topicName: string }[] {
  const seen = new Map<string, string>();
  for (const p of picks) {
    p.topicSlugs.forEach((slug, i) => {
      if (!seen.has(slug)) seen.set(slug, p.topicNames[i] ?? slug);
    });
  }
  return [...seen.entries()].map(([topicSlug, topicName]) => ({ topicSlug, topicName }));
}

/**
 * Pure: takes the original problem picks (so role/topic/difficulty
 * context survives) plus whatever the student self-reported, and
 * returns a structured, deterministic report. No AI here — see
 * src/lib/interview/narrative.ts for the natural-language layer,
 * which is given this report's output, never asked to compute it.
 */
export function buildPerformanceReport(problems: MockInterviewProblemPick[], outcomes: MockInterviewProblemOutcome[]): MockInterviewPerformanceReport {
  const outcomeBySlug = new Map(outcomes.map((o) => [o.slug, o]));

  const problemPerformances: ProblemPerformance[] = problems.map((p) => {
    const outcome = outcomeBySlug.get(p.slug) ?? { slug: p.slug, outcome: "Skipped" as const, timeTakenMinutes: null, usedHints: false };
    const budget = suggestedTimeMinutes[p.role];
    const withinSuggestedTime = outcome.outcome === "Solved" && outcome.timeTakenMinutes !== null ? outcome.timeTakenMinutes <= budget : null;
    return { ...p, outcome: outcome.outcome, timeTakenMinutes: outcome.timeTakenMinutes, usedHints: outcome.usedHints, withinSuggestedTime };
  });

  const solved = problemPerformances.filter((p) => p.outcome === "Solved");
  const attempted = problemPerformances.filter((p) => p.outcome === "Attempted");
  const cleanSolves = solved.filter((p) => !p.usedHints);
  const needsAnotherLook = problemPerformances.filter((p) => p.outcome !== "Solved" || p.usedHints);

  return {
    problems: problemPerformances,
    solvedCount: solved.length,
    attemptedCount: attempted.length,
    summary: summaryFor(solved.length, solved.some((p) => p.usedHints)),
    strengthsShown: dedupeTopics(cleanSolves),
    areasToRevisit: dedupeTopics(needsAnotherLook).filter((t) => !dedupeTopics(cleanSolves).some((s) => s.topicSlug === t.topicSlug)),
    disclaimer: NO_GUARANTEE_DISCLAIMER,
  };
}
