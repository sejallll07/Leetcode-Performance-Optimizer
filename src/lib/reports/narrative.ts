import type { MonthlyReportInsights, WeeklyReportInsights } from "@/lib/reports/types";

/**
 * Builds the prompt sent to the narration layer (see
 * src/services/reports/claude-report-narrator.ts). Pure — no
 * network, fully unit-testable on its own, same split as
 * src/lib/mentor/context-builder.ts + system-prompt.ts. The model
 * never sees raw DB data, only the already-computed insight fields
 * below — it is explicitly told to interpret, not invent, so a
 * narration failure can never introduce a number the deterministic
 * engine didn't produce.
 */

const PERSONA = `You are writing the natural-language narrative section of a DSA Intelligence report — a personalized LeetCode analytics and coaching tool for a student preparing for software engineering interviews.

Rules:
- Every number, topic name, and claim below has already been computed deterministically. Your job is to interpret and phrase it clearly, never to invent a statistic, topic, or fact that isn't in the data given to you.
- Write like an encouraging but honest coach, not a generic chatbot. Be specific — name topics and numbers directly rather than talking in vague generalities.
- Don't pad with filler ("Great job this week!") that isn't backed by something in the data. If the data shows a rough week, say so plainly and constructively.
- Reply with STRICT JSON only — no markdown code fences, no text before or after the JSON object — matching exactly this shape:
{"summary": string, "highlights": string[], "advice": string}
- "summary": 2-4 sentences, the single most important takeaway from this period.
- "highlights": 3-6 short one-line observations, each grounded in one specific data point below.
- "advice": 1-3 sentences of forward-looking guidance, grounded in the focus/weakness/roadmap data given.`;

function line(label: string, value: string): string {
  return `- ${label}: ${value}`;
}

function joinOrNone(items: string[]): string {
  return items.length === 0 ? "none" : items.join("; ");
}

export function buildWeeklyNarrationPrompt(insights: WeeklyReportInsights, studentName: string): string {
  const p = insights;
  const lines = [
    line("Period", `${p.period.label}${p.period.isCurrent ? " (in progress)" : ""}`),
    line(
      "Problems solved",
      `${p.problemsSolved.total} total (${joinOrNone(p.problemsSolved.byDifficulty.map((d) => `${d.count} ${d.difficulty}`))})`
    ),
    line("Topics practiced", joinOrNone(p.topicsPracticed.map((t) => `${t.topicName} (${t.problemCount})`))),
    line(
      "Strongest improvement",
      p.strongestImprovement
        ? `${p.strongestImprovement.topicName}, +${p.strongestImprovement.delta} points (${p.strongestImprovement.fromScore} -> ${p.strongestImprovement.toScore})`
        : "none — no topic had a comparable score both before and after this window"
    ),
    line(
      "Weakest area",
      p.weakestArea ? `${p.weakestArea.topicName}, ${p.weakestArea.masteryScore}/100 (${p.weakestArea.classification})` : "not enough evidenced topics yet"
    ),
    line("Neglected topics (weak but not touched this week)", joinOrNone(p.neglectedTopics.map((t) => `${t.topicName} (${t.classification})`))),
    line(
      "Revision performance",
      `${p.revisionPerformance.reviewsCompleted} reviews completed (${joinOrNone(p.revisionPerformance.feedbackBreakdown.map((f) => `${f.count} ${f.feedback}`))})${
        p.revisionPerformance.currentlyOverdueCount !== null ? `, ${p.revisionPerformance.currentlyOverdueCount} currently overdue` : ""
      }`
    ),
    line(
      "Difficulty progression",
      `${p.difficultyProgression.easyCount} Easy / ${p.difficultyProgression.mediumCount} Medium / ${p.difficultyProgression.hardCount} Hard, trend: ${p.difficultyProgression.trend}`
    ),
    line("Important mistakes", joinOrNone(p.importantMistakes.map((m) => m.detail))),
    line("Next week's focus", joinOrNone(p.nextWeekFocus.map((f) => `${f.topicName} — ${f.reason}`))),
  ];

  return `${PERSONA}

## Student
${studentName}

## Weekly report data
${lines.join("\n")}`;
}

export function buildMonthlyNarrationPrompt(insights: MonthlyReportInsights, studentName: string): string {
  const p = insights;
  const lines = [
    line("Period", `${p.period.label}${p.period.isCurrent ? " (in progress)" : ""}`),
    line(
      "Overall progress",
      `${p.overallProgress.problemsSolvedThisMonth} problems solved this month (lifetime ${p.overallProgress.totalSolvedStart} -> ${p.overallProgress.totalSolvedEnd}); readiness ${
        p.overallProgress.readinessScoreStart ?? "n/a"
      } -> ${p.overallProgress.readinessScoreEnd}`
    ),
    line(
      "Mastery changes",
      joinOrNone(p.masteryChanges.slice(0, 8).map((d) => `${d.topicName} ${d.fromScore ?? "new"} -> ${d.toScore}${d.delta !== null ? ` (${d.delta > 0 ? "+" : ""}${d.delta})` : ""}`))
    ),
    line("Topic improvements", joinOrNone(p.topicImprovements.map((d) => `${d.topicName} (+${d.delta})`))),
    line("Declining topics", joinOrNone(p.decliningTopics.map((d) => `${d.topicName} (${d.delta})`))),
    line("Newly developed strengths", joinOrNone(p.newlyDevelopedStrengths.map((t) => t.topicName))),
    line("Persistent weaknesses", joinOrNone(p.persistentWeaknesses.map((w) => `${w.topicName} (${w.classification}, ${w.monthsPersistent} month${w.monthsPersistent === 1 ? "" : "s"} running)`))),
    line(
      "Revision consistency",
      `${p.revisionConsistency.reviewsCompleted} reviews completed (${joinOrNone(p.revisionConsistency.feedbackBreakdown.map((f) => `${f.count} ${f.feedback}`))})${
        p.revisionConsistency.currentlyOverdueCount !== null ? `, ${p.revisionConsistency.currentlyOverdueCount} currently overdue` : ""
      }`
    ),
    line(
      "Difficulty progression",
      `${p.difficultyProgression.easyCount} Easy / ${p.difficultyProgression.mediumCount} Medium / ${p.difficultyProgression.hardCount} Hard, trend: ${p.difficultyProgression.trend}`
    ),
    line(
      "Interview readiness trend",
      `${p.interviewReadinessTrend.levelStart ?? "n/a"} (${p.interviewReadinessTrend.scoreStart ?? "n/a"}) -> ${p.interviewReadinessTrend.levelEnd} (${p.interviewReadinessTrend.scoreEnd})`
    ),
    line("Roadmap changes", joinOrNone(p.roadmapChanges.map((c) => `${c.topicName}: ${c.fromGroup} -> ${c.toGroup}`))),
  ];

  return `${PERSONA}

## Student
${studentName}

## Monthly report data
${lines.join("\n")}`;
}
