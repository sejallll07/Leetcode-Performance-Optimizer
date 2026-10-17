import type { Difficulty, ProblemCatalogEntry, Recommendation } from "@/lib/analytics/types";
import type { RoadmapStatus, RoadmapTopic } from "@/lib/roadmap/types";

/**
 * "New practice" for the Roadmap: up to a few problems on a topic that
 * are NOT in the student's synced solve history, picked at a difficulty
 * that fits where they are on that topic.
 *
 * Pure and I/O-free, and additive: it doesn't replace or change the
 * recommendation engine. Where the engine already has a fresh pick for
 * the topic, that pick leads (with its own reason) and this fills the
 * remaining slots from the curated catalog first, then the supplemental
 * pool. Difficulty comes from the topic's existing classification — the
 * engine's own read of its mastery — rather than a second scoring system.
 *
 * What it guarantees: every problem returned is tagged with the topic and
 * is absent from `solvedSlugs`. What it can't guarantee: that the student
 * hasn't solved it on LeetCode outside the history the app has synced.
 */

export function leetcodeProblemUrl(problemSlug: string): string {
  return `https://leetcode.com/problems/${problemSlug}/`;
}

export type NewPracticeBand = "approachable" | "developing" | "advanced";

export type NewPracticeProblem = {
  slug: string;
  title: string;
  difficulty: Difficulty;
  /** The topic this practice is for — shown on the card so the problem is never context-free. */
  topicName: string;
  url: string;
  /** One short line on why this one. */
  reason: string;
  /** Where it came from: the recommendation engine, the curated catalog, or the supplemental pool. */
  source: "engine" | "catalog" | "pool";
};

export type NewPracticeResult = {
  /** The difficulty band used, or null when the topic gets no new practice (Postponed). */
  band: NewPracticeBand | null;
  problems: NewPracticeProblem[];
};

const MAX_NEW_PRACTICE = 3;

/**
 * Which band a topic's classification calls for:
 *  - approachable: little or shaky evidence (Gap, Weak, Under-Practiced,
 *    or untouched) → Easy plus one approachable Medium, never Hard
 *  - developing: Emerging, or solid-but-stale (Revision Needed) → mostly
 *    Medium, never Hard
 *  - advanced: Strong → Medium plus one Hard
 * A Postponed topic gets none: its weak prerequisite is the thing to
 * practice first, and that prerequisite has its own new practice.
 */
export function getNewPracticeBand(status: RoadmapStatus): NewPracticeBand | null {
  switch (status) {
    case "Postponed":
      return null;
    case "Fundamental Gap":
    case "Weak":
    case "Under-Practiced":
    case "Recommended Next":
      return "approachable";
    case "Emerging":
    case "Revision Needed":
      return "developing";
    case "Strong":
      return "advanced";
  }
}

const SLOT_PLAN: Record<NewPracticeBand, Difficulty[]> = {
  approachable: ["Easy", "Easy", "Medium"],
  developing: ["Medium", "Medium", "Medium"],
  advanced: ["Medium", "Medium", "Hard"],
};

/** What to try, in order, when a slot's own difficulty has nothing left to offer. */
const FALLBACKS: Record<NewPracticeBand, Partial<Record<Difficulty, Difficulty[]>>> = {
  approachable: { Easy: ["Medium"], Medium: ["Easy"] },
  developing: { Medium: ["Easy"] },
  advanced: { Medium: ["Hard", "Easy"], Hard: ["Medium"] },
};

const RELEVANCE_RANK = { high: 0, medium: 1 } as const;

function describe(band: NewPracticeBand, difficulty: Difficulty, untouched: boolean): string {
  if (untouched) {
    return difficulty === "Easy" ? "Starter problem to get going" : "A first Medium once the starters feel comfortable";
  }
  switch (band) {
    case "approachable":
      return difficulty === "Easy" ? "Approachable practice to build confidence" : "A manageable Medium to build confidence";
    case "developing":
      return difficulty === "Easy" ? "A quick warm-up to reinforce the basics" : "Medium-level practice to deepen it";
    case "advanced":
      if (difficulty === "Hard") return "A Hard problem to stretch beyond your current level";
      return difficulty === "Easy" ? "A quick refresher" : "Interview-level practice to keep it sharp";
  }
}

