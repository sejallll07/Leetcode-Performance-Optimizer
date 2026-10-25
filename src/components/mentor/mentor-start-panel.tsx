"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { HINT_LEVELS } from "@/lib/mentor/config";
import {
  filterCatalog,
  formatTopics,
  PROGRESS_QUESTIONS,
  type MentorCatalogProblem,
} from "@/lib/mentor/mentor-view";

type MentorStartPanelProps = {
  catalog: MentorCatalogProblem[];
  /** Called with the chosen problem's slug. The parent decides what happens next. */
  onSelectProblem: (slug: string) => void;
  /** Called with a progress question, which the parent sends right away. */
  onAskQuestion: (question: string) => void;
  /** Lock every control, for example while a reply is on its way. */
  disabled?: boolean;
  /** Smaller layout for the floating chat window. */
  compact?: boolean;
};


type BadgeVariant = "neutral" | "success" | "warning" | "danger";

function difficultyVariant(difficulty: string): BadgeVariant {
  switch (difficulty.toLowerCase()) {
    case "easy":
      return "success";
    case "medium":
      return "warning";
    case "hard":
      return "danger";
    default:
      return "neutral";
  }
}

const HINT_STEP_NAMES = HINT_LEVELS.map((h) => h.name).join(", ");
const COMPACT_PROBLEM_LIMIT = 4;

export function MentorStartPanel({ catalog, onSelectProblem, onAskQuestion, disabled = false, compact = false }: MentorStartPanelProps) {
  const [query, setQuery] = useState("");
  const { problems, total, hiddenCount } = filterCatalog(
    catalog,
    compact ? { query, limit: COMPACT_PROBLEM_LIMIT } : { query }
  );
  const hasQuery = query.trim().length > 0;

  const resultsStatus =
    total === 0
      ? "No problems match your search."
      : hasQuery
        ? `${total} ${total === 1 ? "problem matches" : "problems match"} your search.`
        : "";
    if (compact) {
    return (
      <section aria-label="Start here" className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-foreground-muted">
            Ask about my progress
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {PROGRESS_QUESTIONS.map((question) => (
              <li key={question}>
                <button
                  type="button"
                  onClick={() => onAskQuestion(question)}
                  disabled={disabled}
                  className="min-h-9 rounded-full border border-border bg-surface px-3 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-50"
                >
                  {question}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-medium text-foreground-muted">
            Work on a problem
          </h3>
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or topic"
            aria-label="Search problems by name or topic"
            autoComplete="off"
            disabled={disabled}
            className="h-9"
          />
          <p role="status" className="sr-only">
            {resultsStatus}
          </p>

          {problems.length > 0 ? (
            <ul className="space-y-1">
              {problems.map((problem) => {
                const topics = formatTopics(problem.topicSlugs);
                return (
                  <li key={problem.slug}>
                    <button
                      type="button"
                      onClick={() => onSelectProblem(problem.slug)}
                      disabled={disabled}
                      className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-1.5 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {problem.title}
                        </span>
                        {topics && (
                          <span className="block truncate text-xs text-foreground-muted">
                            {topics}
                          </span>
                        )}
                      </span>
                      <Badge
                        variant={difficultyVariant(String(problem.difficulty))}
                        className="shrink-0"
                      >
                        {problem.difficulty}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-foreground-muted">
              No problems match. Try a different word or topic.
            </p>
          )}

          {hiddenCount > 0 && (
            <p className="text-xs text-foreground-muted">
              {`${hiddenCount} more. Type to narrow the list.`}
            </p>
          )}
        </div>

        <p className="text-xs text-foreground-muted">
          {`Hints come one step at a time (${HINT_LEVELS.length} steps). The full solution only appears when you ask for it.`}
        </p>
      </section>
    );
  }
  return (
    <section aria-label="Start here" className="space-y-3">
      <Card className="p-4">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="min-w-0 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Work on a problem</h2>
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or topic"
              aria-label="Search problems by name or topic"
              autoComplete="off"
              disabled={disabled}
            />
            <p role="status" className="sr-only">
              {resultsStatus}
            </p>

            {problems.length > 0 ? (
              <ul className="space-y-1.5">
                {problems.map((problem) => {
                  const topics = formatTopics(problem.topicSlugs);
                  return (
                    <li key={problem.slug}>
                      <button
                        type="button"
                        onClick={() => onSelectProblem(problem.slug)}
                        disabled={disabled}
                        className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">{problem.title}</span>
                          {topics && <span className="block truncate text-xs text-foreground-muted">{topics}</span>}
                        </span>
                        <Badge variant={difficultyVariant(String(problem.difficulty))} className="shrink-0">
                          {problem.difficulty}
                        </Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-foreground-muted">No problems match. Try a different word or topic.</p>
            )}

            {hiddenCount > 0 && (
              <p className="text-xs text-foreground-muted">{`${hiddenCount} more. Type to narrow the list.`}</p>
            )}
          </div>

          <div className="min-w-0 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Ask about my progress</h2>
            <ul className="space-y-1.5">
              {PROGRESS_QUESTIONS.map((question) => (
                <li key={question}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-auto w-full justify-start whitespace-normal py-2 text-left"
                    onClick={() => onAskQuestion(question)}
                    disabled={disabled}
                  >
                    {question}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <p className="px-1 text-xs text-foreground-muted">
        {`How hints work: ${HINT_LEVELS.length} steps, one at a time (${HINT_STEP_NAMES}). The full solution only appears when you ask for it.`}
      </p>
    </section>
  );
}