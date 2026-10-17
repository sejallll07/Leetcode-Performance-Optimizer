import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type RadialProgressVariant = "brand" | "success" | "warning" | "danger";

const VARIANT_CLASS: Record<RadialProgressVariant, string> = {
  brand: "text-brand",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

/**
 * A circular progress ring built from a plain SVG circle and the
 * stroke-dasharray/stroke-dashoffset trick — no charting dependency
 * needed for one ring. Color comes from the existing design tokens
 * via `currentColor` (same mechanism Tailwind's own `text-*`
 * utilities use), so it works in both themes automatically, same as
 * everything else in this app.
 *
 * The fill-in animation is intentionally the one "orchestrated
 * reveal" on the dashboard (see the Hero component this lives in) —
 * everything else stays still, rather than every element on the page
 * animating in separately.
 */
export function RadialProgress({
  value,
  size = 96,
  strokeWidth = 8,
  variant = "brand",
  children,
  className,
}: {
  /** 0-100. Values outside that range are clamped. */
  value: number;
  size?: number;
  strokeWidth?: number;
  variant?: RadialProgressVariant;
  /** Centered content — typically the score number. Caller controls formatting entirely. */
  children?: ReactNode;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const center = size / 2;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <style>{`
        @keyframes radial-progress-fill {
          from { stroke-dashoffset: ${circumference}; }
          to { stroke-dashoffset: ${offset}; }
        }
      `}</style>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="text-border"
          stroke="currentColor"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={VARIANT_CLASS[variant]}
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ animation: "radial-progress-fill 0.8s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}