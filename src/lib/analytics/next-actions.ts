import { ANALYTICS_CONFIG } from "@/lib/analytics/config";
import type { ForwardLookingGap, MasteryResult, NextAction } from "@/lib/analytics/types";

const { maxItems } = ANALYTICS_CONFIG.nextActions;

/**
 * Topic-level "what should I do next" guidance — never specific
 * LeetCode problems (that's the separate, not-yet-built
 * recommendation engine). Every item's `reason` is lifted directly
 * from an existing, already-computed explanation string, so nothing
 * here says anything the rest of the engine hasn't already
 * justified. Priority order: real gaps with an identified root
 * cause first, then plain gaps, then preventive/forward-looking
 * advice, then staleness, then everything else.
 */
export function computeNextActions(
  mastery: MasteryResult[],
  forwardLookingGaps: ForwardLookingGap[]
): NextAction[] {
  const actions: (NextAction & { priority: number })[] = [];

  for (const m of mastery) {
    if (m.gapVerdict === "prerequisite-gap") {
      const weakest = [...m.weakPrerequisites].sort((a, b) => b.strength - a.strength)[0];
      actions.push({
        kind: "prerequisite-gap",
        topicSlug: m.topicSlug,
        topicName: m.topicName,
        title: `Shore up ${weakest.topicName} before more ${m.topicName}`,
        reason: m.gapExplanation,
        priority: m.classification === "Fundamental Gap" ? 0 : 1,
      });
    } else if (m.classification === "Fundamental Gap") {
      actions.push({
        kind: "fundamental-gap",
        topicSlug: m.topicSlug,
        topicName: m.topicName,
        title: `Practice ${m.topicName} directly`,
        reason: m.explanation,
        priority: 3,
      });
    } else if (m.classification === "Revision Needed") {
      actions.push({
        kind: "revision",
        topicSlug: m.topicSlug,
        topicName: m.topicName,
        title: `Revisit ${m.topicName}`,
        reason: m.explanation,
        priority: 4,
      });
    } else if (m.classification === "Weak") {
      actions.push({
        kind: "weak-topic",
        topicSlug: m.topicSlug,
        topicName: m.topicName,
        title: `Build up ${m.topicName}`,
        reason: m.explanation,
        priority: 5,
      });
    }
  }

  for (const gap of forwardLookingGaps) {
    actions.push({
      kind: "forward-looking-gap",
      topicSlug: gap.topicSlug,
      topicName: gap.topicName,
      title: `Hold off on ${gap.topicName} for now`,
      reason: gap.explanation,
      priority: 2,
    });
  }

  return actions
    .sort((a, b) => a.priority - b.priority)
    .slice(0, maxItems)
    .map((action) => ({
      kind: action.kind,
      topicSlug: action.topicSlug,
      topicName: action.topicName,
      title: action.title,
      reason: action.reason,
    }));
}
