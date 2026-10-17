import type { StatTile, Tone } from "@/lib/reports/report-view";

// Full literal class strings: Tailwind can't see names built at runtime.
const VALUE_TONE: Record<Tone, string> = {
  neutral: "text-foreground",
  good: "text-success",
  warn: "text-warning",
  bad: "text-danger",
};

const BORDER_TONE: Record<Tone, string> = {
  neutral: "border-border",
  good: "border-success/30",
  warn: "border-warning/40",
  bad: "border-danger/40",
};

/**
 * The four headline numbers for a report. Two across on a phone,
 * four across on a wide screen. Colour carries meaning here: a tile
 * is only tinted when its tone says something (overdue work, a
 * readiness change); plain counts stay neutral so the eye goes to
 * the tiles that matter.
 */
export function ReportStatStrip({ tiles }: { tiles: StatTile[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.key} className={`min-w-0 rounded-lg border bg-surface px-3 py-2.5 ${BORDER_TONE[tile.tone]}`}>
          <dt className="text-xs text-foreground-muted">{tile.label}</dt>
          <dd className={`mt-1 text-xl font-semibold ${VALUE_TONE[tile.tone]}`}>{tile.value}</dd>
          {tile.note && <dd className="mt-0.5 text-xs text-foreground-muted">{tile.note}</dd>}
        </div>
      ))}
    </dl>
  );
}