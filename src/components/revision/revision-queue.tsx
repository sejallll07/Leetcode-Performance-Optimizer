"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { MasteryBar } from "@/components/ui/mastery-bar";
import type { RevisionSavedInfo } from "@/components/revision/revision-feedback-buttons";
import { RevisionQueueItem } from "@/components/revision/revision-queue-item";
import {
  INITIAL_QUEUE_SIZE,
  formatSavedMessage,
  getSessionProgress,
  type ReviewQueue,
  type RevisionSummary,
} from "@/lib/revision/revision-view";

/**
 * The heart of the Revision page: everything due now, as one queue, with
 * the number to beat and how far through it you are.
 *
 * Top to bottom: how many are waiting (the primary number) with the
 * overdue / due-today split; session progress as "reviewed / total" with
 * a bar; an inline confirmation after each rating ("Two Sum saved — next
 * review in 2 weeks"); then the cards — the first five, with "Show N
 * more" — grouped Overdue (most overdue first) then Due today.
 *
 * Session state is local and lasts for this visit: each rating bumps the
 * reviewed count, and because the page data refreshes after a rating (the
 * item leaves the queue), the total stays honest — reviewed plus what's
 * still waiting. Nothing here schedules anything; ratings go through the
 * existing action.
 */
export function RevisionQueue({ queue, nextUp }: { queue: ReviewQueue; nextUp: RevisionSummary["nextUp"] }) {
  const [reviewed, setReviewed] = useState(0);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  function handleSaved(info: RevisionSavedInfo) {
    setReviewed((count) => count + 1);
    setSavedMessage(
      info.problemTitle && info.nextLabel ? formatSavedMessage(info.problemTitle, info.nextLabel) : "Review saved"
    );
  }

  const progress = getSessionProgress(reviewed, queue.total);
  const visible = expanded ? queue.items : queue.items.slice(0, INITIAL_QUEUE_SIZE);
  const hiddenCount = queue.items.length - visible.length;
  const overdueItems = visible.filter((item) => item.group === "overdue");
  const dueTodayItems = visible.filter((item) => item.group === "due-today");

  const confirmation = savedMessage ? (
    <p
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-md border border-success/30 bg-success-subtle/40 px-3 py-2 text-sm text-success"
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
      {savedMessage}
    </p>
  ) : null;

  if (queue.total === 0) {
    return (
      <section aria-label="Review now" className="space-y-3">
        {confirmation}
        <div className="space-y-1.5 rounded-xl border border-border bg-surface p-5 shadow-sm">
          <p className="flex items-center gap-2 text-base font-semibold text-foreground">
            <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
            {reviewed > 0 ? "All done for now" : "You're all caught up"}
          </p>
          <p className="text-sm text-foreground-muted">
            {reviewed > 0
              ? `You reviewed ${reviewed} ${reviewed === 1 ? "problem" : "problems"} this session. Nothing else is due.`
              : "Nothing is due for review right now."}
          </p>
          <p className="text-sm text-foreground-muted">
            {nextUp ? (
              <>
                Next up: <span className="font-medium text-foreground">{nextUp.problemTitle}</span> · {nextUp.dueLabel}
              </>
            ) : (
              "Problems you solve and sync show up here for review a few days later."
            )}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Review now" className="space-y-3">
      <header className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted">Review now</p>
            <p className="text-sm text-foreground-muted">
              <span className="text-3xl font-semibold tabular-nums text-foreground">{queue.total}</span>{" "}
              {queue.total === 1 ? "problem to review" : "problems to review"}
            </p>
            <p className="text-xs text-foreground-muted">
              {queue.overdueTotal} overdue · {queue.dueTodayTotal} due today
            </p>
          </div>
          <p className="text-sm tabular-nums text-foreground-muted">
            <span className="font-semibold text-foreground">{progress.reviewed}</span> / {progress.total} reviewed
          </p>
        </div>
        <MasteryBar value={progress.fraction * 100} variant="success" label="Reviewed this session" />
      </header>

      {confirmation}

      {overdueItems.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-danger">Overdue · {queue.overdueTotal}</h3>
          <ul className="space-y-3">
            {overdueItems.map((item) => (
              <RevisionQueueItem key={item.id} item={item} onSaved={handleSaved} />
            ))}
          </ul>
        </div>
      ) : null}

      {dueTodayItems.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-brand">Due today · {queue.dueTodayTotal}</h3>
          <ul className="space-y-3">
            {dueTodayItems.map((item) => (
              <RevisionQueueItem key={item.id} item={item} onSaved={handleSaved} />
            ))}
          </ul>
        </div>
      ) : null}

      {queue.items.length > INITIAL_QUEUE_SIZE ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="text-sm font-medium text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {expanded ? "Show fewer" : `Show ${hiddenCount} more`}
        </button>
      ) : null}

      {queue.hiddenByCap > 0 ? (
        <p className="text-xs text-foreground-muted">
          Showing the first {queue.items.length} of {queue.total} due — rate some and the rest will appear.
        </p>
      ) : null}
    </section>
  );
}