import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** One headline tile: label, value, note (same box as ReportStatStrip). */
function TileSkeleton() {
  return (
    <div className="min-w-0 space-y-1.5 rounded-lg border border-border bg-surface px-3 py-2.5">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-6 w-12" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

/** One insight row: label and badge, a detail line, and a score bar. */
function RowSkeleton({ numbered = false, bar = true }: { numbered?: boolean; bar?: boolean }) {
  return (
    <li className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {numbered && <Skeleton className="h-5 w-5 shrink-0 rounded-full" />}
          <Skeleton className="h-4 w-36" />
        </div>
        {!numbered && <Skeleton className="h-5 w-14 shrink-0 rounded-full" />}
      </div>
      <Skeleton className={numbered ? "ml-7 h-3 w-48 max-w-full" : "h-3 w-40 max-w-full"} />
      {bar && <Skeleton className="h-1.5 w-full rounded-full" />}
    </li>
  );
}

/** A band card: icon and title, a section heading, then rows (same box as ReportInsightGroup). */
function GroupSkeleton({ rows, numbered = false }: { rows: number; numbered?: boolean }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded-sm" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="space-y-2">
          {!numbered && <Skeleton className="h-3 w-32" />}
          <ul className="space-y-3">
            {Array.from({ length: rows }).map((_, i) => (
              <RowSkeleton key={i} numbered={numbered} bar={!numbered && i === 0} />
            ))}
          </ul>
        </div>
        {numbered && <Skeleton className="h-3 w-28" />}
      </CardContent>
    </Card>
  );
}

/**
 * Mirrors the final Reports page, top to bottom, so nothing jumps
 * when the real content arrives:
 *  - the heading and one-line subtitle
 *  - the period bar: the Weekly / Monthly switch on the left, the
 *    paging controls and period label on the right
 *  - the summary card: title, a short paragraph, the Focus callout
 *    and the Highlights toggle
 *  - the four headline tiles (two across on a phone, four on desktop)
 *  - the Going well and Needs attention bands side by side
 *  - the numbered Next list with its link
 */
export default function ReportsLoading() {
  return (
    <div role="status" aria-label="Loading reports" className="mx-auto max-w-5xl space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-10 w-44 rounded-md" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-9 rounded-md sm:w-24" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-9 rounded-md sm:w-20" />
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <Skeleton className="h-5 w-44" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-4 w-28" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <TileSkeleton key={i} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GroupSkeleton rows={2} />
        <GroupSkeleton rows={2} />
      </div>

      <GroupSkeleton rows={2} numbered />
    </div>
  );
}