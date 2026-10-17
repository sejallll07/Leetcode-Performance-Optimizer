"use client";

import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { MasteryBar } from "@/components/ui/mastery-bar";
import { roadmapStatusBadgeVariant, type BadgeVariant } from "@/lib/dashboard-format";
import { hasEvidence } from "@/lib/roadmap/roadmap-view";
import type { RoadmapTopic } from "@/lib/roadmap/types";

// Full literal class strings so Tailwind can see them (see the same
// note in roadmap-status-filter.tsx).
const EVIDENCE_TINT: Record<BadgeVariant, string> = {
  neutral: "border-border bg-surface",
  brand: "border-brand/30 bg-brand-subtle/50",
  success: "border-success/30 bg-success-subtle/60",
  warning: "border-warning/30 bg-warning-subtle/60",
  danger: "border-danger/30 bg-danger-subtle/60",
};

const SOLID_BG: Record<BadgeVariant, string> = {
  neutral: "bg-foreground-muted",
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

const HOLLOW_BORDER: Record<BadgeVariant, string> = {
  neutral: "border-foreground-muted",
  brand: "border-brand",
  success: "border-success",
  warning: "border-warning",
  danger: "border-danger",
};

/**
 * One topic on the stage map. Its state reads at a glance without a
 * legend:
 *  - tinted background + dot = status (same colors as the badges)
 *  - mini bar + score = mastery (none for zero-evidence topics — a
 *    fake 0 would read as "assessed and bad")
 *  - dashed outline = "Recommended Next"; faded + dashed = "Postponed"
 *  - small ringed red dot = weakness traces back to a shaky prerequisite
 *  - "Next up" tag + soft pulsing ring = the single recommended step
 *  - small revision icon + count = problems from this topic are due
 *  - solid indigo ring = the topic you've selected
 *
 * The full topic name always wraps rather than truncating, and the
 * native tooltip repeats it with the status and score for anyone who
 * wants the detail without clicking.
 *
 * Presentational: the explorer decides `selected`, `dimmed`,
 * `related`, `nextStep` and `revisionDue`, and handles the callbacks.
 */
export function RoadmapTopicNode({
  topic,
  selected,
  dimmed,
  related,
  nextStep,
  revisionDue,
  onSelect,
  onHoverChange,
}: {
  topic: RoadmapTopic;
  /** The node pinned by click — drives the focus card. */
  selected: boolean;
  /** Faded back by the status filter or the hover spotlight. */
  dimmed: boolean;
  /** Part of the hovered/selected topic's prerequisite chain (either direction). */
  related: boolean;
  /** This is the topic the page recommends working on next. */
  nextStep: boolean;
  /** Revision items due for this topic (overdue + due today). 0 hides the marker. */
  revisionDue: number;
  onSelect: (slug: string) => void;
  onHoverChange: (slug: string | null) => void;
}) {
  const variant = roadmapStatusBadgeVariant(topic.status);
  const evidenced = hasEvidence(topic);
  const isNext = topic.status === "Recommended Next";
  const isPostponed = topic.status === "Postponed";
  const hollow = isNext || isPostponed;
  const score = Math.round(topic.masteryScore ?? 0);

  const tooltip = evidenced
    ? `${topic.topicName} — ${topic.status}, mastery ${score}/100`
    : `${topic.topicName} — ${topic.status}, not started`;
  const scoreLabel = evidenced ? `, mastery ${score} out of 100` : ", not started";
  const prereqLabel = topic.isPrerequisiteGap ? ", weakness traces back to a prerequisite" : "";
  const revisionLabel = revisionDue > 0 ? `, ${revisionDue} revision ${revisionDue === 1 ? "item" : "items"} due` : "";
  const nextLabel = nextStep ? ", recommended next step" : "";

  return (
    <button
      type="button"
      data-topic-slug={topic.topicSlug}
      aria-pressed={selected}
      aria-label={`${topic.topicName}, ${topic.status}${scoreLabel}${prereqLabel}${revisionLabel}${nextLabel}`}
      title={tooltip}
      onClick={() => onSelect(topic.topicSlug)}
      onMouseEnter={() => onHoverChange(topic.topicSlug)}
      onMouseLeave={() => onHoverChange(null)}
      onFocus={() => onHoverChange(topic.topicSlug)}
      onBlur={() => onHoverChange(null)}
      className={cn(
        "group relative flex w-full flex-col gap-1.5 rounded-lg border px-2.5 py-2 text-left",
        "transition-all duration-200 hover:-translate-y-px hover:border-foreground-muted/60",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        isNext
          ? "border-dashed border-brand/60 bg-surface"
          : isPostponed
            ? "border-dashed border-border bg-surface"
            : EVIDENCE_TINT[variant],
        related && !selected && "border-brand/70 ring-1 ring-brand/40",
        selected && "border-brand ring-2 ring-brand",
        dimmed ? "opacity-25" : isPostponed ? "opacity-70" : "opacity-100"
      )}
    >
      {nextStep ? (
        <>
          {!selected ? (
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-1 rounded-xl ring-2 ring-brand/70 animate-pulse motion-reduce:animate-none"
            />
          ) : null}
          <span
            aria-hidden
            className="absolute -top-2 right-2 rounded-full bg-brand px-1.5 py-px text-[10px] font-semibold leading-tight text-brand-foreground"
          >
            Next up
          </span>
        </>
      ) : null}

      <span className="flex items-start gap-2">
        {hollow ? (
          <span
            className={cn("mt-1 h-2 w-2 shrink-0 rounded-full border-[1.5px] bg-transparent", HOLLOW_BORDER[variant])}
          />
        ) : (
          <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", SOLID_BG[variant])} />
        )}
        <span className="min-w-0 flex-1 break-words text-sm font-medium leading-snug text-foreground">
          {topic.topicName}
        </span>
        {topic.isPrerequisiteGap ? (
          <span
            title="Weakness here traces back to a shaky prerequisite"
            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-danger ring-2 ring-danger/30"
          />
        ) : null}
      </span>

      <span className="flex items-center gap-2">
        {evidenced ? (
          <>
            <MasteryBar value={topic.masteryScore ?? 0} variant={variant} className="flex-1" />
            <span className="w-6 shrink-0 text-right text-xs tabular-nums text-foreground-muted">{score}</span>
          </>
        ) : (
          <span className="flex-1 text-xs text-foreground-muted">{topic.recommendedAction}</span>
        )}
        {revisionDue > 0 ? (
          <span
            title={`${revisionDue} revision ${revisionDue === 1 ? "item" : "items"} due`}
            className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium tabular-nums text-warning"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            {revisionDue}
          </span>
        ) : null}
      </span>
    </button>
  );
}