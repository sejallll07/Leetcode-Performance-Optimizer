import { describe, expect, it } from "vitest";
import { buildMentorSystemPrompt } from "@/lib/mentor/system-prompt";
import type { MentorContext } from "@/lib/mentor/types";

const NO_PROFILE: MentorContext = { hasProfile: false, studentName: "Sam" };

function fullContext(overrides: Partial<Extract<MentorContext, { hasProfile: true }>> = {}): MentorContext {
  return {
    hasProfile: true,
    studentName: "Sam",
    readiness: { score: 62, level: "Building Fundamentals", explanation: "Solid on the basics, thin on graphs." },
    strongTopics: [{ topicSlug: "array", topicName: "Array", masteryScore: 90, confidence: "High", explanation: "Consistently strong." }],
    weakTopics: [{ topicSlug: "dp", topicName: "Dynamic Programming", masteryScore: 25, confidence: "Medium", explanation: "Low accuracy on recent DP problems." }],
    fundamentalGaps: [],
    revisionNeededTopics: [],
    recentActivity: { status: "declining", averageDelta: -3, topicsImproved: 1, topicsDeclined: 4, explanation: "Scores dropped on 4 topics since last sync.", daysSinceLastSubmission: 2 },
    revisionDue: { overdueCount: 5, dueTodayCount: 1, sample: [{ problemTitle: "Two Sum", topicName: "Array" }] },
    recommendedProblems: [{ problemSlug: "koko-bananas", problemTitle: "Koko Eating Bananas", difficulty: "Medium", topicName: "Binary Search", reason: "Builds on a weak topic." }],
    roadmap: { recommendedNextTopic: { topicName: "Stack", reason: "No prerequisite concerns." }, recommendedNextCount: 4, postponedCount: 2 },
    relevantHistory: [{ problemTitle: "Two Sum", topicNames: ["Array"], difficulty: "Easy", daysAgo: 1 }],
    ...overrides,
  };
}

describe("buildMentorSystemPrompt", () => {
  it("tells the mentor no profile is connected, and still allows problem-specific mentoring", () => {
    const prompt = buildMentorSystemPrompt(NO_PROFILE, [], new Map());
    expect(prompt).toContain("hasn't connected a LeetCode profile yet");
    expect(prompt).toContain("search_problem_catalog");
    expect(prompt).not.toContain("## Overall readiness");
  });

  // Regression test: buildMentorSystemPrompt's no-profile branch originally returned
  // early and dropped the hint-progress table entirely, which meant a hint ladder
  // silently restarted at level 1 forever for any student with no connected profile
  // (caught by test:mentor's integration run, not by a unit test — this closes that gap).
  it("includes hint progress even when no profile is connected", () => {
    const prompt = buildMentorSystemPrompt(NO_PROFILE, [{ problemSlug: "two-sum", currentLevel: 2 }], new Map([["two-sum", "Two Sum"]]));
    expect(prompt).toContain("Two Sum (two-sum): hint level 2 of 6 given so far");
    expect(prompt).toContain("Next hint, if asked, should be level 3");
  });

  it("includes the student's name, readiness score, and explanation", () => {
    const prompt = buildMentorSystemPrompt(fullContext(), [], new Map());
    expect(prompt).toContain("Sam");
    expect(prompt).toContain("62/100");
    expect(prompt).toContain("Solid on the basics, thin on graphs.");
  });

  it("includes weak and strong topics with their real explanations", () => {
    const prompt = buildMentorSystemPrompt(fullContext(), [], new Map());
    expect(prompt).toContain("Dynamic Programming");
    expect(prompt).toContain("Low accuracy on recent DP problems.");
    expect(prompt).toContain("Array");
    expect(prompt).toContain("Consistently strong.");
  });

  it("falls back to an honest empty-section note rather than an empty heading", () => {
    const prompt = buildMentorSystemPrompt(fullContext({ fundamentalGaps: [] }), [], new Map());
    expect(prompt).toContain("No fundamental gaps detected.");
  });

  it("includes the recent-activity trend, useful for 'why did my score decrease'", () => {
    const prompt = buildMentorSystemPrompt(fullContext(), [], new Map());
    expect(prompt).toContain("declining");
    expect(prompt).toContain("Scores dropped on 4 topics since last sync.");
  });

  it("includes all 6 hint levels and the progressive-disclosure rule", () => {
    const prompt = buildMentorSystemPrompt(fullContext(), [], new Map());
    expect(prompt).toContain("Conceptual hint");
    expect(prompt).toContain("Pattern hint");
    expect(prompt).toContain("Approach hint");
    expect(prompt).toContain("Detailed reasoning");
    expect(prompt).toContain("Pseudocode");
    expect(prompt).toContain("Solution explanation");
    expect(prompt).toContain("never skip ahead");
  });

  it("reports no hints given yet when hintProgress is empty", () => {
    const prompt = buildMentorSystemPrompt(fullContext(), [], new Map());
    expect(prompt).toContain("No hints given yet in this conversation.");
  });

  it("tells the model exactly which level comes next for a problem already in progress", () => {
    const prompt = buildMentorSystemPrompt(
      fullContext(),
      [{ problemSlug: "two-sum", currentLevel: 2 }],
      new Map([["two-sum", "Two Sum"]])
    );
    expect(prompt).toContain("Two Sum (two-sum): hint level 2 of 6 given so far");
    expect(prompt).toContain("Next hint, if asked, should be level 3");
  });

  it("notes there's nothing beyond level 6 when a problem is already fully hinted", () => {
    const prompt = buildMentorSystemPrompt(fullContext(), [{ problemSlug: "two-sum", currentLevel: 6 }], new Map());
    expect(prompt).toContain("already at the solution");
  });

  it("falls back to the slug itself when no title is known for a problem in hint progress", () => {
    const prompt = buildMentorSystemPrompt(fullContext(), [{ problemSlug: "unknown-slug", currentLevel: 1 }], new Map());
    expect(prompt).toContain("unknown-slug (unknown-slug)");
  });
});
