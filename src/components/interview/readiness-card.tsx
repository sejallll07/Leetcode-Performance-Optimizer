import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { InterviewReadinessResult } from "@/lib/interview/types";

export function ReadinessCard({ readiness }: { readiness: InterviewReadinessResult }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Interview Readiness</CardTitle>
            <CardDescription>Combines topic breadth, depth, medium/hard exposure, weak topics, recent activity, and consistency.</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-foreground">{readiness.score}/100</p>
            <Badge variant="brand">{readiness.level}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {readiness.factors.map((f) => (
            <li key={f.key}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-foreground">{f.label}</span>
                <span className="text-foreground-muted">{f.score}/100</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full rounded-full bg-brand" style={{ width: `${f.score}%` }} />
              </div>
              <p className="mt-1 text-xs text-foreground-muted">{f.explanation}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
