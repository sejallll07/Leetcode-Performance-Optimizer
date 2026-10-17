import { describe, expect, it } from "vitest";
import { PROBLEM_CATALOG } from "@/lib/analytics/problem-catalog-data";
import { SKILL_GRAPH_TOPICS } from "@/lib/analytics/skill-graph-data";
import { PRACTICE_POOL } from "@/lib/roadmap/practice-pool-data";

// The skill graph's topics, plus the same three extras the main catalog uses.
const KNOWN_TOPICS = new Set<string>([...SKILL_GRAPH_TOPICS.map((t) => t.slug), "hash-table", "string", "linked-list"]);

// LeetCode has no genuine Easy problems for these, so they're allowed to have none.
const TOPICS_WITHOUT_EASY = new Set(["backtracking", "graph-algorithms", "topological-sort"]);

describe("practice pool: entry integrity", () => {
  it("is not empty", () => {
    expect(PRACTICE_POOL.length).toBeGreaterThan(0);
  });

  it("every entry is well-formed", () => {
    for (const problem of PRACTICE_POOL) {
      expect(problem.slug, problem.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(problem.title.trim().length, `${problem.slug} title`).toBeGreaterThan(0);
      expect(["Easy", "Medium", "Hard"], `${problem.slug} difficulty`).toContain(problem.difficulty);
      if (problem.interviewRelevance !== undefined) {
        expect(["high", "medium"], `${problem.slug} relevance`).toContain(problem.interviewRelevance);
      }
      expect(problem.topicSlugs.length, `${problem.slug} topics`).toBeGreaterThan(0);
    }
  });

  it("only uses topic slugs the app knows", () => {
    for (const problem of PRACTICE_POOL) {
      for (const topic of problem.topicSlugs) {
        expect(KNOWN_TOPICS.has(topic), `${problem.slug} uses unknown topic "${topic}"`).toBe(true);
      }
    }
  });

  it("has no duplicate slugs or duplicate topic tags on an entry", () => {
    const slugs = PRACTICE_POOL.map((p) => p.slug);
    expect(slugs.filter((slug, i) => slugs.indexOf(slug) !== i)).toEqual([]);
    for (const problem of PRACTICE_POOL) {
      expect(new Set(problem.topicSlugs).size, `${problem.slug} repeats a topic`).toBe(problem.topicSlugs.length);
    }
  });

  it("never duplicates a main-catalog problem (it only fills gaps)", () => {
    const catalogSlugs = new Set(PROBLEM_CATALOG.map((p) => p.slug));
    expect(PRACTICE_POOL.map((p) => p.slug).filter((slug) => catalogSlugs.has(slug))).toEqual([]);
  });
});

describe("practice pool: coverage together with the catalog", () => {
  const combined = [...PROBLEM_CATALOG, ...PRACTICE_POOL];

  for (const topic of [...KNOWN_TOPICS].sort()) {
    const forTopic = combined.filter((p) => p.topicSlugs.includes(topic));
    const count = (difficulty: string) => forTopic.filter((p) => p.difficulty === difficulty).length;

    it(`${topic} has enough problems across difficulties`, () => {
      expect(forTopic.length).toBeGreaterThanOrEqual(6);
      expect(count("Medium")).toBeGreaterThanOrEqual(3);
      expect(count("Hard")).toBeGreaterThanOrEqual(1);
      if (!TOPICS_WITHOUT_EASY.has(topic)) expect(count("Easy")).toBeGreaterThanOrEqual(1);
    });
  }
});