import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCurrentSession } from "@/lib/session";
import { getLeetCodeProfileByUserId } from "@/repositories/leetcode-repository";
import { getRevisionCenterData } from "@/services/revision/revision-service";
import { buildRevisionView } from "@/lib/revision/revision-view";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CompletedList, UpcomingList } from "@/components/revision/revision-collapsed-list";
import { RevisionQueue } from "@/components/revision/revision-queue";
import { RevisionSummaryStrip } from "@/components/revision/revision-summary";

export const metadata: Metadata = {
  title: "Revision Center — DSA Intelligence",
};

export default async function RevisionPage() {
  const session = await getCurrentSession();
  const now = new Date();

  // Independent reads — previously sequential.
  const [profile, data] = session?.user
    ? await Promise.all([
        getLeetCodeProfileByUserId(session.user.id),
        getRevisionCenterData(session.user.id, now),
      ])
    : [null, null];

  const hasAnyItems =
    !!data &&
    data.overdue.totalCount +
      data.dueToday.totalCount +
      data.upcoming.totalCount +
      data.recentlyCompleted.totalCount >
      0;

  // Pure presentation of what the categorizer already decided — no
  // scheduling or classification happens here.
  const view = data && hasAnyItems ? buildRevisionView(data, now) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Revision Center</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Review what you&apos;ve solved before it fades — each rating sets when you&apos;ll see it next.
          </p>
        </div>
        <Link
          href="/roadmap"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          See your Roadmap
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      {!profile && (
        <Card>
          <CardHeader>
            <CardTitle>Connect your LeetCode profile first</CardTitle>
            <CardDescription>
              The Revision Center schedules revisits for problems you&apos;ve
              solved — head to the dashboard to connect your profile and sync.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {profile && data && !hasAnyItems && (
        <Card>
          <CardHeader>
            <CardTitle>Nothing scheduled yet</CardTitle>
            <CardDescription>
              Once you&apos;ve solved a few problems and synced, they&apos;ll
              show up here on a revision schedule — starting 3 days after you
              first solve them.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {profile && view && (
        <>
          <RevisionQueue queue={view.queue} nextUp={view.summary.nextUp} />
          <RevisionSummaryStrip summary={view.summary} />
          <div className="space-y-3">
            <UpcomingList rows={view.upcoming.rows} total={view.upcoming.total} />
            <CompletedList
              rows={view.completed.rows}
              total={view.completed.total}
              windowDays={view.completed.windowDays}
            />
          </div>
        </>
      )}
    </div>
  );
}