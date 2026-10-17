import { HINT_LEVELS } from "@/lib/mentor/config";
import type { HintProgressEntry, MentorContext, MentorTopicSummary } from "@/lib/mentor/types";

function topicLine(t: MentorTopicSummary): string {
  return `- ${t.topicName} (${t.masteryScore}/100, ${t.confidence} confidence): ${t.explanation}`;
}

function section(title: string, lines: string[], emptyNote: string): string {
  if (lines.length === 0) return `## ${title}\n${emptyNote}`;
  return `## ${title}\n${lines.join("\n")}`;
}

const PERSONA = `You are the DSA Mentor inside DSA Intelligence, a coaching tool for students preparing for software engineering interviews. You are not a generic chatbot — you are this specific student's mentor, and every answer should read that way.

Rules:
- Ground every answer in the student profile below. If asked "what should I practice today" or "why am I weak at X", reference their actual numbers, topics, and explanations — never give advice so generic it could apply to any student.
- Be direct and specific, like a good human mentor: name the topic, name the number, name the reason. Skip filler ("Great question!") and skip disclaimers about being an AI.
- When the student asks for a specific problem (e.g. "give me a Binary Search problem"), use the search_problem_catalog tool to find a real one. Never invent a problem, a slug, or a difficulty.
- When explaining a problem, walk through what it's asking without solving it, unless the student has explicitly asked for the solution.
- Progressive hints: when a student asks for a hint on a problem, there are exactly 6 levels, and you may only give the next one they haven't seen yet — never skip ahead:
${HINT_LEVELS.map((h) => `  ${h.level}. ${h.name} — ${h.description}`).join("\n")}
  The "Hint progress" section below tells you exactly which level each problem is currently at in this conversation. If a problem isn't listed there, the student hasn't had a hint on it yet — start at level 1. If they ask for "a hint" or "another hint", give exactly the next level, and say which level it is (e.g. "Hint 2 (Pattern hint): ..."). The one exception: if the student explicitly asks for the full solution or explicitly says to skip ahead, you may jump straight to level 6 and label it "Solution explanation" — but do not do this just because they asked for a second or third hint.
- Do not reveal a solution (level 6, or anything solution-shaped) unless the student explicitly asked for it or explicitly asked to skip the hint ladder. An impatient-sounding "give me a hint" is still just the next hint, not the answer.
- "Quiz me" means you ask the student a question (about a topic or problem from their profile) and wait for their answer before evaluating it — don't answer your own quiz question in the same turn.
- "Review my approach" means the student will describe their approach in their next message; ask them to describe it if they haven't yet, then give honest feedback grounded in their profile (e.g. does this fit a pattern they're already weak in).

Reply format: if your reply is about one specific problem (a hint, an explanation, a review of their approach on it, or anything else tied to that problem), start your reply with exactly one line: [[MENTOR_META problem=<slug>]] — or, if this specific reply is a numbered hint, [[MENTOR_META hintLevel=<1-6> problem=<slug>]]. Use the exact slug from the problem's URL (e.g. "two-sum", "binary-search"), lowercase, hyphenated. Omit this line entirely for a reply that isn't about one specific problem (readiness, "what's next", general study advice). This line is stripped before the student sees your reply — it's how the app tracks hint progress, not part of the conversation.`;

function buildHintProgressSection(hintProgress: HintProgressEntry[], problemTitleBySlug: Map<string, string>): string {
  const hintProgressLines = hintProgress.map((h) => {
    const title = problemTitleBySlug.get(h.problemSlug) ?? h.problemSlug;
    return `- ${title} (${h.problemSlug}): hint level ${h.currentLevel} of 6 given so far. Next hint, if asked, should be level ${Math.min(6, h.currentLevel + 1)}${h.currentLevel >= 6 ? " (already at the solution — there's no level beyond 6)" : ""}.`;
  });
  return section("Hint progress (this conversation)", hintProgressLines, "No hints given yet in this conversation.");
}

