import type { NextAction, ProblemCatalogEntry, Recommendation } from "@/lib/analytics/types";
import { categorizeRevisionItems } from "@/lib/revision/revision-categorizer";
import type { RevisionItemState } from "@/lib/revision/types";
import { leetcodeProblemUrl, selectNewPractice, type NewPracticeResult } from "@/lib/roadmap/new-practice";
import { PRACTICE_POOL } from "@/lib/roadmap/practice-pool-data";
import type { RoadmapTopic } from "@/lib/roadmap/types";

// Re-exported so existing imports of it from this module keep working.
export { leetcodeProblemUrl };

/**
 * "What should I do?" helpers for the Roadmap: the single focus
 * step, and per-topic practice and revision guidance.
 *
 * Pure and I/O-free, and deliberately thin: every decision here
 * already exists somewhere else in the app. The focus comes from the
 * engine's own prioritized `nextActions` (the same list the Dashboard
 * uses), "due" revision counts come from the existing
 * `categorizeRevisionItems`, and new practice problems come from the
 * separate selector in new-practice.ts, which leads with the engine's
 * own fresh picks and fills the rest from the catalog and the
 * supplemental pool.
 *
 * The two kinds of problem on a topic are kept strictly apart: NEW
 * practice (not found in the student's synced solve history) and
 * REVISION (already solved, due for review).
 */

// ---------------------------------------------------------------------
// The focus: "what should I do next, and why"
// ---------------------------------------------------------------------

export type FocusKind = "prerequisite" | "gap" | "revise" | "strengthen" | "start";

export type RoadmapFocus = {
  kind: FocusKind;
  /** The topic to work on right now — for a prerequisite action, the prerequisite itself, not the topic it's blocking. */
  topic: RoadmapTopic;
  /** Short student-facing label for what kind of work this is. */
  actionLabel: string;
  /** The engine's own headline, e.g. "Shore up Array before more Two Pointers". */
  title: string;
  /** The engine's own explanation for it — nothing written here. */
  reason: string;
  /** For a prerequisite action: the topic that's being held back by it. */
  forTopic: RoadmapTopic | null;
};

const ACTION_LABEL: Record<FocusKind, string> = {
  prerequisite: "Work on a prerequisite first",
  gap: "Fix a fundamental gap",
  revise: "Revise",
  strengthen: "Strengthen",
  start: "Start something new",
};

/**
 * For "prerequisite-gap" and "forward-looking-gap" actions the action
 * is about the dependent topic, but the work to do is on its weak
 * prerequisite. The engine names the one it means in the title
 * ("Shore up {prerequisite} before more {topic}"), so match that
 * exactly; if the wording ever changes and nothing matches, fall back
 * to the topic's first weak prerequisite rather than guess further.
 */
function findWeakPrerequisite(
  dependent: RoadmapTopic,
  action: NextAction,
  topicsBySlug: Map<string, RoadmapTopic>
): RoadmapTopic | null {
  const weak = dependent.prerequisites.filter((p) => p.isWeak);
  if (weak.length === 0) return null;
  const named = weak.find((p) => action.title === `Shore up ${p.topicName} before more ${dependent.topicName}`);
  return topicsBySlug.get((named ?? weak[0]).topicSlug) ?? null;
}

/**
 * The one thing to do next. Walks the engine's prioritized
 * `nextActions` (gaps with a root cause first, then plain gaps, then
 * "hold off", then staleness, then weak topics — the same order the
 * Dashboard shows) and takes the first it can resolve to a topic on
 * the roadmap. With nothing urgent, falls back to the roadmap's
 * "start something new" pick; with neither, returns null.
 */
export function pickFocus(
  nextActions: NextAction[],
  recommendedNextTopic: RoadmapTopic | null,
  topicsBySlug: Map<string, RoadmapTopic>
): RoadmapFocus | null {
  for (const action of nextActions) {
    const actionTopic = topicsBySlug.get(action.topicSlug);
    if (!actionTopic) continue;

    if (action.kind === "prerequisite-gap" || action.kind === "forward-looking-gap") {
      const prerequisite = findWeakPrerequisite(actionTopic, action, topicsBySlug);
      if (!prerequisite) continue;
      return {
        kind: "prerequisite",
        topic: prerequisite,
        actionLabel: ACTION_LABEL.prerequisite,
        title: action.title,
        reason: action.reason,
        forTopic: actionTopic,
      };
    }

    const kind: FocusKind =
      action.kind === "fundamental-gap" ? "gap" : action.kind === "revision" ? "revise" : "strengthen";
    return { kind, topic: actionTopic, actionLabel: ACTION_LABEL[kind], title: action.title, reason: action.reason, forTopic: null };
  }

  if (recommendedNextTopic) {
    return {
      kind: "start",
      topic: recommendedNextTopic,
      actionLabel: ACTION_LABEL.start,
      title: `Start ${recommendedNextTopic.topicName}`,
      reason: recommendedNextTopic.actionReason,
      forTopic: null,
    };
  }

  return null;
}

// ---------------------------------------------------------------------
// Revision, per topic
// ---------------------------------------------------------------------

