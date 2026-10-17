"use client";

import { ExternalLink } from "lucide-react";
import { RevisionFeedbackButtons, type RevisionSavedInfo } from "@/components/revision/revision-feedback-buttons";
import type { ReviewQueueItem } from "@/lib/revision/revision-view";
import { cn } from "@/lib/utils";

const DIFFICULTY_TEXT = { Easy: "text-success", Medium: "text-warning", Hard: "text-danger" } as const;

/**
 * Five dots for the interval ladder (3 days → 1 week → 2 weeks → 1 month
 * → 2 months): the more are filled, the longer the gap before this
 * problem comes back — a quick read on how well it's locked in.
 */
function IntervalLadder({ step, steps, label }: { step: number; steps: number; label: string }) {
  return (
    <span
      role="img"
      aria-label={`Review interval ${label}, step ${step} of ${steps}`}
      title={`Review interval: ${label} (step ${step} of ${steps})`}
      className="inline-flex items-center gap-1"
    >
      {Array.from({ length: steps }).map((_, index) => (
        <span
          key={index}
          className={cn("h-1.5 w-1.5 rounded-full", index < step ? "bg-warning" : "border border-border bg-transparent")}
        />
      ))}
    </span>
  );
}

/**
 * One problem waiting for review. It answers, in order: what is it
 * (title, linked to open it on LeetCode), how late is it (the due chip),
 * how well is it locked in (the interval ladder and review count), and
 * what do I do (try it again, then rate how it went — each rating shows
 * the next interval it would set).
 *
 * Presentational: everything shown comes from the view model, and
 * `onSaved` is handed straight to the rating buttons.
 */
export function RevisionQueueItem({
  item,
  onSaved,
}: {
  item: ReviewQueueItem;
  onSaved: (info: RevisionSavedInfo) => void;
}) {
  const overdue = item.group === "overdue";

  return (
    <li
      className={cn(
        "space-y-3 rounded-lg border bg-surface p-3.5",
        overdue ? "border-danger/30" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-start gap-1.5 text-sm font-semibold text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span className="break-words">{item.problemTitle}</span>
            <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground-muted" aria-hidden />
          </a>
          <p className="text-xs text-foreground-muted">
            <span className={cn("font-medium", DIFFICULTY_TEXT[item.difficulty])}>{item.difficulty}</span> · {item.topic}
          </p>
        </div>

        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
            overdue ? "bg-danger-subtle text-danger" : "bg-brand-subtle text-brand"
          )}
        >
          {item.dueLabel}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-muted">
        <IntervalLadder step={item.ladderStep} steps={item.ladderSteps} label={item.intervalLabel} />
        <span>{item.intervalLabel} interval</span>
        <span aria-hidden>·</span>
        <span>{item.reviewCount === 0 ? "First review" : `Reviewed ${item.reviewCount}×`}</span>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs text-foreground-muted">Open it, try it again, then rate how it went:</p>
        <RevisionFeedbackButtons
          revisionItemId={item.id}
          problemTitle={item.problemTitle}
          previews={item.previews}
          onSaved={onSaved}
        />
      </div>
    </li>
  );
}