type Candidate = { problem: ProblemCatalogEntry; source: "catalog" | "pool"; order: number };

/**
 * Up to `limit` new problems for a topic. The recommendation engine's
 * own fresh picks for the topic (if any) go first and use up matching
 * slots; the rest are filled slot by slot from the catalog, then the
 * pool. Within a difficulty: catalog before pool, then high interview
 * relevance, then original order. If a difficulty runs dry the band's
 * fallback difficulties are tried; if nothing fits, fewer than `limit`
 * come back rather than a problem that doesn't belong.
 */
export function selectNewPractice(input: {
  topic: RoadmapTopic;
  catalog: ProblemCatalogEntry[];
  pool: ProblemCatalogEntry[];
  solvedSlugs: ReadonlySet<string>;
  /** The engine's non-revision recommendations for this topic, in the engine's order. */
  enginePicks?: Recommendation[];
  limit?: number;
}): NewPracticeResult {
  const { topic, catalog, pool, solvedSlugs, enginePicks = [], limit = MAX_NEW_PRACTICE } = input;

  const band = getNewPracticeBand(topic.status);
  if (band === null) return { band: null, problems: [] };

  const untouched = topic.masteryScore === null;
  const taken = new Set<string>();
  const problems: NewPracticeProblem[] = [];
  const slots = [...SLOT_PLAN[band]];

  // 1. The engine's own fresh picks lead, keeping their tailored reasons.
  for (const pick of enginePicks) {
    if (problems.length >= limit) break;
    if (pick.topicSlug !== topic.topicSlug || pick.isRevision) continue;
    if (solvedSlugs.has(pick.problemSlug) || taken.has(pick.problemSlug)) continue;
    taken.add(pick.problemSlug);
    problems.push({
      slug: pick.problemSlug,
      title: pick.problemTitle,
      difficulty: pick.difficulty,
      topicName: topic.topicName,
      url: leetcodeProblemUrl(pick.problemSlug),
      reason: pick.reason,
      source: "engine",
    });
    const matching = slots.indexOf(pick.difficulty);
    slots.splice(matching >= 0 ? matching : slots.length - 1, 1);
  }

  // 2. Everything else: catalog first, then pool; unsolved and on-topic only.
  const candidates: Candidate[] = [
    ...catalog.map((problem, order): Candidate => ({ problem, source: "catalog", order })),
    ...pool.map((problem, order): Candidate => ({ problem, source: "pool", order })),
  ].filter(
    ({ problem }) =>
      problem.topicSlugs.includes(topic.topicSlug) && !solvedSlugs.has(problem.slug) && !taken.has(problem.slug)
  );

  const best = (difficulty: Difficulty): Candidate | undefined =>
    candidates
      .filter(({ problem }) => problem.difficulty === difficulty && !taken.has(problem.slug))
      .sort(
        (a, b) =>
          (a.source === b.source ? 0 : a.source === "catalog" ? -1 : 1) ||
          (a.problem.interviewRelevance ? RELEVANCE_RANK[a.problem.interviewRelevance] : 2) -
            (b.problem.interviewRelevance ? RELEVANCE_RANK[b.problem.interviewRelevance] : 2) ||
          a.order - b.order
      )[0];

  for (const slotDifficulty of slots) {
    if (problems.length >= limit) break;
    for (const difficulty of [slotDifficulty, ...(FALLBACKS[band][slotDifficulty] ?? [])]) {
      const pick = best(difficulty);
      if (!pick) continue;
      taken.add(pick.problem.slug);
      const relevance = pick.problem.interviewRelevance === "high" ? " · Common interview question" : "";
      problems.push({
        slug: pick.problem.slug,
        title: pick.problem.title,
        difficulty: pick.problem.difficulty,
        topicName: topic.topicName,
        url: leetcodeProblemUrl(pick.problem.slug),
        reason: `${describe(band, pick.problem.difficulty, untouched)}${relevance}`,
        source: pick.source,
      });
      break;
    }
  }

  return { band, problems };
}