export type RevisionDueItem = {
  problemSlug: string;
  problemTitle: string;
  difficulty: "Easy" | "Medium" | "Hard";
  /** 0 = due today; N = overdue by N days. */
  daysOverdue: number;
  url: string;
};

export type TopicRevisionSummary = {
  /** Overdue + due today, using the Revision Center's own definitions. */
  dueCount: number;
  overdueCount: number;
  /** Items scheduled for later. */
  upcomingCount: number;
  /** Every revision item attached to this topic, due or not. 0 means nothing is tracked for it at all. */
  trackedCount: number;
  /** The first few due items, most overdue first — enough to link to, not the whole list. */
  dueItems: RevisionDueItem[];
};

const MAX_DUE_ITEMS_LISTED = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUTCDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const EMPTY_REVISION: TopicRevisionSummary = { dueCount: 0, overdueCount: 0, upcomingCount: 0, trackedCount: 0, dueItems: [] };

/**
 * Per-topic revision summary, built by running the existing
 * `categorizeRevisionItems` on each topic's items — so "overdue" and
 * "due today" mean exactly what they do on the Revision page, with no
 * second definition to drift. Each item is attached to the single
 * topic it carries (the revision data model stores one primary topic
 * per problem), so a problem tagged with several topics counts under
 * only one of them.
 */
export function summarizeRevisionByTopic(items: RevisionItemState[], now: Date): Record<string, TopicRevisionSummary> {
  const byTopic = new Map<string, RevisionItemState[]>();
  for (const item of items) {
    if (!item.topicSlug) continue;
    const list = byTopic.get(item.topicSlug);
    if (list) list.push(item);
    else byTopic.set(item.topicSlug, [item]);
  }

  const todayStart = startOfUTCDay(now);
  const result: Record<string, TopicRevisionSummary> = {};

  for (const [topicSlug, topicItems] of byTopic) {
    const { overdue, dueToday, upcoming } = categorizeRevisionItems(topicItems, now);
    result[topicSlug] = {
      dueCount: overdue.totalCount + dueToday.totalCount,
      overdueCount: overdue.totalCount,
      upcomingCount: upcoming.totalCount,
      trackedCount: topicItems.length,
      dueItems: [...overdue.items, ...dueToday.items].slice(0, MAX_DUE_ITEMS_LISTED).map((item) => ({
        problemSlug: item.problemSlug,
        problemTitle: item.problemTitle,
        difficulty: item.difficulty,
        daysOverdue: Math.max(0, Math.round((todayStart - startOfUTCDay(item.dueAt)) / DAY_MS)),
        url: leetcodeProblemUrl(item.problemSlug),
      })),
    };
  }

  return result;
}

// ---------------------------------------------------------------------
// Everything for one topic
// ---------------------------------------------------------------------

export type TopicGuidance = {
  /**
   * NEW practice: problems on this topic that are not in the student's
   * synced solve history. (That history is only what the app has
   * imported — it can't see everything ever solved on LeetCode.)
   */
  newPracticeRecommendations: NewPracticeResult;
  /** REVISION: problems the student has already solved that are due for review. */
  revision: TopicRevisionSummary;
};

/**
 * New-practice and revision guidance for every roadmap topic, keyed by
 * slug — built once on the server so the interactive page can show
 * any topic instantly without shipping the catalog, the pool or every
 * revision item to the browser.
 *
 * New practice: chosen by `selectNewPractice` (new-practice.ts), with
 * the engine's own non-revision recommendations for the topic leading.
 * A problem counts as already solved if it's in the synced submission
 * history OR has a revision item — revision items are only created for
 * solved problems, so this closes any gap between the two. A
 * "Postponed" topic gets none on purpose: its prerequisite is the
 * thing to work on first, and the prerequisite has its own.
 *
 * Revision: unchanged — the existing categorizer's counts and due
 * items for the topic.
 */
export function buildTopicGuidance(input: {
  topics: RoadmapTopic[];
  recommendations: Recommendation[];
  catalog: ProblemCatalogEntry[];
  solvedProblemSlugs: string[];
  revisionItems: RevisionItemState[];
  now: Date;
  /** The supplemental pool. Defaults to the real one; injectable so tests don't depend on it. */
  pool?: ProblemCatalogEntry[];
}): Record<string, TopicGuidance> {
  const pool = input.pool ?? PRACTICE_POOL;
  const solved = new Set([...input.solvedProblemSlugs, ...input.revisionItems.map((item) => item.problemSlug)]);
  const revisionByTopic = summarizeRevisionByTopic(input.revisionItems, input.now);

  const recsByTopic = new Map<string, Recommendation[]>();
  for (const rec of input.recommendations) {
    if (rec.isRevision) continue;
    const list = recsByTopic.get(rec.topicSlug);
    if (list) list.push(rec);
    else recsByTopic.set(rec.topicSlug, [rec]);
  }

  const result: Record<string, TopicGuidance> = {};
  for (const topic of input.topics) {
    result[topic.topicSlug] = {
      newPracticeRecommendations: selectNewPractice({
        topic,
        catalog: input.catalog,
        pool,
        solvedSlugs: solved,
        enginePicks: recsByTopic.get(topic.topicSlug) ?? [],
      }),
      revision: revisionByTopic[topic.topicSlug] ?? EMPTY_REVISION,
    };
  }

  return result;
}