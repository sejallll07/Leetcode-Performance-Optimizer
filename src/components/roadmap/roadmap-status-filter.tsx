"use client";

import { cn } from "@/lib/utils";
import type { BadgeVariant } from "@/lib/dashboard-format";
import {
  ROADMAP_FILTERS,
  getFilterDef,
  type RoadmapFilterDef,
  type RoadmapFilterKey,
} from "@/lib/roadmap/roadmap-view";

// Tailwind only generates classes it can see as complete literal
// strings, so every variant → class mapping is spelled out in full
// rather than built with template strings.
const SOLID_BG: Record<BadgeVariant, string> = {
  neutral: "bg-foreground-muted",
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

// Zero-evidence statuses (Next / Postponed) read as "not measured
// yet", so their bar segment is a faded version of the same color.
const FADED_BG: Record<BadgeVariant, string> = {
  neutral: "bg-foreground-muted/35",
  brand: "bg-brand/35",
  success: "bg-success/35",
  warning: "bg-warning/35",
  danger: "bg-danger/35",
};

const HOLLOW_BORDER: Record<BadgeVariant, string> = {
  neutral: "border-foreground-muted",
  brand: "border-brand",
  success: "border-success",
  warning: "border-warning",
  danger: "border-danger",
};

function FilterDot({ filter }: { filter: RoadmapFilterDef }) {
  // The prerequisite overlay gets a ringed dot — the same small red dot
  // the topic nodes will carry, so the chip doubles as its legend.
  if (!filter.partition) {
    return <span className={cn("h-1.5 w-1.5 rounded-full ring-2 ring-danger/30", SOLID_BG[filter.variant])} />;
  }
  if (filter.hollow) {
    return (
      <span className={cn("h-2 w-2 rounded-full border-[1.5px] bg-transparent", HOLLOW_BORDER[filter.variant])} />
    );
  }
  return <span className={cn("h-2 w-2 rounded-full", SOLID_BG[filter.variant])} />;
}

function FilterChip({
  pressed,
  title,
  onClick,
  children,
}: {
  pressed: boolean;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        pressed
          ? "border-brand bg-brand-subtle text-brand"
          : "border-border bg-surface text-foreground-muted hover:border-foreground-muted/50 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

/**
 * The Roadmap's at-a-glance header: one row of status chips (each
 * with its count and a color dot — the legend and the filter in one)
 * above a single segmented bar showing the status mix across every
 * topic. Clicking a chip or a bar segment filters the skill map;
 * clicking the active one again, or "All", clears it.
 *
 * Purely presentational — the explorer owns the `active` state.
 * Chips with a zero count are hidden to keep the row short. The
 * "Prereq gap" chip is an overlay (those topics also have their own
 * status), so it's set apart after a divider and isn't part of the bar.
 */
export function RoadmapStatusFilter({
  counts,
  total,
  active,
  onChange,
  className,
}: {
  counts: Record<RoadmapFilterKey, number>;
  total: number;
  active: RoadmapFilterKey | null;
  onChange: (key: RoadmapFilterKey | null) => void;
  className?: string;
}) {
  if (total === 0) return null;

  const statusFilters = ROADMAP_FILTERS.filter((f) => f.partition && counts[f.key] > 0);
  const overlayFilters = ROADMAP_FILTERS.filter((f) => !f.partition && counts[f.key] > 0);
  const activeIsStatus = active !== null && getFilterDef(active).partition;

  const toggle = (key: RoadmapFilterKey) => onChange(active === key ? null : key);

  return (
    <div className={cn("space-y-3", className)}>
      <div role="group" aria-label="Filter topics by status" className="flex flex-wrap items-center gap-2">
        <FilterChip pressed={active === null} onClick={() => onChange(null)} title="Show every topic">
          All <span className="tabular-nums text-foreground">{total}</span>
        </FilterChip>

        {statusFilters.map((filter) => (
          <FilterChip
            key={filter.key}
            pressed={active === filter.key}
            title={filter.description}
            onClick={() => toggle(filter.key)}
          >
            <FilterDot filter={filter} />
            {filter.label} <span className="tabular-nums text-foreground">{counts[filter.key]}</span>
          </FilterChip>
        ))}

        {overlayFilters.length > 0 ? <span aria-hidden className="mx-1 h-4 w-px bg-border" /> : null}

        {overlayFilters.map((filter) => (
          <FilterChip
            key={filter.key}
            pressed={active === filter.key}
            title={filter.description}
            onClick={() => toggle(filter.key)}
          >
            <FilterDot filter={filter} />
            {filter.label} <span className="tabular-nums text-foreground">{counts[filter.key]}</span>
          </FilterChip>
        ))}
      </div>

      <div role="group" aria-label="Status mix across all topics" className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
        {statusFilters.map((filter) => {
          const dimmed = activeIsStatus && active !== filter.key;
          return (
            <button
              key={filter.key}
              type="button"
              aria-pressed={active === filter.key}
              aria-label={`${filter.label}: ${counts[filter.key]} of ${total} topics`}
              title={`${filter.label} — ${counts[filter.key]} of ${total}`}
              onClick={() => toggle(filter.key)}
              style={{ flex: counts[filter.key] }}
              className={cn(
                "h-full min-w-1 transition-all duration-300 hover:brightness-125",
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground",
                filter.hollow ? FADED_BG[filter.variant] : SOLID_BG[filter.variant],
                dimmed && "opacity-25"
              )}
            />
          );
        })}
      </div>
    </div>
  );
}