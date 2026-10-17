import { REVISION_CONFIG } from "@/lib/revision/config";

const INTERVAL_LABELS = ["3 days", "1 week", "2 weeks", "1 month", "2 months"];

export function intervalLabel(intervalIndex: number): string {
  return INTERVAL_LABELS[intervalIndex] ?? `${REVISION_CONFIG.intervalsDays[intervalIndex]} days`;
}
