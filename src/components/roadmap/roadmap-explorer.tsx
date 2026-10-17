"use client";

import { useEffect, useMemo, useState } from "react";
import { ListFilter } from "lucide-react";
import { cn } from "@/lib/utils";
import { roadmapStatusBadgeVariant, type BadgeVariant } from "@/lib/dashboard-format";
import { RoadmapFocusCard } from "@/components/roadmap/roadmap-focus-card";
import { RoadmapStageMap, type RoadmapNodeState } from "@/components/roadmap/roadmap-stage-map";
import { RoadmapStatusFilter } from "@/components/roadmap/roadmap-status-filter";
import type { RoadmapFocus, TopicGuidance } from "@/lib/roadmap/roadmap-guidance";
import { buildStages, summarizePosition, type PositionSummary } from "@/lib/roadmap/roadmap-stages";
import {
  buildTopicIndex,
  buildUnlocksMap,
  countByFilter,
  getChain,
  getFilterDef,
  topicMatchesFilter,
  type RoadmapFilterKey,
} from "@/lib/roadmap/roadmap-view";
import type { RoadmapTopic } from "@/lib/roadmap/types";

const SOLID_BG: Record<BadgeVariant, string> = {
  neutral: "bg-foreground-muted",
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

const MAX_ATTENTION_CHIPS = 3;

/**
 * "Where you are" — one glanceable strip: how much of the core
 * progression is Strong, what's in progress or not started (the
 * colored counts double as the legend for the bar), and the few topics
 * that most need work, each a click away.
 */
function PositionStrip({ summary, onSelect }: { summary: PositionSummary; onSelect: (slug: string) => void }) {
  const inProgress = summary.coreStarted - summary.coreStrong;
  const segments = [
    { key: "strong", count: summary.coreStrong, bar: "bg-success", dot: "bg-success", label: "Strong" },
    { key: "progress", count: inProgress, bar: "bg-brand", dot: "bg-brand", label: "in progress" },
    {
      key: "notStarted",
      count: summary.coreNotStarted,
      bar: "bg-foreground-muted/35",
      dot: "border-[1.5px] border-foreground-muted bg-transparent",
      label: "not started",
    },
  ];
  const shownAttention = summary.needsAttention.slice(0, MAX_ATTENTION_CHIPS);
  const hiddenAttention = summary.needsAttention.length - shownAttention.length;

  return (
    <section
      aria-label="Where you are"
      className="grid gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted">Where you are</p>
        {summary.coreTotal > 0 ? (
          <>
            <p className="text-sm text-foreground">
              <span className="text-xl font-semibold tabular-nums">{summary.coreStrong}</span>
              <span className="text-foreground-muted"> of {summary.coreTotal} core topics are Strong</span>
            </p>
            <div
              role="img"
              aria-label={segments.map((s) => `${s.count} ${s.label}`).join(", ")}
              className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full"
            >
              {segments
                .filter((s) => s.count > 0)
                .map((s) => (
                  <span key={s.key} style={{ flex: s.count }} className={cn("h-full", s.bar)} />
                ))}
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-muted">
              {segments.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", s.dot)} />
                  <span className="tabular-nums text-foreground">{s.count}</span> {s.label}
                </span>
              ))}
            </p>
          </>
        ) : (
          <p className="text-sm text-foreground-muted">No roadmap topics yet.</p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted">Needs work</p>
        {shownAttention.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {shownAttention.map((topic) => (
              <button
                key={topic.topicSlug}
                type="button"
                onClick={() => onSelect(topic.topicSlug)}
                title={`${topic.topicName} — ${topic.status}`}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2 py-0.5 text-xs text-foreground transition-colors hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", SOLID_BG[roadmapStatusBadgeVariant(topic.status)])} />
                <span className="break-words text-left">{topic.topicName}</span>
              </button>
            ))}
            {hiddenAttention > 0 ? (
              <span className="text-xs text-foreground-muted">+ {hiddenAttention} more</span>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-foreground-muted">Nothing needs urgent work right now.</p>
        )}
      </div>
    </section>
  );
}

/**
 * The Roadmap page's interactive core. Top to bottom it answers: where
 * you are (the strip), what to do next and why (the focus card — the
 * strongest element, shown first on small screens and sticky beside the
 * map on large ones), and the progression it all sits in (the stage map).
 *
 * Owns the interaction state — status filter, the topic pinned by
 * click, the topic under the pointer — and derives everything else
 * from data the server already computed. Nothing here scores,
 * classifies or reorders anything.
 *
 *  - Hover or select: spotlights that topic's full prerequisite chain
 *    (what it depends on, what it leads to) and fades the rest. Hover
 *    wins over a pinned selection while the pointer is on a node.
 *  - Filter: a status chip fades every topic that doesn't match, and
 *    takes priority over the spotlight while active.
 *  - Esc: clears the pinned selection first, then the filter.
 *  - The card shows the pinned topic, or the recommended next step
 *    until something is pinned.
 */
export function RoadmapExplorer({
  topics,
  // Defaults keep the page rendering (without a next step or practice/revision
  // details) if an older page.tsx is still passing the previous props.
  focus = null,
  guidanceBySlug = {},
}: {
  topics: RoadmapTopic[];
  /** The recommended next step (from the engine's next actions), or null when there's nothing to do. */
  focus: RoadmapFocus | null;
  /** Practice and revision guidance per topic slug, built on the server. */
  guidanceBySlug: Record<string, TopicGuidance>;
}) {
  const [filter, setFilter] = useState<RoadmapFilterKey | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (selectedSlug !== null) setSelectedSlug(null);
      else if (filter !== null) setFilter(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedSlug, filter]);

  const topicsBySlug = useMemo(() => buildTopicIndex(topics), [topics]);
  const unlocks = useMemo(() => buildUnlocksMap(topics), [topics]);
  const counts = useMemo(() => countByFilter(topics), [topics]);
  const { stages, otherTopics } = useMemo(() => buildStages(topics, unlocks), [topics, unlocks]);
  const position = useMemo(() => summarizePosition(topics, unlocks), [topics, unlocks]);

  const stageLabelBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const stage of stages) for (const topic of stage.topics) map.set(topic.topicSlug, stage.label);
    return map;
  }, [stages]);

  const revisionDueBySlug = useMemo(() => {
    const due: Record<string, number> = {};
    for (const [slug, guidance] of Object.entries(guidanceBySlug)) {
      if (guidance.revision.dueCount > 0) due[slug] = guidance.revision.dueCount;
    }
    return due;
  }, [guidanceBySlug]);

  const nextStepSlug = focus?.topic.topicSlug ?? null;
  const focusSlug = hoveredSlug ?? selectedSlug;
  const chain = useMemo(
    () => (focusSlug ? getChain(focusSlug, topicsBySlug, unlocks) : null),
    [focusSlug, topicsBySlug, unlocks]
  );

  const cardSlug = selectedSlug ?? nextStepSlug;
  const cardTopic = cardSlug ? (topicsBySlug.get(cardSlug) ?? null) : null;

  if (topics.length === 0) {
    return <p className="text-sm text-foreground-muted">No topics on the roadmap yet.</p>;
  }

  function nodeState(topic: RoadmapTopic): RoadmapNodeState {
    const slug = topic.topicSlug;
    const selected = slug === selectedSlug;
    const inChain = chain !== null && (slug === focusSlug || chain.upstream.has(slug) || chain.downstream.has(slug));
    // The filter takes priority when one is active; otherwise the spotlight decides.
    const faded = filter !== null ? !topicMatchesFilter(topic, filter) : chain !== null && !inChain;
    const dimmed = !selected && faded;
    const related = !dimmed && chain !== null && slug !== focusSlug && inChain;
    return { selected, dimmed, related };
  }

  const forceOtherOpen =
    (selectedSlug !== null && otherTopics.some((t) => t.topicSlug === selectedSlug)) ||
    (filter !== null && otherTopics.some((t) => topicMatchesFilter(t, filter)));

  return (
    <div className="space-y-4">
      <PositionStrip summary={position} onSelect={setSelectedSlug} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        {/* Next-step card first in the DOM (so it leads on small screens), beside the map on large ones. */}
        <div className="lg:col-start-2 lg:row-start-1 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:sticky lg:top-0">
          <RoadmapFocusCard
            topic={cardTopic}
            focus={focus}
            stageLabel={cardTopic ? (stageLabelBySlug.get(cardTopic.topicSlug) ?? null) : null}
            guidance={cardTopic ? guidanceBySlug[cardTopic.topicSlug] : undefined}
            unlocks={cardTopic ? (unlocks.get(cardTopic.topicSlug) ?? []) : []}
            topicsBySlug={topicsBySlug}
            onNavigate={setSelectedSlug}
            onBackToNextStep={() => setSelectedSlug(null)}
          />
        </div>

        <section aria-label="Roadmap progression" className="space-y-3 lg:col-start-1 lg:row-start-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Roadmap progression</h2>
              <p className="text-xs text-foreground-muted">
                Hover a topic to trace what it depends on and what it leads to. Esc clears.
              </p>
            </div>
            <button
              type="button"
              aria-expanded={filterOpen || filter !== null}
              onClick={() => setFilterOpen((open) => !open)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <ListFilter className="h-3.5 w-3.5" aria-hidden />
              {filter ? `Filtering: ${getFilterDef(filter).label}` : "Filter by status"}
            </button>
          </div>

          {filterOpen || filter !== null ? (
            <RoadmapStatusFilter counts={counts} total={topics.length} active={filter} onChange={setFilter} />
          ) : null}

          <RoadmapStageMap
            stages={stages}
            otherTopics={otherTopics}
            nextStepSlug={nextStepSlug}
            revisionDueBySlug={revisionDueBySlug}
            nodeState={nodeState}
            forceOtherOpen={forceOtherOpen}
            onSelect={(slug) => setSelectedSlug((current) => (current === slug ? null : slug))}
            onHoverChange={setHoveredSlug}
          />
        </section>
      </div>
    </div>
  );
}