import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Same responsive node grid the real stage map uses, so the placeholder
// blocks wrap into the same number of columns at every width.
const NODE_GRID = "grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2";

/** One stage band: numbered header with a progress bar on the right, then a grid of node-shaped blocks. */
function StageBandSkeleton({ nodes }: { nodes: number }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-6 w-6 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-2 w-40 rounded-full" />
      </header>
      <div className={NODE_GRID}>
        {Array.from({ length: nodes }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </section>
  );
}

/** A labelled block inside the focus card (Why, Before you start, Done when, Unlocks next). */
function SectionSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="space-y-1.5">
      <Skeleton className="h-3 w-24" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={i === lines - 1 ? "h-4 w-2/3" : "h-4 w-full"} />
      ))}
    </div>
  );
}

/**
 * Mirrors the final Roadmap page, top to bottom, so nothing jumps
 * when the real content streams in:
 *  - page heading and one-line subtitle
 *  - the "Where you are" strip (stats and bar on the left, needs-work chips on the right)
 *  - the next-step card — first in the DOM so it leads on small screens,
 *    in the right-hand 24rem column on large ones — with its ring and
 *    name, Why, Before you start, the two problem panels (New practice
 *    and Revision), Done when and Unlocks next
 *  - the progression: heading and filter button, three stage bands with a
 *    chevron between them, and the collapsed "Other topics" row
 */
export default function RoadmapLoading() {
  return (
    <div role="status" aria-label="Loading roadmap" className="mx-auto max-w-5xl space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>

      <section className="grid gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm md:grid-cols-2">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-60 max-w-full" />
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="flex gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <div className="flex flex-wrap gap-1.5">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="lg:col-start-2 lg:row-start-1 lg:self-start">
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-5 w-32 rounded-full" />
              </div>

              <div className="flex items-center gap-3">
                <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-40 max-w-full" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
              </div>

              <SectionSkeleton lines={3} />

              <div className="space-y-1.5">
                <Skeleton className="h-3 w-28" />
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
              </div>

              {/* New practice: tinted panel of bordered problem cards */}
              <div className="space-y-2.5 rounded-lg border border-brand/30 bg-brand-subtle/30 p-3">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-52 max-w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>

              {/* Revision: plain outlined panel with a compact list */}
              <div className="space-y-2.5 rounded-lg border border-warning/40 bg-surface p-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-56 max-w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>

              <SectionSkeleton lines={2} />

              <div className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3 lg:col-start-1 lg:row-start-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-72 max-w-full" />
            </div>
            <Skeleton className="h-7 w-32 rounded-full" />
          </div>

          <div>
            <StageBandSkeleton nodes={6} />
            <div className="flex justify-center py-1.5">
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <StageBandSkeleton nodes={6} />
            <div className="flex justify-center py-1.5">
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <StageBandSkeleton nodes={3} />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
            <Skeleton className="h-4 w-56 max-w-full" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      </div>
    </div>
  );
}