import type { NarrationResult, ReportNarrator } from "@/services/reports/report-narrator";

/**
 * Deterministic stand-in for ClaudeReportNarrator — same reason
 * FakeMentorProvider exists: lets the full
 * insights -> narrative-prompt -> narrator -> persistence pipeline
 * be integration-tested against real Postgres without a real API
 * key or network call.
 */
export type FakeNarratorScenario = "echo" | "error" | "malformed";

export class FakeReportNarrator implements ReportNarrator {
  constructor(private scenario: FakeNarratorScenario = "echo") {}

  async narrate(prompt: string): Promise<NarrationResult> {
    switch (this.scenario) {
      case "error":
        return { ok: false, error: "fixture narrator error", retryable: true };
      case "malformed":
        return { ok: false, error: "fixture narrator returned an unexpected format", retryable: true };
      case "echo":
      default:
        return {
          ok: true,
          narrative: {
            summary: `Fixture summary (prompt length ${prompt.length}).`,
            highlights: ["Fixture highlight one.", "Fixture highlight two."],
            advice: "Fixture advice.",
          },
        };
    }
  }
}
