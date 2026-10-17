"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BadgeVariant } from "@/lib/dashboard-format";
import type { NextAction, Recommendation, RecommendationResult } from "@/lib/analytics/types";

const PRIORITY_VARIANT: Record<Recommendation["priority"], BadgeVariant> = {
  High: "danger",
  Medium: "warning",
  Low: "neutral",
};

function NumberBadge({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand">
      {n}
    </span>
  );
}

function ActionRow({ n, action }: { n: number; action: NextAction }) {
  return (
    <li className="flex gap-3">
      <NumberBadge n={n} />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {action.title}
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-foreground-muted" />
        </p>
        <p className="mt-0.5 text-xs text-foreground-muted">{action.reason}</p>
      </div>
    </li>
  );
}

function RecommendationRow({ n, rec }: { n: number; rec: Recommendation }) {
  return (
    <li className="flex gap-3">
      <NumberBadge n={n} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <a
            href={`https://leetcode.com/problems/${rec.problemSlug}/`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
          >
            {rec.problemTitle}
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-foreground-muted" />
          </a>
          <Badge variant={PRIORITY_VARIANT[rec.priority]}>{rec.priority}</Badge>
        </div>
        <p className="mt-0.5 text-xs text-foreground-muted">
          {rec.topicName} · {rec.difficulty}
          {rec.isRevision ? " · Revisit" : ""} — {rec.reason}
        </p>
      </div>
    </li>
  );
}

/**
 * One merged "what should I do" panel. actions and
 * recommendations.practiceToday are both already short, prioritized
 * lists from their respective engines — shown in full, in order,
 * continuously numbered (the recommendations carry on from where the
 * actions stop, so each row's number is just its position — no counter
 * to reassign during render). recommendations.all minus practiceToday
 * (previously PracticeTodayCard's always-visible "Also queued up")
 * is the one thing now hidden by default.
 */
export function DashboardFocusToday({ actions, recommendations }: { actions: NextAction[]; recommendations: RecommendationResult }) {
  const [showMore, setShowMore] = useState(false);
  const { practiceToday, all } = recommendations;
  const queued = all.filter((r) => !practiceToday.some((p) => p.problemSlug === r.problemSlug));

  const hasAnything = actions.length > 0 || practiceToday.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Focus Today</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasAnything ? (
          <p className="text-sm text-foreground-muted">Nothing urgent yet — sync more solved problems to get picks here.</p>
        ) : (
          <ol className="space-y-4">
            {actions.map((action, index) => (
              <ActionRow key={`${action.topicSlug}-${action.kind}`} n={index + 1} action={action} />
            ))}
            {practiceToday.map((rec, index) => (
              <RecommendationRow key={rec.problemSlug} n={actions.length + index + 1} rec={rec} />
            ))}
          </ol>
        )}

        {queued.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-foreground-muted hover:text-foreground"
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showMore && "rotate-180")} />
              {showMore ? "Show less" : `Show ${queued.length} more queued up`}
            </button>
            {showMore && (
              <ul className="mt-3 space-y-1.5">
                {queued.map((rec) => (
                  <li key={rec.problemSlug} className="flex items-center justify-between gap-2 text-sm">
                    <a
                      href={`https://leetcode.com/problems/${rec.problemSlug}/`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
                    >
                      {rec.problemTitle}
                      <ExternalLink className="h-3.5 w-3.5 text-foreground-muted" />
                    </a>
                    <Badge variant={PRIORITY_VARIANT[rec.priority]}>{rec.priority}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}