"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeRevisionAction } from "@/actions/revision";
import { FEEDBACK_OPTIONS } from "@/lib/revision/revision-view";
import type { RevisionFeedback } from "@/lib/revision/types";
import { cn } from "@/lib/utils";

// Full literal class strings so Tailwind can see them.
const OPTION_STYLE: Record<RevisionFeedback, { dot: string; hover: string }> = {
  Easy: { dot: "bg-success", hover: "hover:border-success/60 hover:bg-success-subtle/40" },
  Moderate: { dot: "bg-warning", hover: "hover:border-warning/60 hover:bg-warning-subtle/40" },
  Difficult: { dot: "bg-danger", hover: "hover:border-danger/60 hover:bg-danger-subtle/40" },
};

export type RevisionSavedInfo = {
  revisionItemId: string;
  problemTitle: string | undefined;
  feedback: RevisionFeedback;
  /** The interval the rating scheduled, e.g. "2 weeks" — only when previews were provided. */
  nextLabel: string | undefined;
};

/**
 * The three ratings for a review: "Easy — got it", "Moderate — needed a
 * push", "Difficult — struggled". The stored values and the action are
 * unchanged — only the wording is friendlier and, when `previews` is
 * given, each button says what rating it would schedule ("Next in 1
 * month"), so the choice has a visible consequence.
 *
 * On success it calls `onSaved` (so a parent can show a confirmation and
 * count the session) and then refreshes the page data, exactly as before.
 * `problemTitle`, `previews` and `onSaved` are all optional, so the
 * existing call site that only passes `revisionItemId` keeps working.
 */
export function RevisionFeedbackButtons({
  revisionItemId,
  problemTitle,
  previews,
  onSaved,
}: {
  revisionItemId: string;
  problemTitle?: string;
  previews?: Record<RevisionFeedback, string>;
  onSaved?: (info: RevisionSavedInfo) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingFeedback, setPendingFeedback] = useState<RevisionFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClick(feedback: RevisionFeedback) {
    setError(null);
    setPendingFeedback(feedback);
    startTransition(async () => {
      const result = await completeRevisionAction(revisionItemId, feedback);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved?.({ revisionItemId, problemTitle, feedback, nextLabel: previews?.[feedback] });
      router.refresh();
    });
  }

  return (
    <div>
      <div role="group" aria-label="How did this review go?" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {FEEDBACK_OPTIONS.map((option) => {
          const saving = isPending && pendingFeedback === option.feedback;
          return (
            <button
              key={option.feedback}
              type="button"
              disabled={isPending}
              onClick={() => handleClick(option.feedback)}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-lg border border-border bg-surface px-3 py-2 text-left transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                "disabled:cursor-not-allowed disabled:opacity-60",
                OPTION_STYLE[option.feedback].hover
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", OPTION_STYLE[option.feedback].dot)} />
                {saving ? "Saving..." : option.label}
              </span>
              {previews ? (
                <span className="text-xs text-foreground-muted">Next in {previews[option.feedback]}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}