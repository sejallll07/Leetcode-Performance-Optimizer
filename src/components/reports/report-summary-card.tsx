import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportNarrative, ReportPeriodType } from "@/lib/reports/types";

/**
 * The narrated summary at the top of a report: the one-line takeaway
 * first, the advice as an indigo "Focus" callout, and the highlights
 * folded away behind a native <details> toggle (no client state, so
 * this stays a server-renderable component). When the narrator was
 * unavailable it shrinks to a single muted line, because the data
 * below is the report and is still complete without it.
 */
export function ReportSummaryCard({
  periodType,
  summary,
  narrativeError,
}: {
  periodType: ReportPeriodType;
  summary: ReportNarrative | null;
  narrativeError: string | null;
}) {
  if (!summary) {
    if (!narrativeError) return null;
    return (
      <Card>
        <CardContent className="space-y-1 p-4">
          <p className="text-sm text-foreground-muted">AI summary unavailable right now. The numbers below are still accurate.</p>
          <p className="text-xs text-foreground-muted">{narrativeError}</p>
        </CardContent>
      </Card>
    );
  }

  const highlightCount = summary.highlights.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{periodType === "WEEKLY" ? "Your week in short" : "Your month in short"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-foreground">{summary.summary}</p>

        <div className="rounded-lg border border-brand/30 bg-brand-subtle/30 px-3.5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Focus</p>
          <p className="mt-1 text-sm text-foreground">{summary.advice}</p>
        </div>

        {highlightCount > 0 && (
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-sm text-sm text-foreground-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
              <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden="true" />
              Highlights ({highlightCount})
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-9 text-sm text-foreground-muted">
              {summary.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}