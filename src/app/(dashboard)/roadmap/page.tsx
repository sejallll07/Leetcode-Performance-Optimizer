import type { Metadata } from "next";
import { getCurrentSession } from "@/lib/session";
import { getLeetCodeProfileByUserId } from "@/repositories/leetcode-repository";
import { getRoadmapPageData } from "@/services/roadmap/roadmap-service";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RoadmapExplorer } from "@/components/roadmap/roadmap-explorer";
import { buildTopicGuidance, pickFocus } from "@/lib/roadmap/roadmap-guidance";
import { buildTopicIndex } from "@/lib/roadmap/roadmap-view";

export const metadata: Metadata = {
  title: "Roadmap — DSA Intelligence",
};

export default async function RoadmapPage() {
  const session = await getCurrentSession();

  // getRoadmapPageData returns null gracefully when there's no connected
  // profile (same as the profile lookup) — safe to run both at once
  // rather than gating the second on the first finishing.
  const now = new Date();
  const [profile, pageData] = session?.user
    ? await Promise.all([
        getLeetCodeProfileByUserId(session.user.id),
        getRoadmapPageData(session.user.id, now),
      ])
    : [null, null];

  // Everything below is pure derivation from what the engine, the
  // recommendation engine and the revision system already produced —
  // no scoring, classification or scheduling happens in the page.
  const topics = pageData?.roadmap.topics ?? [];
  const focus = pageData
    ? pickFocus(pageData.nextActions, pageData.roadmap.recommendedNextTopic, buildTopicIndex(topics))
    : null;
  const guidanceBySlug = pageData
    ? buildTopicGuidance({
        topics,
        recommendations: pageData.recommendations.all,
        catalog: pageData.catalog,
        solvedProblemSlugs: pageData.solvedProblemSlugs,
        revisionItems: pageData.revisionItems,
        now,
      })
    : {};

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Personalized Roadmap</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Where you are, what to do next, and why — built from your own solved problems.
        </p>
      </div>

      {!profile && (
        <Card>
          <CardHeader>
            <CardTitle>Connect your LeetCode profile first</CardTitle>
            <CardDescription>
              The roadmap is built entirely from your own solved-problem
              evidence — head to the dashboard to connect your profile and
              sync before there&apos;s anything to build it from.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {profile && !pageData && (
        <Card>
          <CardHeader>
            <CardTitle>Roadmap not available yet</CardTitle>
            <CardDescription>
              Your profile is connected but we couldn&apos;t load a roadmap for
              it — try syncing from the dashboard first.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {profile && pageData && (
        <RoadmapExplorer topics={topics} focus={focus} guidanceBySlug={guidanceBySlug} />
      )}
    </div>
  );
}