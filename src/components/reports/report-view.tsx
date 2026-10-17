"use client";

import { useState, useTransition } from "react";
import { getReportAction } from "@/actions/reports";
import { Card, CardContent } from "@/components/ui/card";
import { ReportInsightGroup, ReportQuietCard } from "@/components/reports/report-insight-group";
import { ReportPeriodBar } from "@/components/reports/report-period-bar";
import { ReportStatStrip } from "@/components/reports/report-stat-strip";
import { ReportSummaryCard } from "@/components/reports/report-summary-card";
import { buildReportView } from "@/lib/reports/report-view";
import type { ReportPeriodType, ReportResult } from "@/lib/reports/types";

const ROADMAP_LINK = { href: "/roadmap", label: "See your Roadmap" };

/**
 * The Reports page body. This file only owns the state that changes
 * (which period, which offset, the loaded report) and the fetch;
 * what to show is decided by the pure view model in
 * lib/reports/report-view.ts, and how it looks lives in the small
 * components it composes. While a new period loads, the content
 * dims and is marked busy so the page never looks frozen.
 */
export function ReportView({ initialReport }: { initialReport: ReportResult }) {
  const [report, setReport] = useState<ReportResult>(initialReport);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function load(periodType: ReportPeriodType, nextOffset: number) {
    startTransition(async () => {
      const result = await getReportAction(periodType, nextOffset);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setReport(result.report);
      setOffset(nextOffset);
    });
  }

  const view = buildReportView(report);
  const [good, attention, next] = view.groups;

  return (
    <div className="space-y-4" aria-busy={isPending}>
      <ReportPeriodBar
        periodType={view.periodType}
        periodLabel={view.periodLabel}
        isCurrent={view.isCurrent}
        offset={offset}
        isPending={isPending}
        onSelectType={(type) => {
          // Already looking at the current period of this type: nothing to load.
          if (type === view.periodType && offset === 0) return;
          load(type, 0);
        }}
        onPrevious={() => load(view.periodType, offset + 1)}
        onNext={() => load(view.periodType, offset - 1)}
      />

      {error && (
        <Card>
          <CardContent className="p-4">
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          </CardContent>
        </Card>
      )}

      <div className={`space-y-4 transition-opacity ${isPending ? "opacity-60" : "opacity-100"}`}>
        <ReportSummaryCard periodType={view.periodType} summary={view.summary} narrativeError={view.narrativeError} />
        <ReportStatStrip tiles={view.tiles} />

        {view.isQuiet ? (
          <ReportQuietCard periodType={view.periodType} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <ReportInsightGroup group={good} />
            <ReportInsightGroup group={attention} />
          </div>
        )}

        <ReportInsightGroup group={next} footerLink={ROADMAP_LINK} />
      </div>
    </div>
  );
}