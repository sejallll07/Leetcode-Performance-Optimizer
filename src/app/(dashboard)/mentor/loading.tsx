import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** One feature row: an icon circle, a title line and a short description (same box as the landing page rows). */
function FeatureRowSkeleton() {
  return (
    <li className="flex items-start gap-3">
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <Skeleton className="my-0.5 h-4 w-40 max-w-full" />
        <Skeleton className="my-0.5 h-4 w-full" />
        <Skeleton className="my-0.5 h-4 w-2/3" />
      </div>
    </li>
  );
}

/**
 * Mirrors the Mentor landing page, top to bottom, so nothing jumps when the
 * real content arrives:
 *  - the heading and one-line subtitle
 *  - the single card with three feature rows
 *  - the pointer line that sends the student to the floating launcher
 * The floating launcher and chat window are not part of the skeleton: the
 * widget only exists once the page has loaded. The wrapper uses the same
 * container classes as the page, and stops the pulse for reduced motion.
 */
export default function MentorLoading() {
  return (
    <div
      role="status"
      aria-label="Loading AI Mentor"
      className="mx-auto max-w-3xl space-y-6 pb-20 motion-reduce:[&_*]:animate-none"
    >
      <div className="space-y-1">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="my-0.5 h-4 w-full max-w-sm" />
      </div>

      <Card>
        <CardContent>
          <ul className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <FeatureRowSkeleton key={i} />
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 py-0.5">
        <Skeleton className="h-4 w-4 shrink-0" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
    </div>
  );
}