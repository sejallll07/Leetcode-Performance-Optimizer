import type { ProblemCatalogEntry } from "@/lib/analytics/types";

/**
 * A curated candidate pool for the recommendation engine — real,
 * well-known LeetCode problems, hand-picked per topic. Not the full
 * ~3000-problem catalog: that would need either a heavy up-front
 * ingestion job or live API calls this sandbox can't make (same
 * network constraint as everything else — see PROJECT_STATUS.md).
 * Curated the same way skill-graph-data.ts is: a deliberately small,
 * well-motivated seed rather than an attempt at completeness.
 *
 * Seeded into the same `problems`/`problem_topics` tables Phase 2
 * ingestion uses (src/repositories/problem-catalog-repository.ts),
 * so the candidate pool a recommendation is drawn from also grows
 * organically over time as real users' solved problems get ingested
 * — this seed is the floor, not the ceiling.
 */
export const PROBLEM_CATALOG: ProblemCatalogEntry[] = [
  // Array / Hash Table
  { slug: "two-sum", title: "Two Sum", difficulty: "Easy", topicSlugs: ["array", "hash-table"], interviewRelevance: "high" },
  { slug: "3sum", title: "3Sum", difficulty: "Medium", topicSlugs: ["array", "two-pointers"], interviewRelevance: "high" },
  { slug: "group-anagrams", title: "Group Anagrams", difficulty: "Medium", topicSlugs: ["hash-table", "string"], interviewRelevance: "high" },
  { slug: "longest-consecutive-sequence", title: "Longest Consecutive Sequence", difficulty: "Medium", topicSlugs: ["hash-table", "array"], interviewRelevance: "medium" },
  { slug: "trapping-rain-water", title: "Trapping Rain Water", difficulty: "Hard", topicSlugs: ["array", "two-pointers", "dynamic-programming"], interviewRelevance: "high" },

  // Two Pointers / Sliding Window
  { slug: "valid-palindrome", title: "Valid Palindrome", difficulty: "Easy", topicSlugs: ["two-pointers", "string"], interviewRelevance: "medium" },
  { slug: "container-with-most-water", title: "Container With Most Water", difficulty: "Medium", topicSlugs: ["two-pointers", "array"], interviewRelevance: "high" },
  { slug: "best-time-to-buy-and-sell-stock", title: "Best Time to Buy and Sell Stock", difficulty: "Easy", topicSlugs: ["sliding-window", "array"], interviewRelevance: "high" },
  { slug: "longest-substring-without-repeating-characters", title: "Longest Substring Without Repeating Characters", difficulty: "Medium", topicSlugs: ["sliding-window", "hash-table", "string"], interviewRelevance: "high" },
  { slug: "minimum-window-substring", title: "Minimum Window Substring", difficulty: "Hard", topicSlugs: ["sliding-window", "hash-table", "string"], interviewRelevance: "medium" },

  // Prefix Sum
  { slug: "range-sum-query-immutable", title: "Range Sum Query - Immutable", difficulty: "Easy", topicSlugs: ["prefix-sum", "array"], interviewRelevance: "medium" },
  { slug: "subarray-sum-equals-k", title: "Subarray Sum Equals K", difficulty: "Medium", topicSlugs: ["prefix-sum", "hash-table"], interviewRelevance: "high" },

  // Binary Search / Binary Search on Answer
  { slug: "binary-search", title: "Binary Search", difficulty: "Easy", topicSlugs: ["binary-search"], interviewRelevance: "high" },
  { slug: "search-in-rotated-sorted-array", title: "Search in Rotated Sorted Array", difficulty: "Medium", topicSlugs: ["binary-search"], interviewRelevance: "high" },
  { slug: "find-minimum-in-rotated-sorted-array", title: "Find Minimum in Rotated Sorted Array", difficulty: "Medium", topicSlugs: ["binary-search"], interviewRelevance: "medium" },
  { slug: "koko-eating-bananas", title: "Koko Eating Bananas", difficulty: "Medium", topicSlugs: ["binary-search-on-answer", "binary-search"], interviewRelevance: "medium" },
  { slug: "capacity-to-ship-packages-within-d-days", title: "Capacity To Ship Packages Within D Days", difficulty: "Medium", topicSlugs: ["binary-search-on-answer"], interviewRelevance: "medium" },
  { slug: "split-array-largest-sum", title: "Split Array Largest Sum", difficulty: "Hard", topicSlugs: ["binary-search-on-answer"], interviewRelevance: "medium" },

  // Stack / Monotonic Stack
  { slug: "valid-parentheses", title: "Valid Parentheses", difficulty: "Easy", topicSlugs: ["stack"], interviewRelevance: "high" },
  { slug: "min-stack", title: "Min Stack", difficulty: "Medium", topicSlugs: ["stack"], interviewRelevance: "high" },
  { slug: "evaluate-reverse-polish-notation", title: "Evaluate Reverse Polish Notation", difficulty: "Medium", topicSlugs: ["stack"], interviewRelevance: "medium" },
  { slug: "next-greater-element-i", title: "Next Greater Element I", difficulty: "Easy", topicSlugs: ["monotonic-stack", "stack"], interviewRelevance: "medium" },
  { slug: "daily-temperatures", title: "Daily Temperatures", difficulty: "Medium", topicSlugs: ["monotonic-stack", "stack"], interviewRelevance: "high" },
  { slug: "largest-rectangle-in-histogram", title: "Largest Rectangle in Histogram", difficulty: "Hard", topicSlugs: ["monotonic-stack", "stack"], interviewRelevance: "medium" },

  // Recursion / Backtracking
  { slug: "fibonacci-number", title: "Fibonacci Number", difficulty: "Easy", topicSlugs: ["recursion"], interviewRelevance: "medium" },
  { slug: "power-of-x-n", title: "Pow(x, n)", difficulty: "Medium", topicSlugs: ["recursion"], interviewRelevance: "medium" },
  { slug: "subsets", title: "Subsets", difficulty: "Medium", topicSlugs: ["backtracking", "array"], interviewRelevance: "high" },
  { slug: "permutations", title: "Permutations", difficulty: "Medium", topicSlugs: ["backtracking", "array"], interviewRelevance: "high" },
  { slug: "n-queens", title: "N-Queens", difficulty: "Hard", topicSlugs: ["backtracking"], interviewRelevance: "medium" },

  // Linked List
  { slug: "reverse-linked-list", title: "Reverse Linked List", difficulty: "Easy", topicSlugs: ["linked-list", "recursion"], interviewRelevance: "high" },
  { slug: "merge-two-sorted-lists", title: "Merge Two Sorted Lists", difficulty: "Easy", topicSlugs: ["linked-list"], interviewRelevance: "high" },
  { slug: "linked-list-cycle", title: "Linked List Cycle", difficulty: "Easy", topicSlugs: ["linked-list", "two-pointers"], interviewRelevance: "high" },
  { slug: "add-two-numbers", title: "Add Two Numbers", difficulty: "Medium", topicSlugs: ["linked-list"], interviewRelevance: "high" },

  // Tree / Tree DP
  { slug: "invert-binary-tree", title: "Invert Binary Tree", difficulty: "Easy", topicSlugs: ["tree"], interviewRelevance: "high" },
  { slug: "diameter-of-binary-tree", title: "Diameter of Binary Tree", difficulty: "Easy", topicSlugs: ["tree", "tree-dp"], interviewRelevance: "medium" },
  { slug: "validate-binary-search-tree", title: "Validate Binary Search Tree", difficulty: "Medium", topicSlugs: ["tree"], interviewRelevance: "high" },
  { slug: "house-robber-iii", title: "House Robber III", difficulty: "Medium", topicSlugs: ["tree-dp", "tree", "dynamic-programming"], interviewRelevance: "medium" },
  { slug: "binary-tree-maximum-path-sum", title: "Binary Tree Maximum Path Sum", difficulty: "Hard", topicSlugs: ["tree"], interviewRelevance: "high" },
  { slug: "binary-tree-cameras", title: "Binary Tree Cameras", difficulty: "Hard", topicSlugs: ["tree-dp", "tree"], interviewRelevance: "medium" },

  // Dynamic Programming
  { slug: "climbing-stairs", title: "Climbing Stairs", difficulty: "Easy", topicSlugs: ["dynamic-programming", "recursion"], interviewRelevance: "high" },
  { slug: "coin-change", title: "Coin Change", difficulty: "Medium", topicSlugs: ["dynamic-programming"], interviewRelevance: "high" },
  { slug: "edit-distance", title: "Edit Distance", difficulty: "Hard", topicSlugs: ["dynamic-programming"], interviewRelevance: "medium" },

  // DFS / BFS / Graph
  { slug: "number-of-islands", title: "Number of Islands", difficulty: "Medium", topicSlugs: ["depth-first-search", "breadth-first-search", "graph"], interviewRelevance: "high" },
  { slug: "clone-graph", title: "Clone Graph", difficulty: "Medium", topicSlugs: ["depth-first-search", "graph"], interviewRelevance: "medium" },
  { slug: "binary-tree-level-order-traversal", title: "Binary Tree Level Order Traversal", difficulty: "Medium", topicSlugs: ["breadth-first-search", "tree"], interviewRelevance: "high" },
  { slug: "rotting-oranges", title: "Rotting Oranges", difficulty: "Medium", topicSlugs: ["breadth-first-search", "graph"], interviewRelevance: "medium" },
  { slug: "word-ladder", title: "Word Ladder", difficulty: "Hard", topicSlugs: ["breadth-first-search", "graph-algorithms"], interviewRelevance: "medium" },
  { slug: "course-schedule", title: "Course Schedule", difficulty: "Medium", topicSlugs: ["graph", "topological-sort", "depth-first-search"], interviewRelevance: "high" },
  { slug: "course-schedule-ii", title: "Course Schedule II", difficulty: "Medium", topicSlugs: ["topological-sort", "graph"], interviewRelevance: "medium" },
  { slug: "number-of-provinces", title: "Number of Provinces", difficulty: "Medium", topicSlugs: ["union-find", "graph"], interviewRelevance: "medium" },
  { slug: "redundant-connection", title: "Redundant Connection", difficulty: "Medium", topicSlugs: ["union-find", "graph"], interviewRelevance: "medium" },
  { slug: "network-delay-time", title: "Network Delay Time", difficulty: "Medium", topicSlugs: ["graph-algorithms", "graph"], interviewRelevance: "medium" },
  { slug: "cheapest-flights-within-k-stops", title: "Cheapest Flights Within K Stops", difficulty: "Medium", topicSlugs: ["graph-algorithms"], interviewRelevance: "medium" },
  { slug: "swim-in-rising-water", title: "Swim in Rising Water", difficulty: "Hard", topicSlugs: ["graph-algorithms", "binary-search-on-answer"], interviewRelevance: "medium" },

  // String
  { slug: "valid-anagram", title: "Valid Anagram", difficulty: "Easy", topicSlugs: ["string", "hash-table"], interviewRelevance: "high" },
  { slug: "longest-palindromic-substring", title: "Longest Palindromic Substring", difficulty: "Medium", topicSlugs: ["string", "dynamic-programming"], interviewRelevance: "high" },
];
