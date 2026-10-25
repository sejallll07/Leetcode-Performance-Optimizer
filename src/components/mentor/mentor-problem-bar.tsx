import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  formatTopics,
  type LadderState,
  type LadderStepState,
  type MentorCatalogProblem,
} from "@/lib/mentor/mentor-view";
import { cn } from "@/lib/utils";

type MentorProblemBarProps = {
  problem: MentorCatalogProblem;
  /** The value returned by getLadderState for this problem. */
  ladder: LadderState;
  /** Called when the student wants to pick a different problem. The parent decides what happens. */
  onChange: () => void;
  className?: string;
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

const DOT_CLASSES: Record<LadderStepState, string> = {
  done: "h-2 w-2 rounded-full bg-brand",
  current: "h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-brand-subtle",
  upcoming: "h-2 w-2 rounded-full bg-border",
};

const STATE_WORDS: Record<LadderStepState, string> = {
  done: "done",
  current: "current",
  upcoming: "not reached",
};

export function MentorProblemBar({ problem, ladder, onChange, className }: MentorProblemBarProps) {
  const topics = formatTopics(problem.topicSlugs);

  return (
    <section aria-label="Active problem" className={className}>
      <Card className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">{problem.title}</h2>
              <Badge variant={difficultyVariant(String(problem.difficulty))} className="shrink-0">
                {problem.difficulty}
              </Badge>
            </div>
            {topics && <p className="truncate text-xs text-foreground-muted">{topics}</p>}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={onChange}
            aria-label={`Change problem, currently ${problem.title}`}
          >
            Change
          </Button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <ol aria-label="Hint progress" className="flex items-center gap-1.5">
            {ladder.steps.map((step) => (
              <li key={step.level} className="flex items-center">
                <span className={cn(DOT_CLASSES[step.state])} aria-hidden="true" />
                <span className="sr-only">
                  {`Level ${step.level}, ${step.name}, ${STATE_WORDS[step.state]}`}
                </span>
              </li>
            ))}
          </ol>
          {ladder.solutionShown ? (
            <Badge variant="warning">Solution shown</Badge>
          ) : (
            <p className="text-xs text-foreground-muted">{ladder.label}</p>
          )}
        </div>
      </Card>
    </section>
  );
}