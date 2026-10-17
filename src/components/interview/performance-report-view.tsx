import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MockInterviewPerformanceReport, MockInterviewNarrative } from "@/lib/interview/types";

const SUMMARY_VARIANT: Record<MockInterviewPerformanceReport["summary"], "success" | "brand" | "warning" | "danger"> = {
  "Strong Session": "success",
  "Solid Session": "brand",
  "Mixed Session": "warning",
  "Tough Session": "danger",
};

export function PerformanceReportView({ report, narrative, narrativeError }: { report: MockInterviewPerformanceReport; narrative: MockInterviewNarrative | null; narrativeError: string | null }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Performance Report</CardTitle>
              <CardDescription>{report.solvedCount}/3 solved, {report.attemptedCount}/3 attempted but not solved</CardDescription>
            </div>
            <Badge variant={SUMMARY_VARIANT[report.summary]}>{report.summary}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3">
            {report.problems.map((p) => (
              <li key={p.slug} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {p.title} <span className="text-foreground-muted">({p.difficulty})</span>
                  </span>
                  <Badge variant={p.outcome === "Solved" ? "success" : p.outcome === "Attempted" ? "warning" : "neutral"}>{p.outcome}</Badge>
                </div>
                <p className="mt-1 text-xs text-foreground-muted">
                  {p.topicNames.join(", ")}
                  {p.timeTakenMinutes !== null && ` · ${p.timeTakenMinutes} min`}
                  {p.usedHints && " · used hints"}
                  {p.withinSuggestedTime === false && " · over the suggested time"}
                </p>
              </li>
            ))}
          </ul>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-foreground">Clean solves</p>
              {report.strengthsShown.length === 0 ? (
                <p className="text-xs text-foreground-muted">None this session.</p>
              ) : (
                <ul className="mt-1 list-disc pl-4 text-xs text-foreground-muted">
                  {report.strengthsShown.map((t) => (
                    <li key={t.topicSlug}>{t.topicName}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Worth revisiting</p>
              {report.areasToRevisit.length === 0 ? (
                <p className="text-xs text-foreground-muted">Nothing flagged.</p>
              ) : (
                <ul className="mt-1 list-disc pl-4 text-xs text-foreground-muted">
                  {report.areasToRevisit.map((t) => (
                    <li key={t.topicSlug}>{t.topicName}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <p className="border-t border-border pt-3 text-xs italic text-foreground-muted">{report.disclaimer}</p>
        </CardContent>
      </Card>

      {narrative ? (
        <Card>
          <CardHeader>
            <CardTitle>Coach&apos;s Take</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-foreground">{narrative.summary}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground-muted">
              {narrative.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
            <p className="text-sm text-foreground">
              <span className="font-medium">Next: </span>
              {narrative.advice}
            </p>
          </CardContent>
        </Card>
      ) : (
        narrativeError && (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-foreground-muted">AI summary unavailable right now — the report above is still accurate. ({narrativeError})</p>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