/**
 * The whole system prompt: persona + rules + the structured context
 * (never the raw database) + the hint-progress fact table. Pure —
 * the caller (mentor-service.ts) is responsible for gathering
 * `context` and `hintProgress` and for resolving `now`.
 *
 * Hint progress is included in *both* branches below, profile or
 * not: a student without a connected LeetCode profile can still ask
 * for a hint on a named problem (see the no-profile paragraph
 * itself), so the ladder has to work there too — omitting this
 * section when `hasProfile` is false was a real bug caught by
 * Phase 9's own integration test (turn 2 of a hint ladder silently
 * restarted at level 1 for a student with no connected profile).
 */
export function buildMentorSystemPrompt(
  context: MentorContext,
  hintProgress: HintProgressEntry[],
  problemTitleBySlug: Map<string, string>
): string {
  if (!context.hasProfile) {
    return `${PERSONA}

## Student profile
${context.studentName} hasn't connected a LeetCode profile yet, so you have no readiness score, mastery data, or history to draw on. Say so plainly if they ask a profile-specific question (like "what should I practice today"), and suggest connecting and syncing from the dashboard first. You can still mentor them on a *named* problem they bring up — explain it, hint it, quiz them — using the search_problem_catalog tool to find real problems when asked for one by topic.

${buildHintProgressSection(hintProgress, problemTitleBySlug)}`;
  }

  const sections = [
    `## Student profile\nName: ${context.studentName}`,
    `## Overall readiness\nScore: ${context.readiness.score}/100 (${context.readiness.level})\n${context.readiness.explanation}`,
    section("Strong topics", context.strongTopics.map(topicLine), "Nothing has reached Strong yet."),
    section("Weak topics", context.weakTopics.map(topicLine), "No clearly weak topics right now."),
    section("Fundamental gaps", context.fundamentalGaps.map(topicLine), "No fundamental gaps detected."),
    section("Topics due for revision", context.revisionNeededTopics.map(topicLine), "Nothing flagged for revision right now."),
    `## Recent activity\nTrend: ${context.recentActivity.status} (${context.recentActivity.topicsImproved} improved, ${context.recentActivity.topicsDeclined} declined since last sync). ${context.recentActivity.explanation}${context.recentActivity.daysSinceLastSubmission !== null ? ` Last submission was ${context.recentActivity.daysSinceLastSubmission} day(s) ago.` : " No submissions recorded yet."}`,
    `## Revision due\n${context.revisionDue.overdueCount} overdue, ${context.revisionDue.dueTodayCount} due today.${context.revisionDue.sample.length > 0 ? ` For example: ${context.revisionDue.sample.map((s) => `${s.problemTitle}${s.topicName ? ` (${s.topicName})` : ""}`).join(", ")}.` : ""}`,
    section(
      "Recommended problems today",
      context.recommendedProblems.map((r) => `- ${r.problemTitle} (${r.difficulty}, ${r.topicName}): ${r.reason}`),
      "Nothing recommended right now."
    ),
    `## Roadmap\n${context.roadmap.recommendedNextTopic ? `Recommended next topic: ${context.roadmap.recommendedNextTopic.topicName} — ${context.roadmap.recommendedNextTopic.reason}` : "No confident next-topic pick right now."} (${context.roadmap.recommendedNextCount} topics ready to start, ${context.roadmap.postponedCount} postponed until a prerequisite firms up.)`,
    section(
      "Relevant history",
      context.relevantHistory.map((h) => `- ${h.problemTitle} (${h.difficulty}, ${h.topicNames.join(", ")}) — ${h.daysAgo} day(s) ago`),
      "No solved-problem history yet."
    ),
    buildHintProgressSection(hintProgress, problemTitleBySlug),
  ];

  return `${PERSONA}\n\n${sections.join("\n\n")}`;
}
