import { ChevronDown, ExternalLink } from "lucide-react";
import type { RevisionFeedback } from "@/lib/revision/types";
import type { CompletedRow, UpcomingRow } from "@/lib/revision/revision-view";
import { cn } from "@/lib/utils";

const DIFFICULTY_TEXT = { Easy: "text-success", Medium: "text-warning", Hard: "text-danger" } as const;

const FEEDBACK_CHIP: Record<RevisionFeedback, string> = {
  Easy: "bg-success-subtle text-success",
  Moderate: "bg-warning-subtle text-warning",
  Difficult: "bg-danger-subtle text-danger",
};

/** A compact copy of the review card's interval ladder: more filled dots = a longer gap before it comes back. */
function Ladder({ step, steps, label }: { step: number; steps: number; label: string }) {
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

function ProblemTitle({ title, url }: { title: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-start gap-1.5 text-sm font-medium text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span className="break-words">{title}</span>
      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground-muted" aria-hidden />
    </a>
  );
}

function Meta({ difficulty, topic }: { difficulty: "Easy" | "Medium" | "Hard"; topic: string }) {
  return (
    <p className="text-xs text-foreground-muted">
      <span className={cn("font-medium", DIFFICULTY_TEXT[difficulty])}>{difficulty}</span> · {topic}
    </p>
  );
}

/**
 * A closed-by-default section: just a title and a count until you open
 * it. Native <details>, so it needs no state and works without
 * JavaScript. These lists are context, not the work — the review queue
 * is — so they stay out of the way until asked for.
 */
function CollapsedSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
        <span className="font-medium text-foreground">
          {title} <span className="tabular-nums text-foreground-muted">({count})</span>
        </span>
        <ChevronDown className="h-4 w-4 text-foreground-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-border">{children}</div>
    </details>
  );
}

/** Problems scheduled for later, soonest first. */
export function UpcomingList({ rows, total }: { rows: UpcomingRow[]; total: number }) {
  return (
    <CollapsedSection title="Coming up" count={total}>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-sm text-foreground-muted">Nothing scheduled yet.</p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0 space-y-0.5">
                  <ProblemTitle title={row.problemTitle} url={row.url} />
                  <Meta difficulty={row.difficulty} topic={row.topic} />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-foreground-muted">
                  <span className="font-medium text-foreground">{row.dueLabel}</span>
                  <Ladder step={row.ladderStep} steps={row.ladderSteps} label={row.intervalLabel} />
                </div>
              </li>
            ))}
          </ul>
          {total > rows.length ? (
            <p className="border-t border-border px-4 py-2 text-xs text-foreground-muted">
              Showing the next {rows.length} of {total}.
            </p>
          ) : null}
        </>
      )}
    </CollapsedSection>
  );
}

/** Problems reviewed recently, newest first, with the rating given and when each comes back. */
export function CompletedList({ rows, total, windowDays }: { rows: CompletedRow[]; total: number; windowDays: number }) {
  return (
    <CollapsedSection title="Recently reviewed" count={total}>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-sm text-foreground-muted">Nothing reviewed in the last {windowDays} days.</p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0 space-y-0.5">
                  <ProblemTitle title={row.problemTitle} url={row.url} />
                  <Meta difficulty={row.difficulty} topic={row.topic} />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-foreground-muted">
                  {row.feedback ? (
                    <span className={cn("rounded-full px-1.5 py-px font-medium", FEEDBACK_CHIP[row.feedback])}>
                      {row.feedback}
                    </span>
                  ) : null}
                  <span>{row.reviewedLabel}</span>
                  <span>Next: {row.nextReview}</span>
                </div>
              </li>
            ))}
          </ul>
          {total > rows.length ? (
            <p className="border-t border-border px-4 py-2 text-xs text-foreground-muted">
              Showing the {rows.length} most recent of {total} in the last {windowDays} days.
            </p>
          ) : null}
        </>
      )}
    </CollapsedSection>
  );
}