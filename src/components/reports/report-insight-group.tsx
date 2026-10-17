import Link from "next/link";
import { AlertTriangle, ArrowRight, Target, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { InsightGroup, InsightRow, InsightSection, ScoreBar, Tone } from "@/lib/reports/report-view";
import type { ReportPeriodType } from "@/lib/reports/types";

// Full literal class strings throughout: Tailwind can't see names built at runtime.
const GROUP_STYLE: Record<InsightGroup["key"], { icon: LucideIcon; iconClass: string }> = {
  good: { icon: TrendingUp, iconClass: "text-success" },
  attention: { icon: AlertTriangle, iconClass: "text-warning" },
  next: { icon: Target, iconClass: "text-brand" },
};

const BADGE_TONE: Record<Tone, string> = {
  neutral: "bg-surface-muted text-foreground-muted",
  good: "bg-success-subtle text-success",
  warn: "bg-warning-subtle text-warning",
  bad: "bg-danger-subtle text-danger",
};

const BAR_FILL_TONE: Record<Tone, string> = {
  neutral: "bg-brand",
  good: "bg-success",
  warn: "bg-warning",
  bad: "bg-danger",
};

function pct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * A 0-100 score as a thin bar. With an earlier score, the part that
 * was already there is muted and the change is drawn in green (a
 * gain) or red (a drop); with no earlier score the whole bar is one
 * tone. Decorative: the row's text already states the numbers.
 */
function ScoreBarView({ bar, tone }: { bar: ScoreBar; tone: Tone }) {
  const to = pct(bar.to);

  if (bar.from === null) {
    return (
      <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
        <div className={`h-full rounded-full ${BAR_FILL_TONE[tone]}`} style={{ width: `${to}%` }} />
      </div>
    );
  }

  const from = pct(bar.from);
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  const gain = to >= from;

  return (
    <div aria-hidden="true" className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
      <div className="absolute inset-y-0 left-0 bg-foreground-muted/50" style={{ width: `${low}%` }} />
      <div className={`absolute inset-y-0 ${gain ? "bg-success" : "bg-danger"}`} style={{ left: `${low}%`, width: `${high - low}%` }} />
    </div>
  );
}

function InsightRowItem({ row, index, ordered }: { row: InsightRow; index: number; ordered: boolean }) {
  const tone = row.badgeTone ?? "neutral";

  return (
    <li className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {ordered && (
            <span aria-hidden="true" className="mt-px inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand">
              {index + 1}
            </span>
          )}
          <p className="min-w-0 text-sm font-medium text-foreground">{row.label}</p>
        </div>
        {row.badge && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONE[tone]}`}>{row.badge}</span>}
      </div>
      {row.detail && <p className={ordered ? "pl-7 text-xs text-foreground-muted" : "text-xs text-foreground-muted"}>{row.detail}</p>}
      {row.bar && <ScoreBarView bar={row.bar} tone={tone} />}
    </li>
  );
}

function SectionBlock({ section, ordered, showTitle }: { section: InsightSection; ordered: boolean; showTitle: boolean }) {
  const List = ordered ? "ol" : "ul";

  return (
    <div className="space-y-2">
      {showTitle && <h4 className="text-xs font-medium text-foreground-muted">{section.title}</h4>}

      {section.chips.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {section.chips.map((chip) => (
            <li key={chip} className="rounded-full border border-border bg-surface-muted px-2.5 py-0.5 text-xs text-foreground">
              {chip}
            </li>
          ))}
        </ul>
      )}

      {section.rows.length > 0 && (
        <List className="space-y-3">
          {section.rows.map((row, i) => (
            <InsightRowItem key={row.key} row={row} index={i} ordered={ordered} />
          ))}
        </List>
      )}
    </div>
  );
}

/**
 * One band of the report: "Going well", "Needs attention" or the
 * "Next" list. Every section inside has content (the view model
 * drops empty ones), so an empty band collapses to one muted line
 * instead of a stack of empty cards. The optional footer link is for
 * the parent to point somewhere useful, such as the Roadmap.
 */
export function ReportInsightGroup({ group, footerLink }: { group: InsightGroup; footerLink?: { href: string; label: string } }) {
  const style = GROUP_STYLE[group.key];
  const Icon = style.icon;

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${style.iconClass}`} aria-hidden="true" />
          <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
        </div>

        {group.sections.length === 0 ? (
          <p className="text-sm text-foreground-muted">{group.emptyMessage}</p>
        ) : (
          group.sections.map((section) => (
            <SectionBlock key={section.key} section={section} ordered={group.ordered} showTitle={group.key !== "next"} />
          ))
        )}

        {footerLink && (
          <Link
            href={footerLink.href}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {footerLink.label}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

/** Shown in place of the "Going well" and "Needs attention" pair when both are empty. */
export function ReportQuietCard({ periodType }: { periodType: ReportPeriodType }) {
  const word = periodType === "WEEKLY" ? "week" : "month";

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm font-medium text-foreground">A quiet {word}</p>
        <p className="mt-1 text-sm text-foreground-muted">
          Nothing stands out as going well or needing attention in this {word}. Keep solving and syncing, and future reports will have more to show.
        </p>
      </CardContent>
    </Card>
  );
}