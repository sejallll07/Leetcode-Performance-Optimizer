import { Skeleton } from "@/components/ui/skeleton";

/** One review card: title and meta with the due chip, the interval ladder, the prompt, and the three rating buttons. */
function ReviewCardSkeleton() {
  return (
    <li className="space-y-3 rounded-lg border border-border bg-surface p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <Skeleton className="h-4 w-48 max-w-full" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-5 w-24 shrink-0 rounded-full" />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-1.5 w-1.5 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-3 w-40" />
      </div>

      <div className="space-y-1.5">
        <Skeleton className="h-3 w-64 max-w-full" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[3.25rem] w-full rounded-lg" />
          ))}
        </div>
      </div>
    </li>
  );
}

function SummaryTileSkeleton() {
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-surface px-3 py-2.5">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-6 w-12" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

/**
 * Mirrors the final Revision page, top to bottom, so nothing jumps when
 * the real content arrives:
 *  - the heading, one-line subtitle and the "See your Roadmap" link
 *  - the review queue: its header (the number to beat and reviewed / total
 *    with a bar), then Overdue and Due today groups of review cards, and
 *    the "Show N more" link
 *  - the three-tile summary strip
 *  - the two collapsed lists
 */
export default function RevisionLoading() {
  return (
    <div role="status" aria-label="Loading revision" className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-4 w-32" />
      </div>

      <section className="space-y-3">
        <div className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-end justify-between gap-3">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-44" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <ul className="space-y-3">
            <ReviewCardSkeleton />
            <ReviewCardSkeleton />
          </ul>
        </div>

        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <ul className="space-y-3">
            <ReviewCardSkeleton />
          </ul>
        </div>

        <Skeleton className="h-4 w-24" />
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTileSkeleton />
        <SummaryTileSkeleton />
        <SummaryTileSkeleton />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
          >
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-4" />
          </div>
        ))}
      </div>
    </div>
  );
}