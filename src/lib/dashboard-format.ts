import type { TopicClassification } from "@/lib/analytics/types";
import type { RoadmapStatus } from "@/lib/roadmap/types";

export type BadgeVariant = "neutral" | "brand" | "success" | "warning" | "danger";

/** Consistent classification -> badge color across every dashboard card. */
export function classificationBadgeVariant(classification: TopicClassification): BadgeVariant {
  switch (classification) {
    case "Strong":
      return "success";
    case "Emerging":
      return "brand";
    case "Revision Needed":
      return "warning";
    case "Weak":
      return "warning";
    case "Fundamental Gap":
      return "danger";
    case "Under-Practiced":
      return "neutral";
  }
}

/** Same idea as classificationBadgeVariant, extended for the roadmap's two zero-evidence statuses (Phase 8). */
export function roadmapStatusBadgeVariant(status: RoadmapStatus): BadgeVariant {
  if (status === "Recommended Next") return "brand";
  if (status === "Postponed") return "neutral";
  return classificationBadgeVariant(status);
}
