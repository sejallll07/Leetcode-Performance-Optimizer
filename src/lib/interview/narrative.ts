import type { MockInterviewPerformanceReport } from "@/lib/interview/types";

/**
 * Same split as src/lib/reports/narrative.ts: pure, no network,
 * fully unit-testable. Reuses the exact {summary, highlights, advice}
 * output shape Phase 10 established (see
 * src/services/reports/report-narrator.ts) so this can run through
 * the same ClaudeReportNarrator/FakeReportNarrator classes without a
 * second provider pair.
 */

const PERSONA = `You are writing the natural-language narrative section of a Mock Interview performance report — part of DSA Intelligence, a personalized LeetCode analytics and coaching tool for a student preparing for software engineering interviews.

Rules:
- Every fact below (which problems, what the student self-reported, which topics need another look) has already been computed deterministically. Your job is to interpret and phrase it clearly, never to invent a detail that isn't given to you.
- CRITICAL: this was one self-reported practice session with 3 problems. Never say or imply that this score, session, or performance predicts, guarantees, or determines how a real interview will go. Do not use words like "ready for your interview", "you'll pass", "guaranteed", or similar. Frame this as one useful data point among many, not a verdict.
- Write like an encouraging but honest coach, not a generic chatbot. Be specific — name the actual problems and topics rather than talking in vague generalities.
- Don't pad with filler that isn't backed by something in the data. If the session went roughly, say so plainly and constructively — that's more useful than false encouragement.
- Reply with STRICT JSON only — no markdown code fences, no text before or after the JSON object — matching exactly this shape:
{"summary": string, "highlights": string[], "advice": string}
- "summary": 2-4 sentences on how the session went overall.
- "highlights": 2-4 short one-line observations, each grounded in one specific problem or topic below.
- "advice": 1-3 sentences of forward-looking guidance, grounded in areas-to-revisit below — never guidance to "prepare more generally", always specific to what's actually in the data.`;

function line(label: string, value: string): string {
  return `- ${label}: ${value}`;
}

function joinOrNone(items: string[]): string {
  return items.length === 0 ? "none" : items.join("; ");
}

export function buildMockInterviewNarrationPrompt(report: MockInterviewPerformanceReport, studentName: string): string {
  const lines = [
    line("Overall", `${report.summary} — ${report.solvedCount}/3 solved, ${report.attemptedCount}/3 attempted but not solved`),
    ...report.problems.map((p) =>
      line(
        `${p.role} problem`,
        `"${p.title}" (${p.difficulty}, topics: ${p.topicNames.join(", ")}) — ${p.outcome}${p.timeTakenMinutes !== null ? `, ${p.timeTakenMinutes} min` : ""}${p.usedHints ? ", used hints/help" : ""}`
      )
    ),
    line("Clean solves (no hints)", joinOrNone(report.strengthsShown.map((t) => t.topicName))),
    line("Areas to revisit", joinOrNone(report.areasToRevisit.map((t) => t.topicName))),
  ];

  return `${PERSONA}

## Student
${studentName}

## Mock interview session data
${lines.join("\n")}`;
}
