"use client";

import { useState, useTransition } from "react";
import { startMockInterviewAction, submitMockInterviewOutcomesAction } from "@/actions/interview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PerformanceReportView } from "@/components/interview/performance-report-view";
import type { MockInterviewOutcome, MockInterviewProblemOutcome, MockInterviewSessionResult } from "@/lib/interview/types";

type DraftOutcome = { outcome: MockInterviewOutcome; timeTakenMinutes: string; usedHints: boolean };

function leetcodeUrl(slug: string): string {
  return `https://leetcode.com/problems/${slug}/`;
}

export function MockInterviewFlow({ initialSession }: { initialSession: MockInterviewSessionResult | null }) {
  const [session, setSession] = useState<MockInterviewSessionResult | null>(initialSession);
  const [drafts, setDrafts] = useState<Record<string, DraftOutcome>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateDraft(slug: string, patch: Partial<DraftOutcome>) {
    setDrafts((prev) => ({
      ...prev,
      [slug]: {
        ...prev[slug],
        outcome: "Skipped",
        timeTakenMinutes: "",
        usedHints: false,
        ...patch,
      },
    }));
  }

  function handleStart() {
    startTransition(async () => {
      const result = await startMockInterviewAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setDrafts({});
      setSession(result.data);
    });
  }

  function handleFinish() {
    if (!session) return;
    const outcomes: MockInterviewProblemOutcome[] = session.problems.map((p) => {
      const draft = drafts[p.slug] ?? { outcome: "Skipped" as const, timeTakenMinutes: "", usedHints: false };
      const minutes = draft.timeTakenMinutes.trim() === "" ? null : Number(draft.timeTakenMinutes);
      return { slug: p.slug, outcome: draft.outcome, timeTakenMinutes: minutes !== null && Number.isFinite(minutes) ? minutes : null, usedHints: draft.usedHints };
    });

    startTransition(async () => {
      const result = await submitMockInterviewOutcomesAction(session.sessionId, outcomes);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setSession(result.data);
    });
  }

  if (error) {
    return (
      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-sm text-danger">{error}</p>
          <Button size="sm" variant="secondary" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!session) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Mock Interview</CardTitle>
          <CardDescription>3 problems, personalized to your current profile: an Easy warm-up, a Medium problem, and a stretch problem sized to how you&apos;re doing overall.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleStart} disabled={isPending}>
            {isPending ? "Starting…" : "Start Mock Interview"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (session.status === "COMPLETED" && session.report) {
    return (
      <div className="space-y-4">
        <PerformanceReportView report={session.report} narrative={session.narrative} narrativeError={session.narrativeError} />
        <Button onClick={handleStart} disabled={isPending}>
          {isPending ? "Starting…" : "Start a New Mock Interview"}
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mock Interview in Progress</CardTitle>
        <CardDescription>Open each problem on LeetCode, attempt it, then report your outcome below. Report honestly — this is for you.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {session.problems.map((p) => {
          const draft = drafts[p.slug] ?? { outcome: "Skipped" as const, timeTakenMinutes: "", usedHints: false };
          return (
            <div key={p.slug} className="rounded-md border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Badge variant="neutral" className="mb-1 uppercase">
                    {p.role}
                  </Badge>
                  <a href={leetcodeUrl(p.slug)} target="_blank" rel="noreferrer" className="block text-sm font-medium text-brand hover:underline">
                    {p.title} ({p.difficulty}) ↗
                  </a>
                  <p className="text-xs text-foreground-muted">{p.reason}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="text-xs text-foreground-muted">
                  Outcome
                  <select
                    className="mt-1 flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    value={draft.outcome}
                    onChange={(e) => updateDraft(p.slug, { outcome: e.target.value as MockInterviewOutcome })}
                  >
                    <option value="Skipped">Skipped</option>
                    <option value="Attempted">Attempted, not solved</option>
                    <option value="Solved">Solved</option>
                  </select>
                </label>
                <label className="text-xs text-foreground-muted">
                  Time taken (minutes)
                  <Input
                    type="number"
                    min={0}
                    className="mt-1"
                    value={draft.timeTakenMinutes}
                    onChange={(e) => updateDraft(p.slug, { timeTakenMinutes: e.target.value })}
                    placeholder="optional"
                  />
                </label>
                <label className="mt-5 flex items-center gap-2 text-xs text-foreground-muted">
                  <input type="checkbox" checked={draft.usedHints} onChange={(e) => updateDraft(p.slug, { usedHints: e.target.checked })} />
                  Used hints or outside help
                </label>
              </div>
            </div>
          );
        })}

        <Button onClick={handleFinish} disabled={isPending}>
          {isPending ? "Generating report…" : "Finish & Generate Report"}
        </Button>
      </CardContent>
    </Card>
  );
}
