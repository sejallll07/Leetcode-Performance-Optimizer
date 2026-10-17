import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ReportPeriodType } from "@/lib/reports/types";

/**
 * The period controls: a Weekly / Monthly switch on the left and
 * Previous / label / Next paging on the right. Presentational only:
 * the parent owns the report state and the fetch, and passes the
 * three handlers in. Everything is disabled while a load is pending
 * so a second click can't race the first.
 */
export function ReportPeriodBar({
  periodType,
  periodLabel,
  isCurrent,
  offset,
  isPending,
  onSelectType,
  onPrevious,
  onNext,
}: {
  periodType: ReportPeriodType;
  periodLabel: string;
  isCurrent: boolean;
  /** 0 is the in-progress period; there is nothing newer to page forward to. */
  offset: number;
  isPending: boolean;
  onSelectType: (type: ReportPeriodType) => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label="Report period" className="inline-flex gap-1 rounded-md border border-border p-1">
        <Button variant={periodType === "WEEKLY" ? "primary" : "ghost"} size="sm" aria-pressed={periodType === "WEEKLY"} disabled={isPending} onClick={() => onSelectType("WEEKLY")}>
          Weekly
        </Button>
        <Button variant={periodType === "MONTHLY" ? "primary" : "ghost"} size="sm" aria-pressed={periodType === "MONTHLY"} disabled={isPending} onClick={() => onSelectType("MONTHLY")}>
          Monthly
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" aria-label="Previous period" disabled={isPending} onClick={onPrevious}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Previous</span>
        </Button>

        <span aria-live="polite" className="flex min-w-[10rem] flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm font-medium text-foreground">
          {periodLabel}
          {isCurrent && <Badge variant="brand">In progress</Badge>}
        </span>

        <Button variant="secondary" size="sm" aria-label="Next period" disabled={isPending || offset === 0} onClick={onNext}>
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}