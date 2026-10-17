"use client";

import { useEffect, useRef } from "react";
import { ExternalLink, History, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { RadialProgress } from "@/components/ui/radial-progress";
import { DifficultyBar } from "@/components/dashboard/difficulty-bar";
import { Badge } from "@/components/ui/badge";
import { SyncButton } from "@/components/dashboard/sync-button";
import { useSyncProfile } from "@/components/dashboard/use-sync-profile";
import { formatRelativeTime, cn } from "@/lib/utils";
import type { LeetCodeProfileRow } from "@/repositories/leetcode-repository";
import type { BasicAnalytics, ProgressTrend, ReadinessResult } from "@/lib/analytics/types";

const SYNC_STATUS_BADGE: Record<LeetCodeProfileRow["syncStatus"], { variant: "success" | "danger" | "brand" | "neutral"; label: (p: LeetCodeProfileRow) => string }> = {
  SUCCESS: { variant: "success", label: (p) => (p.lastSyncedAt ? `Synced ${formatRelativeTime(new Date(p.lastSyncedAt))}` : "Synced") },
  ERROR: { variant: "danger", label: () => "Sync failed" },
  SYNCING: { variant: "brand", label: () => "Syncing..." },
  NEVER_SYNCED: { variant: "neutral", label: () => "Not synced yet" },
};

const TREND_STYLE: Record<ProgressTrend["status"], { icon: typeof TrendingUp; className: string }> = {
  improving: { icon: TrendingUp, className: "text-success" },
  declining: { icon: TrendingDown, className: "text-danger" },
  steady: { icon: Minus, className: "text-foreground-muted" },
  "not-enough-history": { icon: History, className: "text-foreground-muted" },
};

/** Score-based, not level-string-based — stays correct even if the level labels themselves are ever reworded, since the bands are defined against the one number that can't change meaning. */
function readinessVariant(score: number): "warning" | "brand" | "success" {
  if (score < 50) return "warning";
  if (score < 75) return "brand";
  return "success";
}

/**
 * Replaces LeetCodeProfileCard + ReadinessHeader + QuickStatsRow as
 * one unit — those three previously rendered the same Total/Easy/
 * Medium/Hard numbers in two separate places (LeetCodeProfileCard's
 * own grid and QuickStatsRow). Here there's exactly one DifficultyBar,
 * fed from `profile`'s own solved counts (which exist the moment a
 * profile is connected, independent of whether analytics have run
 * yet) — not from `basic`, which is null until there's real evidence
 * to analyze. That's what lets this component render sensibly in
 * both states without duplicating data sources.
 */
export function DashboardHero({
  profile,
  autoSync,
  readiness,
  progressTrend,
  basic,
}: {
  profile: LeetCodeProfileRow;
  autoSync: boolean;
  readiness: ReadinessResult | null;
  progressTrend: ProgressTrend | null;
  basic: BasicAnalytics | null;
}) {
  const { trigger, isPending, error } = useSyncProfile();
  const firedRef = useRef(false);

  useEffect(() => {
    if (autoSync && !firedRef.current) {
      firedRef.current = true;
      trigger();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSync]);

  const status = isPending ? { variant: "brand" as const, label: () => "Refreshing..." } : SYNC_STATUS_BADGE[profile.syncStatus];
  const trend = progressTrend ? TREND_STYLE[progressTrend.status] : null;
  const TrendIcon = trend?.icon;

  return (
    <div className="relative overflow-hidden rounded-md border border-border bg-surface p-6 shadow-sm">
      {/* The one glow on this page — soft, low-opacity, behind the ring only. */}
      {readiness && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -left-8 -top-8 h-48 w-48 rounded-full opacity-20 blur-3xl",
            readinessVariant(readiness.score) === "success" && "bg-success",
            readinessVariant(readiness.score) === "brand" && "bg-brand",
            readinessVariant(readiness.score) === "warning" && "bg-warning"
          )}
        />
      )}

      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <a
          href={`https://leetcode.com/u/${profile.leetcodeUsername}/`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
        >
          {profile.leetcodeUsername}
          <ExternalLink className="h-3.5 w-3.5 text-foreground-muted" />
        </a>
        <div className="flex items-center gap-2">
          {profile.ranking && <span className="text-sm text-foreground-muted">Rank #{profile.ranking.toLocaleString()}</span>}
          <Badge variant={status.variant}>{status.label(profile)}</Badge>
          <SyncButton onClick={trigger} isPending={isPending} />
        </div>
      </div>

      {(error || (profile.syncStatus === "ERROR" && profile.lastSyncError && !isPending)) && (
        <div className="relative mt-3 rounded-md border border-danger/30 bg-danger-subtle p-3 text-sm text-danger">
          {error ?? profile.lastSyncError}
        </div>
      )}

      <div className="relative mt-5 flex flex-col gap-6 sm:flex-row sm:items-center">
        {readiness ? (
          <RadialProgress value={readiness.score} size={112} strokeWidth={9} variant={readinessVariant(readiness.score)} className="shrink-0">
            <div className="text-center">
              <div className="text-3xl font-semibold text-foreground">{readiness.score}</div>
              <div className="text-[11px] text-foreground-muted">/ 100</div>
            </div>
          </RadialProgress>
        ) : (
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-center text-xs text-foreground-muted">
            Not enough data yet
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-4">
          {readiness && progressTrend && TrendIcon && (
            <div>
              <p className="font-semibold text-foreground">{readiness.level}</p>
              <p className={cn("mt-0.5 flex items-center gap-1.5 text-sm", trend?.className)}>
                <TrendIcon className="h-3.5 w-3.5 shrink-0" />
                {progressTrend.explanation}
              </p>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs text-foreground-muted">{profile.totalSolved} solved</p>
            <DifficultyBar easy={profile.easySolved} medium={profile.mediumSolved} hard={profile.hardSolved} className="max-w-sm" />
          </div>

          {basic && (
            <p className="text-xs text-foreground-muted">
              {basic.recentActivity.submissionsLast7Days} submission{basic.recentActivity.submissionsLast7Days === 1 ? "" : "s"} in the last 7 days
              {basic.sampleCoverage === "partial" && ` · based on your most recent ${basic.submissionStats.acceptedSubmissionsSampled} accepted submissions`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}