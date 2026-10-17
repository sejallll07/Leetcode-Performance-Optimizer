import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { getCurrentSession } from "@/lib/session";
import { getLeetCodeProfileByUserId } from "@/repositories/leetcode-repository";
import { getDashboardData } from "@/services/analytics/analytics-service";
import { getRevisionCenterData } from "@/services/revision/revision-service";
import { isSyncStale } from "@/lib/leetcode/config";
import { classificationBadgeVariant } from "@/lib/dashboard-format";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LeetCodeConnectForm } from "@/components/dashboard/leetcode-connect-form";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { DashboardFocusToday } from "@/components/dashboard/dashboard-focus-today";
import { TopicBreakdown, type TopicBreakdownItem } from "@/components/dashboard/topic-breakdown";

export const metadata: Metadata = { title: "Dashboard — DSA Intelligence" };

export default async function DashboardPage() {
  const session = await getCurrentSession();
  const firstName = session?.user?.name?.split(" ")[0];

  // Independent reads, keyed only on userId — previously awaited one
  // after another, which serializes 3 round trips into one long wait
  // instead of overlapping them.
  const [profile, dashboardData, revisionData] = session?.user
    ? await Promise.all([
        getLeetCodeProfileByUserId(session.user.id),
        getDashboardData(session.user.id),
        getRevisionCenterData(session.user.id),
      ])
    : [null, null, null];

  const revisionDueCount = (revisionData?.overdue.totalCount ?? 0) + (revisionData?.dueToday.totalCount ?? 0);
  const shouldAutoSync = profile ? profile.syncStatus !== "SYNCING" && isSyncStale(profile.lastSyncedAt) : false;

  const hasAnalyzedTopics = (dashboardData?.mastery.length ?? 0) > 0;

  const strongItems: TopicBreakdownItem[] = (dashboardData?.mastery ?? [])
    .filter((m) => m.classification === "Strong")
    .sort((a, b) => b.masteryScore - a.masteryScore)
    .map((m) => ({
      topicSlug: m.topicSlug,
      topicName: m.topicName,
      masteryScore: m.masteryScore,
      badgeLabel: m.classification,
      badgeVariant: classificationBadgeVariant(m.classification),
      explanation: m.explanation,
    }));

  const weakItems: TopicBreakdownItem[] = (dashboardData?.mastery ?? [])
    .filter((m) => m.classification === "Weak" || m.classification === "Fundamental Gap")
    .sort((a, b) => a.masteryScore - b.masteryScore)
    .map((m) => ({
      topicSlug: m.topicSlug,
      topicName: m.topicName,
      masteryScore: m.masteryScore,
      badgeLabel: m.classification,
      badgeVariant: classificationBadgeVariant(m.classification),
      explanation: m.explanation,
    }));

  const revisionItems: TopicBreakdownItem[] = (dashboardData?.mastery ?? [])
    .filter((m) => m.classification === "Revision Needed")
    .sort((a, b) => a.masteryScore - b.masteryScore)
    .map((m) => ({
      topicSlug: m.topicSlug,
      topicName: m.topicName,
      masteryScore: m.masteryScore,
      badgeLabel: m.classification,
      badgeVariant: classificationBadgeVariant(m.classification),
      explanation: m.explanation,
    }));

  const prerequisiteGaps = (dashboardData?.mastery ?? []).filter((m) => m.gapVerdict === "prerequisite-gap");
  const fundamentalsItems: TopicBreakdownItem[] = [
    ...prerequisiteGaps.map((m): TopicBreakdownItem => ({
      topicSlug: m.topicSlug,
      topicName: m.topicName,
      masteryScore: m.masteryScore,
      badgeLabel: "Prerequisite gap",
      badgeVariant: "danger",
      explanation: m.gapExplanation,
    })),
    ...(dashboardData?.forwardLookingGaps ?? []).map((g): TopicBreakdownItem => ({
      topicSlug: g.topicSlug,
      topicName: g.topicName,
      masteryScore: null,
      badgeLabel: "Not started",
      badgeVariant: "neutral",
      explanation: g.explanation,
    })),
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {firstName ? `Welcome, ${firstName}` : "Welcome"}
        </h1>
        {!profile && (
          <p className="mt-1 text-foreground-muted">
            Connect your LeetCode profile to get started — your dashboard will appear here once it&apos;s synced.
          </p>
        )}
      </div>

      {!profile && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-brand" />
              Connect your LeetCode profile
            </CardTitle>
            <CardDescription>
              We only read what&apos;s public on your profile — your solved counts,
              ranking, and recent accepted submissions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LeetCodeConnectForm />
          </CardContent>
        </Card>
      )}

      {profile && (
        <DashboardHero
          profile={profile}
          autoSync={shouldAutoSync}
          readiness={hasAnalyzedTopics ? dashboardData!.readiness : null}
          progressTrend={hasAnalyzedTopics ? dashboardData!.progressTrend : null}
          basic={hasAnalyzedTopics ? dashboardData!.basic : null}
        />
      )}

      {profile && dashboardData && hasAnalyzedTopics && (
        <>
          <DashboardFocusToday actions={dashboardData.nextActions} recommendations={dashboardData.recommendations} />

          <TopicBreakdown strong={strongItems} weak={weakItems} revision={revisionItems} fundamentals={fundamentalsItems} />

          {revisionData && (
            <Card>
              <CardHeader>
                <CardTitle>Revision Center</CardTitle>
                <CardDescription>
                  Problem-level spaced repetition — every problem you&apos;ve solved gets its own
                  revisit schedule, separate from the topic-level view above.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <p className="text-sm text-foreground-muted">
                  {revisionDueCount > 0
                    ? `${revisionDueCount} problem${revisionDueCount === 1 ? "" : "s"} due for revision right now.`
                    : "Nothing due right now — you're caught up."}
                </p>
                <Button href="/revision" variant="secondary" size="sm">
                  Open Revision Center
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {profile && dashboardData && !hasAnalyzedTopics && (
        <Card>
          <CardHeader>
            <CardTitle>You&apos;re connected</CardTitle>
            <CardDescription>
              Once you&apos;ve solved a few problems on LeetCode and synced again, your dashboard
              will show exactly how you&apos;re doing — no guessing from thin evidence.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}