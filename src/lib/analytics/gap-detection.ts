import { ANALYTICS_CONFIG } from "@/lib/analytics/config";
import { getPrerequisites } from "@/lib/analytics/skill-graph";
import type {
  ForwardLookingGap,
  GapVerdict,
  MasteryResult,
  RawMasteryResult,
  SkillGraphEdge,
  WeakPrerequisite,
} from "@/lib/analytics/types";

const SHAKY = ANALYTICS_CONFIG.skillGraph.shakyClassifications;
const SOLID_CLASSIFICATIONS = ["Strong", "Emerging", "Revision Needed"] as const;

/** Exported for reuse by src/lib/roadmap/roadmap-builder.ts, which needs the same
 *  "list a set of topic names in prose" formatting for its own explanation strings. */
export function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/** Prerequisites of `topicSlug` that themselves have evidence and are currently shaky. */
function findWeakPrerequisites(
  topicSlug: string,
  edges: SkillGraphEdge[],
  rawBySlug: Map<string, RawMasteryResult>
): WeakPrerequisite[] {
  const prereqEdges = getPrerequisites(edges, topicSlug);
  const weak: WeakPrerequisite[] = [];

  for (const edge of prereqEdges) {
    const prereqResult = rawBySlug.get(edge.prerequisiteSlug);
    if (prereqResult && (SHAKY as readonly string[]).includes(prereqResult.classification)) {
      weak.push({
        topicSlug: edge.prerequisiteSlug,
        topicName: edge.prerequisiteName,
        classification: prereqResult.classification,
        strength: edge.strength,
      });
    }
  }

  return weak;
}

function buildGapExplanation(
  topicName: string,
  verdict: GapVerdict,
  weakPrerequisites: WeakPrerequisite[]
): string {
  const names = joinNames(weakPrerequisites.map((p) => p.topicName));

  switch (verdict) {
    case "prerequisite-gap":
      return `${topicName} should not be your immediate priority because your ${names} fundamentals are still weak.`;
    case "genuinely-weak":
      return `This doesn't look like a prerequisite problem — ${topicName}'s tracked foundations are solid, so the weak spot is ${topicName} itself.`;
    case "insufficient-evidence":
      return weakPrerequisites.length > 0
        ? `Not enough evidence on ${topicName} yet — and its ${names} fundamentals are currently weak, so that's worth strengthening first.`
        : `Not enough evidence on ${topicName} yet to say anything about prerequisites.`;
    case "not-applicable":
      return `${topicName} isn't part of the tracked skill graph yet, so no prerequisite context is available.`;
    case "solid":
      return `No prerequisite concerns for ${topicName} right now.`;
  }
}

/**
 * Enriches Phase 3's raw per-topic scoring with a skill-graph-aware
 * read: is a Weak/Fundamental-Gap topic genuinely weak on its own,
 * or better explained by a shaky prerequisite? Also surfaces
 * forward-looking gaps for graph topics the user hasn't attempted
 * yet but whose prerequisites are already known to be weak.
 *
 * Pure — no DB, no network. `edges` is whatever the caller passes,
 * which is what makes this fully unit-testable with a small
 * synthetic graph (see gap-detection.test.ts) independent of the
 * real curated data in skill-graph-data.ts.
 */
export function detectGaps(
  rawResults: RawMasteryResult[],
  edges: SkillGraphEdge[]
): { mastery: MasteryResult[]; forwardLookingGaps: ForwardLookingGap[] } {
  const rawBySlug = new Map(rawResults.map((r) => [r.topicSlug, r]));

  const mastery: MasteryResult[] = rawResults.map((raw) => {
    const prereqEdges = getPrerequisites(edges, raw.topicSlug);
    const weakPrerequisites = findWeakPrerequisites(raw.topicSlug, edges, rawBySlug);

    let gapVerdict: GapVerdict;
    if ((SOLID_CLASSIFICATIONS as readonly string[]).includes(raw.classification)) {
      gapVerdict = "solid";
    } else if (raw.classification === "Under-Practiced") {
      gapVerdict = "insufficient-evidence";
    } else if (prereqEdges.length === 0) {
      gapVerdict = "not-applicable";
    } else if (weakPrerequisites.length > 0) {
      gapVerdict = "prerequisite-gap";
    } else {
      gapVerdict = "genuinely-weak";
    }

    return {
      ...raw,
      gapVerdict,
      gapExplanation: buildGapExplanation(raw.topicName, gapVerdict, weakPrerequisites),
      weakPrerequisites,
    };
  });

  // Forward-looking: graph topics the user has zero evidence for at
  // all, but which have an evidenced, weak prerequisite worth flagging.
  const unevidencedChildSlugs = new Set(
    edges.map((e) => e.topicSlug).filter((slug) => !rawBySlug.has(slug))
  );

  const forwardLookingGaps: ForwardLookingGap[] = [];
  for (const slug of unevidencedChildSlugs) {
    const weakPrerequisites = findWeakPrerequisites(slug, edges, rawBySlug);
    if (weakPrerequisites.length === 0) continue; // nothing useful to say — skip the noise

    const topicName = edges.find((e) => e.topicSlug === slug)!.topicName;
    forwardLookingGaps.push({
      topicSlug: slug,
      topicName,
      weakPrerequisites,
      explanation: buildGapExplanation(topicName, "insufficient-evidence", weakPrerequisites),
    });
  }

  return { mastery, forwardLookingGaps };
}
