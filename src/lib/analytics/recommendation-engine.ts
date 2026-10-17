import { ANALYTICS_CONFIG } from "@/lib/analytics/config";
import type {
  Difficulty,
  ForwardLookingGap,
  MasteryResult,
  ProblemCatalogEntry,
  Recommendation,
  RecommendationPriority,
  RecommendationResult,
  SkillGraphEdge,
  SubmissionInput,
  TopicAnalytics,
} from "@/lib/analytics/types";

const { maxTotal, maxPerTopic, practiceTodayCount } = ANALYTICS_CONFIG.recommendations;

export type RecommendationInput = {
  mastery: MasteryResult[];
  topics: TopicAnalytics[];
  forwardLookingGaps: ForwardLookingGap[];
  topicRelationships: SkillGraphEdge[];
  submissions: SubmissionInput[];
  catalog: ProblemCatalogEntry[];
};

type Draft = Recommendation & { recencyRank: number };

function difficultyCountFor(topic: TopicAnalytics | undefined, difficulty: Difficulty): number {
  return topic?.difficultyDistribution.find((d) => d.difficulty === difficulty)?.count ?? 0;
}

/**
 * Prefers the first difficulty in the list that has an available,
 * unsolved candidate. Deliberately does NOT fall back to "any
 * difficulty" outside the caller's list — callers pass a restricted
 * list specifically to keep a shaky topic's recommendations at or
 * below the student's level, and a fallback that ignored that would
 * silently defeat the whole point (a topic where the only unsolved
 * catalog entry happens to be Hard should recommend nothing, not
 * hand back the Hard one anyway).
 */
function pickCandidate(
  catalog: ProblemCatalogEntry[],
  topicSlug: string,
  preferredDifficulties: Difficulty[],
  excludeSlugs: Set<string>
): ProblemCatalogEntry | undefined {
  const pool = catalog.filter((p) => p.topicSlugs.includes(topicSlug) && !excludeSlugs.has(p.slug));
  for (const difficulty of preferredDifficulties) {
    const atDifficulty = pool.filter((p) => p.difficulty === difficulty);
    if (atDifficulty.length > 0) {
      return [...atDifficulty].sort((a, b) => (b.interviewRelevance === "high" ? 1 : 0) - (a.interviewRelevance === "high" ? 1 : 0))[0];
    }
  }
  return undefined;
}

/**
 * Selects and prioritizes specific practice problems, always tracing
 * each one back to a topic-level reason already computed elsewhere
 * in the engine — never a random pick. Pure: the candidate pool
 * (`catalog`) and everything else comes in as plain data, so this is
 * fully testable without a DB.
 *
 * Deliberately does NOT use two of the factors named in the brief as
 * primary drivers: "failed problems" (Phase 2's data source only
 * exposes accepted submissions — there's no failure data to use, and
 * fabricating a proxy for it isn't something this engine does) and
 * a full spaced-repetition interval system for "due for revision"
 * (that's the separate, larger Revision System feature, still
 * pending — see PROJECT_STATUS.md). "Revision" here means: the
 * topic is classified Revision Needed (Phase 3), and the
 * recommendation is one of the student's own previously-solved
 * problems in that topic, explicitly labeled as a revisit.
 */
