"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Compass, ExternalLink, PlusCircle, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MasteryBar } from "@/components/ui/mastery-bar";
import { RadialProgress } from "@/components/ui/radial-progress";
import { roadmapStatusBadgeVariant, type BadgeVariant } from "@/lib/dashboard-format";
import type { NewPracticeResult } from "@/lib/roadmap/new-practice";
import type { RoadmapFocus, TopicGuidance, TopicRevisionSummary } from "@/lib/roadmap/roadmap-guidance";
import { getMoveOnProgress, type MoveOnProgress } from "@/lib/roadmap/roadmap-stages";
import { hasEvidence } from "@/lib/roadmap/roadmap-view";
import type { RoadmapTopic } from "@/lib/roadmap/types";
import { cn } from "@/lib/utils";

const SOLID_BG: Record<BadgeVariant, string> = {
  neutral: "bg-foreground-muted",
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

const DIFFICULTY_TEXT = { Easy: "text-success", Medium: "text-warning", Hard: "text-danger" } as const;

const EMPTY_NEW_PRACTICE: NewPracticeResult = { band: null, problems: [] };
const EMPTY_REVISION: TopicRevisionSummary = { dueCount: 0, overdueCount: 0, upcomingCount: 0, trackedCount: 0, dueItems: [] };

/** RadialProgress has no neutral variant; brand is the calm default. */
function ringVariant(variant: BadgeVariant): "brand" | "success" | "warning" | "danger" {
  return variant === "neutral" ? "brand" : variant;
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-foreground-muted">{title}</p>
        {aside}
      </div>
      {children}
    </div>
  );
}

function TopicChip({
  label,
  variant,
  weak,
  onClick,
}: {
  label: string;
  variant: BadgeVariant;
  /** A prerequisite that's currently shaky — the thing holding the topic back. */
  weak?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={weak ? `${label} — currently a weak prerequisite` : label}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        weak
          ? "border-danger/40 bg-danger-subtle text-danger hover:border-danger"
          : "border-border bg-surface-muted text-foreground hover:border-brand hover:text-brand"
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", weak ? "bg-danger" : SOLID_BG[variant])} />
      <span className="break-words text-left">{label}</span>
    </button>
  );
}

function MoveOn({ progress, variant }: { progress: MoveOnProgress; variant: BadgeVariant }) {
  switch (progress.kind) {
    case "no-evidence":
      return (
        <p className="text-sm text-foreground-muted">
          Solve a few problems to get a score. This topic counts as Strong at {progress.target} or above.
        </p>
      );
    case "building":
      return (
        <div className="space-y-1.5">
          <MasteryBar value={progress.score} variant={variant} label="Progress toward Strong" />
          <p className="text-sm text-foreground-muted">
            <span className="font-medium tabular-nums text-foreground">{progress.score}</span> of {progress.target} to
            count as Strong — {progress.pointsToGo} to go.
          </p>
        </div>
      );
    case "needs-evidence":
      return (
        <p className="text-sm text-foreground-muted">
          A couple more solved problems will make this score reliable. Strong is {progress.target} or above.
        </p>
      );
    case "needs-refresh":
      return (
        <p className="text-sm text-foreground-muted">
          Your score ({progress.score}) already clears {progress.target}, but it&apos;s been over{" "}
          {progress.staleAfterDays} days — a refresher brings it back to Strong.
        </p>
      );
    case "reached":
      return (
        <p className="text-sm text-foreground-muted">
          Strong ({progress.score}, bar is {progress.target}). Keep it fresh with revision.
        </p>
      );
  }
}

/**
 * NEW PRACTICE — "increase my exposure". Problems on this topic that
 * aren't in the student's synced solve history. Deliberately styled as
 * the opposite of the Revision block below: an indigo-tinted panel
 * whose problems are bordered cards, each one a single link with a
 * "Start practice" action.
 *
 * The wording is careful on purpose: the app only knows the history it
 * has synced, so this says "not found in your synced solve history",
 * never "not solved".
 */
