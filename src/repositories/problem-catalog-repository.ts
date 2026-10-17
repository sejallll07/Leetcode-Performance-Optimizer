import { pool } from "@/lib/db";
import { PROBLEM_CATALOG } from "@/lib/analytics/problem-catalog-data";
import { SKILL_GRAPH_TOPICS } from "@/lib/analytics/skill-graph-data";
import { upsertProblemWithTopics, upsertTopic } from "@/repositories/leetcode-repository";
import type { ProblemCatalogEntry } from "@/lib/analytics/types";

// The skill graph already names most topics the catalog references
// properly ("array" -> "Array"). A few catalog topics aren't skill
// graph nodes — named here so seeding never falls back to using the
// raw slug as the display name (which would clobber a proper name
// on conflict, e.g. overwriting "Hash Table" with "hash-table").
const EXTRA_TOPIC_NAMES: Record<string, string> = {
  "hash-table": "Hash Table",
  "linked-list": "Linked List",
  string: "String",
};

const TOPIC_NAMES = new Map<string, string>([
  ...SKILL_GRAPH_TOPICS.map((t): [string, string] => [t.slug, t.name]),
  ...Object.entries(EXTRA_TOPIC_NAMES),
]);

function nameForTopic(slug: string): string {
  return TOPIC_NAMES.get(slug) ?? slug;
}

/**
 * Seeds the curated problem catalog into the same `problems` /
 * `problem_topics` tables Phase 2 ingestion writes to — a curated
 * problem and a user-ingested one are the same kind of row; the only
 * difference is how it got there. Idempotent, safe to call on every
 * recommendation compute (same pattern as skill-graph-repository.ts).
 */
export async function ensureProblemCatalogSeeded(): Promise<void> {
  for (const entry of PROBLEM_CATALOG) {
    const topicIds = await Promise.all(
      entry.topicSlugs.map((slug) => upsertTopic({ name: nameForTopic(slug), slug }))
    );
    await upsertProblemWithTopics({
      leetcodeId: entry.slug,
      slug: entry.slug,
      title: entry.title,
      difficulty: entry.difficulty,
      topicIds,
      interviewRelevance: entry.interviewRelevance,
    });
  }
}

/** Every known problem (curated + anything any user's ingestion has ever added), grouped with all of its topic tags. */
export async function loadProblemCatalog(): Promise<ProblemCatalogEntry[]> {
  const result = await pool.query(
    `SELECT p."slug", p."title", p."difficulty", p."interviewRelevance", t."slug" AS "topicSlug"
     FROM "problems" p
     LEFT JOIN "problem_topics" pt ON pt."problemId" = p."id"
     LEFT JOIN "topics" t ON t."id" = pt."topicId"`
  );

  const bySlug = new Map<string, ProblemCatalogEntry>();
  for (const row of result.rows) {
    const existing = bySlug.get(row.slug);
    if (existing) {
      if (row.topicSlug) existing.topicSlugs.push(row.topicSlug);
    } else {
      bySlug.set(row.slug, {
        slug: row.slug,
        title: row.title,
        difficulty: row.difficulty,
        topicSlugs: row.topicSlug ? [row.topicSlug] : [],
        interviewRelevance: row.interviewRelevance ?? undefined,
      });
    }
  }
  return [...bySlug.values()];
}
