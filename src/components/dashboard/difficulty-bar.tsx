import { cn } from "@/lib/utils";

const SEGMENTS: { key: "easy" | "medium" | "hard"; label: string; barClass: string; dotClass: string }[] = [
  { key: "easy", label: "Easy", barClass: "bg-success", dotClass: "bg-success" },
  { key: "medium", label: "Medium", barClass: "bg-warning", dotClass: "bg-warning" },
  { key: "hard", label: "Hard", barClass: "bg-danger", dotClass: "bg-danger" },
];

/**
 * Proportional Easy/Medium/Hard split as one segmented bar instead
 * of three bare numbers — the LeetCode-standard green/amber/red
 * mapping (via the existing success/warning/danger tokens) means
 * this reads instantly without a legend explaining itself.
 */
export function DifficultyBar({
  easy,
  medium,
  hard,
  className,
}: {
  easy: number;
  medium: number;
  hard: number;
  className?: string;
}) {
  const total = easy + medium + hard;
  const counts = { easy, medium, hard };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        {total === 0 ? null : (
          SEGMENTS.map((segment) => {
            const count = counts[segment.key];
            if (count === 0) return null;
            return (
              <div
                key={segment.key}
                className={segment.barClass}
                style={{ width: `${(count / total) * 100}%` }}
              />
            );
          })
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-muted">
        {SEGMENTS.map((segment) => (
          <span key={segment.key} className="inline-flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", segment.dotClass)} />
            {segment.label} {counts[segment.key]}
          </span>
        ))}
      </div>
    </div>
  );
}