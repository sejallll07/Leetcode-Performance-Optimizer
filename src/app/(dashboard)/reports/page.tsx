import type { Metadata } from "next";
import { getCurrentSession } from "@/lib/session";
import { getLeetCodeProfileByUserId } from "@/repositories/leetcode-repository";
import { getReport } from "@/services/reports/reports-service";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportView } from "@/components/reports/report-view";

export const metadata: Metadata = {
  title: "Reports \u2014 DSA Intelligence",
};

export default async function ReportsPage() {
  const session = await getCurrentSession();

  // getReport doesn't require the profile to already be resolved: it
  // reads mastery/submission data directly and degrades gracefully to
  // an empty report if there's none yet, so it is safe to run
  // alongside the profile lookup rather than waiting on it first.
  const [profile, initialReportResult] = session?.user
    ? await Promise.all([
        getLeetCodeProfileByUserId(session.user.id),
        getReport(session.user.id, "WEEKLY", 0),
      ])
    : [null, null];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          What changed this week or this month, from your own solves and revisions. Page back through past periods any time.
        </p>
      </div>

      {!profile && (
        <Card>
          <CardHeader>
            <CardTitle>Connect your LeetCode profile first</CardTitle>
            <CardDescription>
              Reports are built from your solved-problem and revision history. Head to the dashboard to connect your profile and sync before there is anything to report on.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {profile && (!initialReportResult || !initialReportResult.ok) && (
        <Card>
          <CardHeader>
            <CardTitle>Reports not available yet</CardTitle>
            <CardDescription>
              {initialReportResult && !initialReportResult.ok
                ? initialReportResult.error
                : "Try syncing from the dashboard first."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {profile && initialReportResult?.ok && (
        <ReportView initialReport={initialReportResult.report} />
      )}
    </div>
  );
}