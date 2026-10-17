import { INTERVIEW_CONFIG } from "@/lib/interview/config";
import type { Difficulty, MasteryResult, ProblemCatalogEntry } from "@/lib/analytics/types";
import type { InterviewProfileInput, MockInterviewProblemPick, MockInterviewProblemRole } from "@/lib/interview/types";

const { stretchDifficulty } = INTERVIEW_CONFIG;

function topicNameOf(mastery: MasteryResult[], slug: string): string {
  return mastery.find((m) => m.topicSlug === slug)?.topicName ?? slug;
}

/**
 * Best candidate at `difficulty` from `preferredTopicSlugs`, falling
 * back in stages rather than ever returning nothing: first honoring
 * both the topic preference and every exclusion, then dropping the
 * "already solved" exclusion (repeating a solved problem for
 * practice is fine, just not ideal), then dropping the topic
 * preference entirely (any topic at this difficulty), and finally —
 * only if the catalog genuinely has nothing at this difficulty at
 * all — the closest difficulty available. Recently-used-in-a-mock-
 * interview stays excluded through every stage except the very last;
 * repeating a problem across genuinely separate mock sessions is a
 * worse outcome than repeating a difficulty.
 */
function pickCandidate(
  catalog: ProblemCatalogEntry[],
  preferredTopicSlugs: string[],
  difficulty: Difficulty,
  solvedSlugs: Set<string>,
  recentlyUsedSlugs: Set<string>,
  alreadyPickedSlugs: Set<string>
): ProblemCatalogEntry {
  const byRelevance = (a: ProblemCatalogEntry, b: ProblemCatalogEntry) => (b.interviewRelevance === "high" ? 1 : 0) - (a.interviewRelevance === "high" ? 1 : 0);
  const notAlreadyPicked = (p: ProblemCatalogEntry) => !alreadyPickedSlugs.has(p.slug);

  const stages: ((p: ProblemCatalogEntry) => boolean)[] = [
    (p) => preferredTopicSlugs.some((t) => p.topicSlugs.includes(t)) && p.difficulty === difficulty && !solvedSlugs.has(p.slug) && !recentlyUsedSlugs.has(p.slug),
    (p) => preferredTopicSlugs.some((t) => p.topicSlugs.includes(t)) && p.difficulty === difficulty && !recentlyUsedSlugs.has(p.slug),
    (p) => p.difficulty === difficulty && !solvedSlugs.has(p.slug) && !recentlyUsedSlugs.has(p.slug),
    (p) => p.difficulty === difficulty,
  ];

  for (const stage of stages) {
    const matches = catalog.filter((p) => stage(p) && notAlreadyPicked(p)).sort(byRelevance);
    if (matches.length > 0) return matches[0];
  }

  // Last resort: the catalog has nothing at this difficulty at all (shouldn't happen with the seeded catalog, but never crash a mock interview over it) — closest difficulty by any topic.
  const fallbackOrder: Difficulty[] = difficulty === "Hard" ? ["Medium", "Easy"] : difficulty === "Medium" ? ["Easy", "Hard"] : ["Medium", "Hard"];
  for (const fallbackDifficulty of fallbackOrder) {
    const matches = catalog.filter((p) => p.difficulty === fallbackDifficulty && notAlreadyPicked(p)).sort(byRelevance);
    if (matches.length > 0) return matches[0];
  }

  throw new Error("Problem catalog is empty — cannot build a mock interview.");
}

function reasonFor(role: MockInterviewProblemRole, topicName: string | null, difficulty: Difficulty): string {
  if (role === "warmup") return topicName ? `A ${difficulty} warm-up in ${topicName}, a topic you already have solid footing in — eases you in before the harder problems.` : `A ${difficulty} warm-up to start the session.`;
  if (role === "medium") return topicName ? `A ${difficulty} problem in ${topicName} — an area worth reinforcing under a bit of pressure.` : `A ${difficulty} problem to build on the warm-up.`;
  return topicName ? `A ${difficulty} stretch problem in ${topicName} — this is deliberately your weaker ground, the way a real interviewer might probe it.` : `A ${difficulty} stretch problem to round out the session.`;
}

function toPick(role: MockInterviewProblemRole, entry: ProblemCatalogEntry, mastery: MasteryResult[], targetTopicSlug: string | null): MockInterviewProblemPick {
  const primaryTopicSlug = targetTopicSlug ?? entry.topicSlugs[0] ?? null;
  return {
    role,
    slug: entry.slug,
    title: entry.title,
    difficulty: entry.difficulty,
    topicSlugs: entry.topicSlugs,
    topicNames: entry.topicSlugs.map((s) => topicNameOf(mastery, s)),
    reason: reasonFor(role, primaryTopicSlug ? topicNameOf(mastery, primaryTopicSlug) : null, entry.difficulty),
  };
}

/**
 * Always returns exactly 3 picks, in order: warm-up (Easy), medium
 * (Medium), stretch (Medium or Hard depending on the student's
 * profile — see INTERVIEW_CONFIG.stretchDifficulty). Every pick
 * traces back to a real, seeded catalog entry — same discipline as
 * the Phase 6 recommendation engine, never an invented problem.
 */
export function selectMockInterviewProblems(input: InterviewProfileInput): MockInterviewProblemPick[] {
  const { mastery, forwardLookingGaps, catalog, solvedSlugs, recentlyUsedSlugs } = input;
  const evidenced = mastery.filter((m) => m.classification !== "Under-Practiced");

  const warmupTopics = evidenced.filter((m) => m.classification === "Strong" || m.classification === "Revision Needed").sort((a, b) => b.masteryScore - a.masteryScore).map((m) => m.topicSlug);

  const mediumTopics = evidenced.filter((m) => m.classification === "Revision Needed" || m.classification === "Weak").map((m) => m.topicSlug);

  const goForHard = evidenced.length >= stretchDifficulty.minEvidencedTopicsForHard && evidenced.filter((m) => m.classification === "Strong").length >= stretchDifficulty.minStrongTopicsForHard;

  const stretchTopics = [...evidenced.filter((m) => m.classification === "Weak" || m.classification === "Fundamental Gap").map((m) => m.topicSlug), ...forwardLookingGaps.map((g) => g.topicSlug)];

  const alreadyPicked = new Set<string>();

  const warmupEntry = pickCandidate(catalog, warmupTopics, "Easy", solvedSlugs, recentlyUsedSlugs, alreadyPicked);
  alreadyPicked.add(warmupEntry.slug);
  const warmup = toPick("warmup", warmupEntry, mastery, warmupTopics[0] ?? null);

  const mediumEntry = pickCandidate(catalog, mediumTopics, "Medium", solvedSlugs, recentlyUsedSlugs, alreadyPicked);
  alreadyPicked.add(mediumEntry.slug);
  const medium = toPick("medium", mediumEntry, mastery, mediumTopics[0] ?? null);

  const stretchEntry = pickCandidate(catalog, stretchTopics, goForHard ? "Hard" : "Medium", solvedSlugs, recentlyUsedSlugs, alreadyPicked);
  const stretch = toPick("stretch", stretchEntry, mastery, stretchTopics[0] ?? null);

  return [warmup, medium, stretch];
}