function NewPracticeBlock({ topic, practice }: { topic: RoadmapTopic; practice: NewPracticeResult }) {
  const untouched = !hasEvidence(topic);

  return (
    <section aria-label="New practice" className="space-y-2.5 rounded-lg border border-brand/30 bg-brand-subtle/30 p-3">
      <div className="space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand">
            <PlusCircle className="h-3.5 w-3.5" aria-hidden />
            New practice
          </p>
          {practice.problems.length > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-brand">
              <ArrowRight className="h-3 w-3" aria-hidden />
              Solve these next
            </span>
          ) : null}
        </div>
        <p className="text-xs text-foreground-muted">Problems not found in your synced solve history</p>
      </div>

      {practice.problems.length > 0 ? (
        <>
          {untouched ? (
            <p className="text-xs text-foreground-muted">
              Starter problems from the curated list — there&apos;s no history on this topic yet to personalize from.
            </p>
          ) : null}
          <ul className="space-y-2">
            {practice.problems.map((problem) => (
              <li key={problem.slug}>
                <a
                  href={problem.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group block space-y-1 rounded-md border border-brand/25 bg-surface p-2.5 transition-colors hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0 break-words text-sm font-medium text-foreground">{problem.title}</span>
                    <span className={cn("shrink-0 text-xs font-medium", DIFFICULTY_TEXT[problem.difficulty])}>
                      {problem.difficulty}
                    </span>
                  </span>
                  <span className="block text-xs text-foreground-muted">{problem.reason}</span>
                  <span className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-foreground-muted">
                      {problem.topicName} · {problem.source === "engine" ? "Personalized pick" : "Curated pick"}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 font-medium text-brand group-hover:underline">
                      Start practice
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-foreground-muted">
          {practice.band === null
            ? "Work on its prerequisite first — new practice here comes after."
            : "No new problems found for this topic right now."}
        </p>
      )}
    </section>
  );
}

/**
 * REVISION — "strengthen my retention". Problems the student has
 * already solved that are due for review, straight from the existing
 * Revision system. Styled as the opposite of New practice: a plain
 * amber-outlined panel with a compact list (no cards) and due-date
 * chips, whose action is the Revision Center, not a new problem.
 */
function RevisionBlock({ topic, revision }: { topic: RoadmapTopic; revision: TopicRevisionSummary }) {
  return (
    <section aria-label="Revision" className="space-y-2.5 rounded-lg border border-warning/40 bg-surface p-3">
      <div className="space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-warning">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Revision
          </p>
          <span
            title={`Counts revision items whose main topic is ${topic.topicName}.`}
            className={cn(
              "text-xs font-medium tabular-nums",
              revision.dueCount > 0 ? "text-warning" : "text-foreground-muted"
            )}
          >
            {revision.dueCount > 0 ? `${revision.dueCount} due` : "None due"}
          </span>
        </div>
        <p className="text-xs text-foreground-muted">Problems you&apos;ve already solved and should revisit</p>
        {revision.dueCount > 0 ? (
          <p className="inline-flex items-center gap-1 text-xs font-medium text-warning">
            <ArrowRight className="h-3 w-3" aria-hidden />
            Review these
          </p>
        ) : null}
      </div>

      {revision.dueCount > 0 ? (
        <ul className="divide-y divide-border">
          {revision.dueItems.map((item) => (
            <li key={item.problemSlug} className="flex items-baseline justify-between gap-2 py-1.5 text-sm first:pt-0">
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-w-0 items-center gap-1 font-medium text-foreground hover:underline"
              >
                <span className="break-words">{item.problemTitle}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-foreground-muted" aria-hidden />
              </a>
              <span className="flex shrink-0 items-center gap-1.5 text-xs">
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px font-medium",
                    item.daysOverdue > 0 ? "bg-danger-subtle text-danger" : "bg-warning-subtle text-warning"
                  )}
                >
                  {item.daysOverdue === 0 ? "Due today" : `Overdue ${item.daysOverdue}d`}
                </span>
                <span className={DIFFICULTY_TEXT[item.difficulty]}>{item.difficulty}</span>
              </span>
            </li>
          ))}
          {revision.dueCount > revision.dueItems.length ? (
            <li className="pt-1.5 text-xs text-foreground-muted">+ {revision.dueCount - revision.dueItems.length} more due</li>
          ) : null}
        </ul>
      ) : (
        <p className="text-sm text-foreground-muted">
          {revision.trackedCount > 0
            ? `Nothing due — ${revision.upcomingCount} scheduled for later.`
            : "No solved problems from this topic are in revision yet."}
        </p>
      )}

      {revision.trackedCount > 0 ? (
        <Link
          href="/revision"
          className="inline-flex items-center gap-1 text-xs font-medium text-warning hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Open Revision Center
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      ) : null}
    </section>
  );
}

/**
 * The Roadmap's main panel — the answer to "what should I do and
 * why", for whichever topic is on screen. With nothing selected (or
 * the recommended topic selected) it IS the "Your next step" card, with
 * the strongest emphasis on the page; select any other topic and it
 * becomes a focused view of that topic that says plainly why you're
 * looking at it and offers a way back.
 *
 * For the topic, it shows in order: why, what to learn first, NEW
 * PRACTICE (increase exposure: problems not found in the synced solve
 * history), REVISION (strengthen retention: solved problems due for
 * review, with the way to the Revision Center), what "done" looks like,
 * and what it unlocks. The two problem sections are styled as clear
 * opposites so they can't be mistaken for each other.
 *
 * Presentational. Everything shown is computed elsewhere (the engine,
 * the pure helpers); nothing here decides anything.
 */
export function RoadmapFocusCard({
  topic,
  focus,
  stageLabel,
  guidance,
  unlocks,
  topicsBySlug,
  onNavigate,
  onBackToNextStep,
  className,
}: {
  /** The topic on screen: the selected one, or the next step's topic when nothing is selected. */
  topic: RoadmapTopic | null;
  /** The page's recommended next step, if there is one. */
  focus: RoadmapFocus | null;
  /** The stage this topic belongs to, or null for topics outside the structured progression. */
  stageLabel: string | null;
  guidance: TopicGuidance | undefined;
  unlocks: RoadmapTopic[];
  topicsBySlug: Map<string, RoadmapTopic>;
  onNavigate: (slug: string) => void;
  onBackToNextStep: () => void;
  className?: string;
}) {
  if (!topic) {
    return (
      <Card className={className}>
        <CardContent className="space-y-1 p-5">
          <p className="text-sm font-semibold text-foreground">You&apos;re all caught up</p>
          <p className="text-sm text-foreground-muted">
            Nothing urgent right now. Pick any topic on the map to see where it stands and what comes after it.
          </p>
        </CardContent>
      </Card>
    );
  }

  const showingNextStep = focus !== null && focus.topic.topicSlug === topic.topicSlug;
  const variant = roadmapStatusBadgeVariant(topic.status);
  const evidenced = hasEvidence(topic);
  const score = Math.round(topic.masteryScore ?? 0);

  const newPractice = guidance?.newPracticeRecommendations ?? EMPTY_NEW_PRACTICE;
  const revision = guidance?.revision ?? EMPTY_REVISION;

  const holdingUpNote =
    !showingNextStep && focus?.forTopic?.topicSlug === topic.topicSlug
      ? " It's the topic your next step is holding up."
      : "";

  return (
    <Card className={cn(showingNextStep && "border-brand/50 ring-1 ring-brand/30", className)}>
      <CardContent aria-live="polite" className="space-y-4 p-4">
        {showingNextStep && focus ? (
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand">
              <Compass className="h-3.5 w-3.5" aria-hidden />
              Your next step
            </p>
            <Badge variant="brand">{focus.actionLabel}</Badge>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-sm text-foreground-muted">
              You&apos;re looking at <span className="font-medium text-foreground">{topic.topicName}</span> because you
              selected it.{holdingUpNote}
            </p>
            {focus ? (
              <button
                type="button"
                onClick={onBackToNextStep}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Back to your next step
              </button>
            ) : null}
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* Keyed by topic so the ring replays its fill when you move to another topic. */}
          <RadialProgress
            key={topic.topicSlug}
            value={evidenced ? score : 0}
            size={showingNextStep ? 64 : 56}
            strokeWidth={6}
            variant={ringVariant(variant)}
            className="shrink-0"
          >
            {evidenced ? (
              <span className="text-lg font-semibold tabular-nums text-foreground">{score}</span>
            ) : (
              <span className="text-sm text-foreground-muted">—</span>
            )}
          </RadialProgress>

          <div className="min-w-0 space-y-1.5">
            <h3 className={cn("break-words font-semibold text-foreground", showingNextStep ? "text-xl" : "text-lg")}>
              {topic.topicName}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={variant}>{topic.status}</Badge>
              {stageLabel ? <span className="text-xs text-foreground-muted">{stageLabel} stage</span> : null}
            </div>
          </div>
        </div>

        <Section title="Why">
          {showingNextStep && focus ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{focus.title}</p>
              <p className="text-sm text-foreground-muted">{focus.reason}</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{topic.recommendedAction}</p>
              <p className="text-sm text-foreground-muted">{topic.actionReason}</p>
            </div>
          )}
        </Section>

        <Section title="Before you start">
          {topic.prerequisites.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {topic.prerequisites.map((prerequisite) => (
                <TopicChip
                  key={prerequisite.topicSlug}
                  label={prerequisite.topicName}
                  variant={
                    topicsBySlug.has(prerequisite.topicSlug)
                      ? roadmapStatusBadgeVariant(topicsBySlug.get(prerequisite.topicSlug)!.status)
                      : "neutral"
                  }
                  weak={prerequisite.isWeak}
                  onClick={() => onNavigate(prerequisite.topicSlug)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-foreground-muted">Nothing — you can start right away.</p>
          )}
        </Section>

        <NewPracticeBlock topic={topic} practice={newPractice} />

        <RevisionBlock topic={topic} revision={revision} />

        <Section title="Done when">
          <MoveOn progress={getMoveOnProgress(topic)} variant={variant} />
        </Section>

        <Section title="Unlocks next">
          {unlocks.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {unlocks.map((dependent) => (
                <TopicChip
                  key={dependent.topicSlug}
                  label={dependent.topicName}
                  variant={roadmapStatusBadgeVariant(dependent.status)}
                  onClick={() => onNavigate(dependent.topicSlug)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-foreground-muted">Nothing else builds directly on this yet.</p>
          )}
        </Section>
      </CardContent>
    </Card>
  );
}