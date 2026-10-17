/**
 * The DSA skill graph — curated, not derived from any user's data.
 * Same graph for every user; seeded into the DB once
 * (src/repositories/skill-graph-repository.ts) and read from there.
 *
 * Most slugs match LeetCode's own topic tags exactly, so a topic
 * node picks up real evidence automatically as users' submissions
 * get ingested (Phase 2). A few (marked below) are curated
 * subtopics with no single matching LeetCode tag — they exist as
 * graph nodes so the prerequisite chain is complete, but will
 * usually show "insufficient evidence" until a future phase adds
 * finer-grained problem tagging. That's an honest, not a broken,
 * state — see PROJECT_STATUS.md.
 */

export type SkillGraphTopic = { slug: string; name: string };

export type SkillGraphEdgeSeed = {
  topicSlug: string; // the dependent ("child") topic
  prerequisiteSlug: string; // what it depends on
  relationshipType: "PREREQUISITE" | "SUBTOPIC";
  strength: number; // 0..1
};

// Nodes referenced by the edges below. Topics ingestion already
// creates (e.g. "array") are included here too — upserting is
// idempotent, so seeding never overwrites real ingested data, it
// just guarantees the node exists even before any user has touched it.
export const SKILL_GRAPH_TOPICS: SkillGraphTopic[] = [
  { slug: "array", name: "Array" },
  { slug: "two-pointers", name: "Two Pointers" },
  { slug: "sliding-window", name: "Sliding Window" },
  { slug: "prefix-sum", name: "Prefix Sum" },
  { slug: "binary-search", name: "Binary Search" },
  { slug: "binary-search-on-answer", name: "Binary Search on Answer" },
  { slug: "stack", name: "Stack" },
  { slug: "monotonic-stack", name: "Monotonic Stack" },
  { slug: "recursion", name: "Recursion" },
  { slug: "backtracking", name: "Backtracking" },
  { slug: "tree", name: "Tree" },
  { slug: "dynamic-programming", name: "Dynamic Programming" },
  { slug: "tree-dp", name: "Tree DP" },
  { slug: "depth-first-search", name: "Depth-First Search" },
  { slug: "breadth-first-search", name: "Breadth-First Search" },
  { slug: "graph", name: "Graph" },
  { slug: "graph-algorithms", name: "Graph Algorithms" },
  { slug: "union-find", name: "Union Find" },
  { slug: "topological-sort", name: "Topological Sort" },
];

export const SKILL_GRAPH_RELATIONSHIPS: SkillGraphEdgeSeed[] = [
  // Recursion → Trees / Backtracking
  { topicSlug: "tree", prerequisiteSlug: "recursion", relationshipType: "PREREQUISITE", strength: 0.7 },
  { topicSlug: "backtracking", prerequisiteSlug: "recursion", relationshipType: "PREREQUISITE", strength: 0.9 },
  { topicSlug: "dynamic-programming", prerequisiteSlug: "recursion", relationshipType: "PREREQUISITE", strength: 0.6 },

  // BFS/DFS → Graph Algorithms
  { topicSlug: "graph-algorithms", prerequisiteSlug: "depth-first-search", relationshipType: "PREREQUISITE", strength: 0.8 },
  { topicSlug: "graph-algorithms", prerequisiteSlug: "breadth-first-search", relationshipType: "PREREQUISITE", strength: 0.8 },
  { topicSlug: "topological-sort", prerequisiteSlug: "graph", relationshipType: "PREREQUISITE", strength: 0.6 },
  { topicSlug: "topological-sort", prerequisiteSlug: "depth-first-search", relationshipType: "PREREQUISITE", strength: 0.5 },
  { topicSlug: "union-find", prerequisiteSlug: "graph", relationshipType: "PREREQUISITE", strength: 0.5 },

  // Arrays → Prefix Sum / Two Pointer / Sliding Window
  { topicSlug: "prefix-sum", prerequisiteSlug: "array", relationshipType: "SUBTOPIC", strength: 0.8 },
  { topicSlug: "two-pointers", prerequisiteSlug: "array", relationshipType: "SUBTOPIC", strength: 0.8 },
  { topicSlug: "sliding-window", prerequisiteSlug: "array", relationshipType: "SUBTOPIC", strength: 0.7 },
  { topicSlug: "sliding-window", prerequisiteSlug: "two-pointers", relationshipType: "PREREQUISITE", strength: 0.5 },

  // Binary Search → Binary Search on Answer
  { topicSlug: "binary-search-on-answer", prerequisiteSlug: "binary-search", relationshipType: "SUBTOPIC", strength: 0.9 },

  // Stack → Monotonic Stack
  { topicSlug: "monotonic-stack", prerequisiteSlug: "stack", relationshipType: "SUBTOPIC", strength: 0.6 },

  // Tree + Dynamic Programming → Tree DP (the classic "combination" subtopic)
  { topicSlug: "tree-dp", prerequisiteSlug: "tree", relationshipType: "SUBTOPIC", strength: 0.7 },
  { topicSlug: "tree-dp", prerequisiteSlug: "dynamic-programming", relationshipType: "SUBTOPIC", strength: 0.8 },
];
