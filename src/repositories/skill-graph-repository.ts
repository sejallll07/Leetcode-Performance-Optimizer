import { randomUUID } from "crypto";
import { pool } from "@/lib/db";
import { SKILL_GRAPH_RELATIONSHIPS, SKILL_GRAPH_TOPICS } from "@/lib/analytics/skill-graph-data";
import type { SkillGraphEdge } from "@/lib/analytics/types";

/**
 * Seeds the curated skill graph (skill-graph-data.ts) into the DB and
 * loads it back out as plain SkillGraphEdge[] for the engine. The
 * graph is the same for every user, so seeding is idempotent and
 * cheap enough to call on every analytics recompute rather than
 * requiring a separate one-time setup step.
 */
export async function ensureSkillGraphSeeded(): Promise<void> {
  for (const topic of SKILL_GRAPH_TOPICS) {
    await pool.query(
      `INSERT INTO "topics" ("id", "name", "slug")
       VALUES ($1, $2, $3)
       ON CONFLICT ("slug") DO NOTHING`,
      [randomUUID(), topic.name, topic.slug]
    );
  }

  for (const rel of SKILL_GRAPH_RELATIONSHIPS) {
    const topicRow = await pool.query(`SELECT "id" FROM "topics" WHERE "slug" = $1`, [rel.topicSlug]);
    const prereqRow = await pool.query(`SELECT "id" FROM "topics" WHERE "slug" = $1`, [rel.prerequisiteSlug]);
    if (topicRow.rows.length === 0 || prereqRow.rows.length === 0) continue; // shouldn't happen — seeded just above

    await pool.query(
      `INSERT INTO "topic_relationships" ("id", "topicId", "prerequisiteTopicId", "relationshipType", "strength")
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("topicId", "prerequisiteTopicId") DO UPDATE
         SET "relationshipType" = EXCLUDED."relationshipType", "strength" = EXCLUDED."strength"`,
      [randomUUID(), topicRow.rows[0].id, prereqRow.rows[0].id, rel.relationshipType, rel.strength]
    );
  }
}

export async function loadSkillGraphEdges(): Promise<SkillGraphEdge[]> {
  const result = await pool.query(
    `SELECT t."slug" AS "topicSlug", t."name" AS "topicName",
            p."slug" AS "prerequisiteSlug", p."name" AS "prerequisiteName",
            r."relationshipType", r."strength"
     FROM "topic_relationships" r
     JOIN "topics" t ON t."id" = r."topicId"
     JOIN "topics" p ON p."id" = r."prerequisiteTopicId"`
  );
  return result.rows;
}
