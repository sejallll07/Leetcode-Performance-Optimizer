"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { MasteryBar } from "@/components/ui/mastery-bar";
import { RoadmapTopicNode } from "@/components/roadmap/roadmap-topic-node";
import type { RoadmapStage } from "@/lib/roadmap/roadmap-stages";
import type { RoadmapTopic } from "@/lib/roadmap/types";

export type RoadmapNodeState = {
  selected: boolean;
  dimmed: boolean;
  related: boolean;
};

// Nodes flow into as many columns as fit, never narrower than ~9.5rem,
// so topic names wrap onto a second line instead of being cut off.
const NODE_GRID = "grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2";

/**
 * The progression picture: curated-graph topics grouped into
 * Foundations → Build → Advance bands, top to bottom, each its own
 * bordered panel with a header saying what the stage means and how
 * much of it is Strong. Generous space and a chevron between bands keep
 * topics from different stages from blending together; the order
 * reads like a ladder — what you need first is at the top.
 *
 * Topics the student has practiced that aren't part of the curated
 * graph sit in a collapsed group underneath, so they're one click
 * away without crowding the progression.
 *
 * Presentational. The explorer decides each node's state and handles
 * selection/hover; this only lays them out.
 */
export function RoadmapStageMap({
  stages,
  otherTopics,
  nextStepSlug,
  revisionDueBySlug,
  nodeState,
  forceOtherOpen,
  onSelect,
  onHoverChange,
  className,
}: {
  stages: RoadmapStage[];
  otherTopics: RoadmapTopic[];
  /** The topic the page recommends working on next, if any. */
  nextStepSlug: string | null;
  /** Due revision items per topic slug; missing = none. */
  revisionDueBySlug: Record<string, number>;
  nodeState: (topic: RoadmapTopic) => RoadmapNodeState;
  /** Keep the "other topics" group open when the selection or filter lands inside it. */
  forceOtherOpen: boolean;
  onSelect: (slug: string) => void;
  onHoverChange: (slug: string | null) => void;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const [otherOpen, setOtherOpen] = useState(false);

  // One orchestrated entrance: the stages ease in top to bottom after mount.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  function renderNode(topic: RoadmapTopic) {
    const state = nodeState(topic);
    return (
      <RoadmapTopicNode
        key={topic.topicSlug}
        topic={topic}
        selected={state.selected}
        dimmed={state.dimmed}
        related={state.related}
        nextStep={topic.topicSlug === nextStepSlug}
        revisionDue={revisionDueBySlug[topic.topicSlug] ?? 0}
        onSelect={onSelect}
        onHoverChange={onHoverChange}
      />
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        {stages.map((stage, index) => (
          <div
            key={stage.level}
            style={{ transitionDelay: `${index * 120}ms` }}
            className={cn(
              "transition-all duration-500 ease-out",
              "motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
              revealed ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
            )}
          >
            {index > 0 ? (
              <div aria-hidden className="flex justify-center py-1.5 text-foreground-muted">
                <ChevronDown className="h-4 w-4" />
              </div>
            ) : null}

            <section
              aria-label={`${stage.label} stage`}
              className="rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              <header className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">{stage.label}</h3>
                    <p className="text-xs text-foreground-muted">{stage.description}</p>
                  </div>
                </div>

                <div
                  className="flex w-40 shrink-0 items-center gap-2"
                  title={`${stage.strongCount} of ${stage.topics.length} Strong · ${stage.startedCount} started`}
                >
                  <MasteryBar
                    value={stage.topics.length > 0 ? (stage.strongCount / stage.topics.length) * 100 : 0}
                    variant="success"
                    label={`${stage.label}: ${stage.strongCount} of ${stage.topics.length} topics Strong`}
                    className="flex-1"
                  />
                  <span className="shrink-0 text-xs tabular-nums text-foreground-muted">
                    {stage.strongCount}/{stage.topics.length} strong
                  </span>
                </div>
              </header>

              <div className={NODE_GRID}>{stage.topics.map(renderNode)}</div>
            </section>
          </div>
        ))}
      </div>

      {otherTopics.length > 0 ? (
        <details
          open={otherOpen || forceOtherOpen}
          onToggle={(event) => setOtherOpen(event.currentTarget.open)}
          className="group rounded-xl border border-border bg-surface"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
            <span className="font-medium text-foreground">
              Other topics you&apos;ve practiced{" "}
              <span className="tabular-nums text-foreground-muted">({otherTopics.length})</span>
            </span>
            <span className="flex items-center gap-2 text-xs text-foreground-muted">
              No prerequisite links
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
            </span>
          </summary>
          <div className="border-t border-border p-4">
            <div className={NODE_GRID}>{otherTopics.map(renderNode)}</div>
          </div>
        </details>
      ) : null}
    </div>
  );
}