import { CalendarClock, Clock, History } from "lucide-react";
import type { RevisionSummary } from "@/lib/revision/revision-view";
import { cn } from "@/lib/utils";

function Tile({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  detail: string;
}) {
  return (
    <div className="space-y-0.5 rounded-lg border border-border bg-surface px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
        {icon}
        {label}
      </p>
      <p className="text-lg font-semibold leading-tight tabular-nums text-foreground">{value}</p>
      <p className="text-xs text-foreground-muted">{detail}</p>
    </div>
  );
}

/**
 * The quiet context around the review queue: what's scheduled ahead,
 * what's been reviewed lately, and — only while there's still a queue to
 * get through — when the next review after it comes. The headline number
 * and the session progress live in the queue itself, so nothing here
 * repeats "due now"; and once the queue is empty its own "Next up" line
 * takes over, so the next-review tile steps aside.
 *
 * Presentational and server-renderable: plain data in, no state.
 */
export function RevisionSummaryStrip({ summary, className }: { summary: RevisionSummary; className?: string }) {
  const showNext = summary.dueNow > 0;

  return (
    <section
      aria-label="Revision overview"
      className={cn("grid gap-3", showNext ? "sm:grid-cols-3" : "sm:grid-cols-2", className)}
    >
      <Tile
        icon={<CalendarClock className="h-3.5 w-3.5" aria-hidden />}
        label="Coming up"
        value={summary.upcoming}
        detail={summary.upcoming === 1 ? "problem scheduled ahead" : "problems scheduled ahead"}
      />
      <Tile
        icon={<History className="h-3.5 w-3.5" aria-hidden />}
        label="Reviewed"
        value={summary.reviewedRecently}
        detail={`in the last ${summary.windowDays} days`}
      />
      {showNext ? (
        <Tile
          icon={<Clock className="h-3.5 w-3.5" aria-hidden />}
          label="After this queue"
          value={summary.nextUp ? <span className="break-words text-base">{summary.nextUp.problemTitle}</span> : "—"}
          detail={summary.nextUp ? summary.nextUp.dueLabel : "nothing else scheduled yet"}
        />
      ) : null}
    </section>
  );
}