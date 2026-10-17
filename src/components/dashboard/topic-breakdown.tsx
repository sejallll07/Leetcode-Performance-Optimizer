"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BadgeVariant } from "@/lib/dashboard-format";

export type TopicBreakdownItem = {
  topicSlug: string;
  topicName: string;
  /** Null for zero-evidence "not started" topics (Fundamentals tab's forward-looking gaps) — there's no score to show a bar for, so the row omits one entirely rather than showing a fake 0. */
  masteryScore: number | null;
  badgeLabel: string;
  badgeVariant: BadgeVariant;
  explanation: string;
};

type TabKey = "strong" | "weak" | "revision" | "fundamentals";

const TABS: { key: TabKey; label: string; emptyMessage: string }[] = [
  { key: "strong", label: "Strong", emptyMessage: "Nothing's reached Strong yet — keep practicing and syncing." },
  { key: "weak", label: "Weak", emptyMessage: "No clearly weak topics right now." },
  { key: "revision", label: "Revision", emptyMessage: "Nothing due for revision right now." },
  { key: "fundamentals", label: "Fundamentals", emptyMessage: "No prerequisite-driven gaps detected right now." },
];

const BAR_VARIANT_CLASS: Record<BadgeVariant, string> = {
  neutral: "bg-foreground-muted",
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

/** Local, unexported — see the file-level note in the proposal for why this isn't a shared ui/ primitive yet. */
function MasteryBar({ value, variant, className }: { value: number; variant: BadgeVariant; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-muted", className)}>
      <div className={cn("h-full rounded-full", BAR_VARIANT_CLASS[variant])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function TopicRow({ item }: { item: TopicBreakdownItem }) {
  return (
    <details className="group rounded-md border border-border px-3 py-2.5 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-foreground">{item.topicName}</span>
            <div className="flex shrink-0 items-center gap-2">
              {item.masteryScore !== null && <span className="text-xs text-foreground-muted">{item.masteryScore}/100</span>}
              <Badge variant={item.badgeVariant}>{item.badgeLabel}</Badge>
            </div>
          </div>
          {item.masteryScore !== null && <MasteryBar value={item.masteryScore} variant={item.badgeVariant} className="mt-1.5" />}
        </div>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-foreground-muted transition-transform group-open:rotate-180" />
      </summary>
      <p className="mt-2 text-xs text-foreground-muted">{item.explanation}</p>
    </details>
  );
}

/**
 * One tab bar + one row list instead of four stacked Cards. Click a
 * row to expand its explanation (progressive disclosure, native
 * <details> — no extra state needed per row) instead of printing it
 * under every topic by default. Tab bar scrolls horizontally below
 * `sm` rather than wrapping or crushing — see the header's
 * flex-col/sm:flex-row switch below, which only affects layout under
 * `sm`; from `sm` up it's the same side-by-side header as before.
 */
export function TopicBreakdown({
  strong,
  weak,
  revision,
  fundamentals,
}: {
  strong: TopicBreakdownItem[];
  weak: TopicBreakdownItem[];
  revision: TopicBreakdownItem[];
  fundamentals: TopicBreakdownItem[];
}) {
  const [active, setActive] = useState<TabKey>("strong");

  const itemsByTab: Record<TabKey, TopicBreakdownItem[]> = { strong, weak, revision, fundamentals };
  const activeTab = TABS.find((t) => t.key === active)!;
  const activeItems = itemsByTab[active];

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Topic Breakdown</CardTitle>
        <div className="min-w-0 flex gap-1 overflow-x-auto rounded-md bg-surface-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                active === tab.key ? "bg-brand text-brand-foreground" : "text-foreground-muted hover:text-foreground"
              )}
            >
              {tab.label} ({itemsByTab[tab.key].length})
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {activeItems.length === 0 ? (
          <p className="text-sm text-foreground-muted">{activeTab.emptyMessage}</p>
        ) : (
          <div className="space-y-2">
            {activeItems.map((item) => (
              <TopicRow key={item.topicSlug} item={item} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}