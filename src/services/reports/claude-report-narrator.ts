import { REPORTS_CONFIG } from "@/lib/reports/config";
import type { ReportNarrative } from "@/lib/reports/types";
import type { NarrationResult, ReportNarrator } from "@/services/reports/report-narrator";

/**
 * Talks to the real Anthropic API — same API key handling as
 * ClaudeMentorProvider (server-only, never sent to the browser).
 * Unlike the mentor, this is a single completion call: no
 * conversation history, no tool use, just "here's the structured
 * report data, write the narrative section". See
 * src/lib/reports/narrative.ts for the prompt itself.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function interpretErrorResponse(status: number): NarrationResult {
  if (status === 401 || status === 403) {
    return { ok: false, error: "Report narration isn't configured correctly (authentication failed).", retryable: false };
  }
  if (status === 429) {
    return { ok: false, error: "Report narration is getting a lot of requests right now — try again in a moment.", retryable: true };
  }
  if (status === 529 || status === 503) {
    return { ok: false, error: "Report narration is temporarily overloaded — try again shortly.", retryable: true };
  }
  if (status >= 500) {
    return { ok: false, error: "Report narration is having trouble on its end — try again shortly.", retryable: true };
  }
  if (status === 400) {
    return { ok: false, error: "Report narration couldn't process that request.", retryable: false };
  }
  return { ok: false, error: `Report narration returned an unexpected error (${status}).`, retryable: true };
}

/** Defensive narrowing of untrusted model output — never trust it matches the requested shape without checking. */
function parseNarrative(text: string): ReportNarrative | null {
  let trimmed = text.trim();
  // Strip an accidental markdown fence even though the prompt asks for none — cheap insurance, not a substitute for the instruction.
  if (trimmed.startsWith("```")) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.summary !== "string") return null;
  if (!Array.isArray(obj.highlights) || !obj.highlights.every((h) => typeof h === "string")) return null;
  if (typeof obj.advice !== "string") return null;

  return { summary: obj.summary, highlights: obj.highlights as string[], advice: obj.advice };
}

export class ClaudeReportNarrator implements ReportNarrator {
  async narrate(prompt: string): Promise<NarrationResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "Report narration isn't configured yet — no API key is set up.", retryable: false };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REPORTS_CONFIG.narrator.requestTimeoutMs);

    let response: Response;
    try {
      response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: REPORTS_CONFIG.narrator.model,
          max_tokens: REPORTS_CONFIG.narrator.maxOutputTokens,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: controller.signal,
      });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      return {
        ok: false,
        error: isAbort ? "Report narration took too long — try again." : "Couldn't reach report narration — check your connection and try again.",
        retryable: true,
      };
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const bodyText = await safeReadText(response);
      void bodyText; // not surfaced to the student — logged by the caller if needed
      return interpretErrorResponse(response.status);
    }

    let data: { content: { type: string; text?: string }[] };
    try {
      data = await response.json();
    } catch {
      return { ok: false, error: "Report narration sent back something unreadable — try again.", retryable: true };
    }

    const textBlock = data.content.find((b) => b.type === "text" && typeof b.text === "string");
    if (!textBlock?.text) {
      return { ok: false, error: "Report narration didn't return a readable reply — try again.", retryable: true };
    }

    const narrative = parseNarrative(textBlock.text);
    if (!narrative) {
      return { ok: false, error: "Report narration returned an unexpected format — try again.", retryable: true };
    }

    return { ok: true, narrative };
  }
}