export function computeRecommendations(input: RecommendationInput): RecommendationResult {
  const { mastery, topics, topicRelationships, submissions, catalog } = input;

  const topicsBySlug = new Map(topics.map((t) => [t.topicSlug, t]));
  const solvedSlugs = new Set(submissions.map((s) => s.problemSlug));
  const usedSlugs = new Set(solvedSlugs); // never recommend a fresh pick the student already solved

  const solvedByTopic = new Map<string, SubmissionInput[]>();
  for (const s of submissions) {
    for (const topicSlug of s.topicSlugs) {
      const list = solvedByTopic.get(topicSlug) ?? [];
      list.push(s);
      solvedByTopic.set(topicSlug, list);
    }
  }

  const drafts: Draft[] = [];

  function addDraft(
    candidate: ProblemCatalogEntry,
    topicSlug: string,
    topicName: string,
    priority: RecommendationPriority,
    kind: Recommendation["kind"],
    reason: string,
    isRevision: boolean
  ) {
    drafts.push({
      problemSlug: candidate.slug,
      problemTitle: candidate.title,
      difficulty: candidate.difficulty,
      topicSlug,
      topicName,
      priority,
      kind,
      reason,
      isRevision,
      recencyRank: topicsBySlug.get(topicSlug)?.daysSinceLastPracticed ?? Number.MAX_SAFE_INTEGER,
    });
  }

  for (const m of mastery) {
    const topic = topicsBySlug.get(m.topicSlug);
    const hasMediumOrHarder = difficultyCountFor(topic, "Medium") + difficultyCountFor(topic, "Hard") > 0;
    // Never Hard for a shaky topic — "avoid problems far above the student's level".
    const gapDifficulties: Difficulty[] = hasMediumOrHarder ? ["Medium", "Easy"] : ["Easy", "Medium"];

    if (m.gapVerdict === "prerequisite-gap") {
      const candidate = pickCandidate(catalog, m.topicSlug, gapDifficulties, usedSlugs);
      if (candidate) {
        usedSlugs.add(candidate.slug);
        addDraft(
          candidate,
          m.topicSlug,
          m.topicName,
          "High",
          "prerequisite-gap",
          `${m.gapExplanation} ${candidate.title} is a reasonable place to start.`,
          false
        );
      }
    } else if (m.classification === "Fundamental Gap") {
      const candidate = pickCandidate(catalog, m.topicSlug, gapDifficulties, usedSlugs);
      if (candidate) {
        usedSlugs.add(candidate.slug);
        addDraft(
          candidate,
          m.topicSlug,
          m.topicName,
          "High",
          "fundamental-gap",
          `Your ${m.topicName} fundamentals need direct work (${m.masteryScore}/100 with real evidence behind it) — ${candidate.title} is an approachable next step.`,
          false
        );
      }
    } else if (m.classification === "Weak") {
      const candidate = pickCandidate(catalog, m.topicSlug, gapDifficulties, usedSlugs);
      if (candidate) {
        usedSlugs.add(candidate.slug);
        addDraft(
          candidate,
          m.topicSlug,
          m.topicName,
          "Medium",
          "weak-topic",
          `You're still building consistency in ${m.topicName} (${m.masteryScore}/100) — ${candidate.title} keeps that moving.`,
          false
        );
      }
    } else if (m.classification === "Revision Needed") {
      const solved = solvedByTopic.get(m.topicSlug);
      const pick = solved?.[0];
      if (pick) {
        usedSlugs.add(pick.problemSlug);
        addDraft(
          { slug: pick.problemSlug, title: pick.problemTitle, difficulty: pick.difficulty, topicSlugs: pick.topicSlugs },
          m.topicSlug,
          m.topicName,
          "Medium",
          "revision",
          `You were solid in ${m.topicName} but it's been ${topic?.daysSinceLastPracticed ?? "a while"} days — revisit ${pick.problemTitle} to keep it sharp.`,
          true
        );
      }
    } else if (m.classification === "Under-Practiced") {
      const candidate = pickCandidate(catalog, m.topicSlug, ["Easy"], usedSlugs);
      if (candidate) {
        usedSlugs.add(candidate.slug);
        addDraft(
          candidate,
          m.topicSlug,
          m.topicName,
          "Low",
          "diversity",
          `Not enough evidence on ${m.topicName} yet — ${candidate.title} would help build a clearer picture.`,
          false
        );
      }
    } else if (m.classification === "Strong" || m.classification === "Emerging") {
      // Stretch #1: a subtopic of this strong topic with little/no evidence — matches the brief's example almost exactly.
      const subtopicEdges = topicRelationships.filter(
        (e) => e.prerequisiteSlug === m.topicSlug && e.relationshipType === "SUBTOPIC"
      );
      for (const edge of subtopicEdges) {
        const subtopicMastery = mastery.find((mm) => mm.topicSlug === edge.topicSlug);
        const subtopicIsThin = !subtopicMastery || subtopicMastery.classification === "Under-Practiced";
        if (!subtopicIsThin) continue;

        const candidate = pickCandidate(catalog, edge.topicSlug, ["Medium", "Easy"], usedSlugs);
        if (candidate) {
          usedSlugs.add(candidate.slug);
          addDraft(
            candidate,
            edge.topicSlug,
            edge.topicName,
            "Low",
            "stretch",
            `You have strong basic ${m.topicName} skills but limited practice with ${edge.topicName} — ${candidate.title} is a good next challenge.`,
            false
          );
        }
      }

      // Stretch #2: strong at this topic but no Hard-difficulty exposure yet.
      if (topic && difficultyCountFor(topic, "Hard") === 0) {
        const candidate = pickCandidate(catalog, m.topicSlug, ["Hard"], usedSlugs);
        if (candidate) {
          usedSlugs.add(candidate.slug);
          addDraft(
            candidate,
            m.topicSlug,
            m.topicName,
            "Low",
            "stretch",
            `You have strong ${m.topicName} fundamentals but limited exposure to harder variants — ${candidate.title} is a solid stretch problem.`,
            false
          );
        }
      }
    }
  }

  // Forward-looking gap topics (input.forwardLookingGaps) are
  // deliberately never recommended directly — the system already
  // said "not your immediate priority"; recommending it anyway
  // would contradict that. Their weak prerequisites are already
  // covered by the loop above if those prerequisites have their own
  // evidence.

  const priorityRank: Record<RecommendationPriority, number> = { High: 0, Medium: 1, Low: 2 };
  const sorted = [...drafts].sort((a, b) => {
    if (priorityRank[a.priority] !== priorityRank[b.priority]) {
      return priorityRank[a.priority] - priorityRank[b.priority];
    }
    return a.recencyRank - b.recencyRank; // more recently practiced topics first, within the same priority
  });

  // Topic diversity cap.
  const perTopicCount = new Map<string, number>();
  const diversified: Draft[] = [];
  for (const draft of sorted) {
    const count = perTopicCount.get(draft.topicSlug) ?? 0;
    if (count >= maxPerTopic) continue;
    perTopicCount.set(draft.topicSlug, count + 1);
    diversified.push(draft);
  }

  const all: Recommendation[] = diversified.slice(0, maxTotal).map((d) => ({
    problemSlug: d.problemSlug,
    problemTitle: d.problemTitle,
    difficulty: d.difficulty,
    topicSlug: d.topicSlug,
    topicName: d.topicName,
    priority: d.priority,
    kind: d.kind,
    reason: d.reason,
    isRevision: d.isRevision,
  }));

  // Practice Today: a balanced subset, not just the top N by priority.
  const practiceToday: Recommendation[] = [];
  const takenSlugs = new Set<string>();
  for (const priority of ["High", "Medium", "Low"] as RecommendationPriority[]) {
    const match = all.find((r) => r.priority === priority && !takenSlugs.has(r.problemSlug));
    if (match) {
      practiceToday.push(match);
      takenSlugs.add(match.problemSlug);
    }
    if (practiceToday.length >= practiceTodayCount) break;
  }
  for (const r of all) {
    if (practiceToday.length >= practiceTodayCount) break;
    if (!takenSlugs.has(r.problemSlug)) {
      practiceToday.push(r);
      takenSlugs.add(r.problemSlug);
    }
  }

  return { practiceToday, all };
}
