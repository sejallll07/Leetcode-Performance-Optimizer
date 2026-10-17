import { cn } from "@/lib/utils";
import type { BadgeVariant } from "@/lib/dashboard-format";

const BAR_VARIANT_CLASS: Record<BadgeVariant, string> = {
  neutral: "bg-foreground-muted",
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

/**
 * Thin horizontal progress bar for a 0-100 mastery score. Colors come
 * from the existing design tokens (same mapping the badges use), so it
 * follows the theme automatically. Values outside 0-100 are clamped.
 *
 * Shared by the Roadmap's topic nodes and detail panel. The Dashboard's
 * TopicBreakdown still has its own local copy; it can be switched over
 * to this later, but nothing requires it.
 */
export function MasteryBar({
  value,
  variant,
  className,
  label,
}: {
  /** 0-100. */
  value: number;
  variant: BadgeVariant;
  className?: string;
  /** Accessible name, e.g. "Array mastery". Optional. */
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-muted", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          BAR_VARIANT_CLASS[variant]
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}