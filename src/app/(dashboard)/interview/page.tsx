import type { Metadata } from "next";
import { getCurrentSession } from "@/lib/session";
import { getLeetCodeProfileByUserId } from "@/repositories/leetcode-repository";
import {
  getInterviewReadiness,
  listRecentMockInterviews,
} from "@/services/interview/interview-service";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReadinessCard } from "@/components/interview/readiness-card";
import { MockInterviewFlow } from "@/components/interview/mock-interview-flow";

export const metadata: Metadata = {
  title: "Interview Prep — DSA Intelligence",
};

export default async function InterviewPage() {
  const session = await getCurrentSession();

  // All three are independent reads keyed only on userId — both
  // getInterviewReadiness and listRecentMockInterviews already
  // handle "no profile yet" gracefully on their own, so none of them
  // need to wait on the profile lookup finishing first.
  const [profile, readinessResult, recentSessions] = session?.user
    ? await Promise.all([
        getLeetCodeProfileByUserId(session.user.id),
        getInterviewReadiness(session.user.id),
        listRecentMockInterviews(session.user.id, 1),
      ])
    : [null, null, []];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Interview Prep
        </h1>
        <p className="mt-1 text-foreground-muted">
          An interview-specific readiness read, plus a personalized 3-problem
          mock interview you self-report on.
        </p>
      </div>

      {!profile && (
        <Card>
          <CardHeader>
            <CardTitle>Connect your LeetCode profile first</CardTitle>
            <CardDescription>
              Interview readiness and mock interview problem selection are both
              built from your own solved-problem history — connect and sync from
              the dashboard first.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {profile && readinessResult && !readinessResult.ok && (
        <Card>
          <CardHeader>
            <CardTitle>Not enough data yet</CardTitle>
            <CardDescription>{readinessResult.error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {profile && readinessResult?.ok && (
        <ReadinessCard readiness={readinessResult.readiness} />
      )}

      {profile && readinessResult?.ok && (
        <MockInterviewFlow
          initialSession={recentSessions[0] ?? null}
        />
      )}
    </div>
  );
}