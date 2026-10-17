/**
 * Same boundary role as src/services/mentor/mentor-provider.ts:
 * reports-service.ts depends only on this interface, never on the
 * Anthropic API directly, so a fake implementation can stand in for
 * integration tests.
 */
import type { ReportNarrative } from "@/lib/reports/types";

export type NarrationResult =
  | { ok: true; narrative: ReportNarrative }
  | { ok: false; error: string; retryable: boolean };

export interface ReportNarrator {
  /** `prompt` is a complete, already-built prompt from src/lib/reports/narrative.ts — the narrator itself has no report-specific logic, just "send this prompt, parse strict JSON back". */
  narrate(prompt: string): Promise<NarrationResult>;
}
