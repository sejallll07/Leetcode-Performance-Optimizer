import type { ProblemCatalogEntry } from "@/lib/analytics/types";

/**
 * A supplemental pool of well-known LeetCode problems used ONLY by
 * the Roadmap's "New practice" selector (new-practice.ts), so the
 * Roadmap has enough unseen problems to suggest for every topic.
 *
 * It is deliberately separate from PROBLEM_CATALOG:
 *  - It is never seeded into the `problems` table, so it doesn't change
 *    what the recommendation engine, the Dashboard or Revision see.
 *  - It never duplicates a catalog entry — the catalog is searched
 *    first and this only fills gaps (enforced by the integrity test).
 *
 * Shape matches ProblemCatalogEntry so both pools can be treated
 * alike. Topic slugs are the skill graph's (plus hash-table, string
 * and linked-list, the same extras the catalog uses). Entries are
 * well-known problems with standard slugs, but they were written
 * without access to LeetCode, so spot-check links when testing — a
 * wrong slug would just be a dead link, nothing else depends on it.
 */
export const PRACTICE_POOL: ProblemCatalogEntry[] = [
  // Array / Hash Table
  { slug: "contains-duplicate", title: "Contains Duplicate", difficulty: "Easy", topicSlugs: ["array", "hash-table"], interviewRelevance: "high" },
  { slug: "move-zeroes", title: "Move Zeroes", difficulty: "Easy", topicSlugs: ["array", "two-pointers"], interviewRelevance: "medium" },
  { slug: "product-of-array-except-self", title: "Product of Array Except Self", difficulty: "Medium", topicSlugs: ["array", "prefix-sum"], interviewRelevance: "high" },
  { slug: "maximum-subarray", title: "Maximum Subarray", difficulty: "Medium", topicSlugs: ["array", "dynamic-programming"], interviewRelevance: "high" },
  { slug: "merge-intervals", title: "Merge Intervals", difficulty: "Medium", topicSlugs: ["array"], interviewRelevance: "high" },
  { slug: "first-missing-positive", title: "First Missing Positive", difficulty: "Hard", topicSlugs: ["array", "hash-table"], interviewRelevance: "medium" },
  { slug: "median-of-two-sorted-arrays", title: "Median of Two Sorted Arrays", difficulty: "Hard", topicSlugs: ["array", "binary-search"], interviewRelevance: "high" },
  { slug: "isomorphic-strings", title: "Isomorphic Strings", difficulty: "Easy", topicSlugs: ["hash-table", "string"], interviewRelevance: "medium" },
  { slug: "top-k-frequent-elements", title: "Top K Frequent Elements", difficulty: "Medium", topicSlugs: ["hash-table", "array"], interviewRelevance: "high" },
  { slug: "valid-sudoku", title: "Valid Sudoku", difficulty: "Medium", topicSlugs: ["array", "hash-table"], interviewRelevance: "medium" },
  { slug: "insert-delete-getrandom-o1", title: "Insert Delete GetRandom O(1)", difficulty: "Medium", topicSlugs: ["hash-table"], interviewRelevance: "medium" },

  // Two Pointers / Sliding Window / Prefix Sum
  { slug: "squares-of-a-sorted-array", title: "Squares of a Sorted Array", difficulty: "Easy", topicSlugs: ["two-pointers", "array"], interviewRelevance: "medium" },
  { slug: "valid-palindrome-ii", title: "Valid Palindrome II", difficulty: "Easy", topicSlugs: ["two-pointers", "string"], interviewRelevance: "medium" },
  { slug: "two-sum-ii-input-array-is-sorted", title: "Two Sum II - Input Array Is Sorted", difficulty: "Medium", topicSlugs: ["two-pointers", "array"], interviewRelevance: "high" },
  { slug: "sort-colors", title: "Sort Colors", difficulty: "Medium", topicSlugs: ["array", "two-pointers"], interviewRelevance: "high" },
  { slug: "maximum-average-subarray-i", title: "Maximum Average Subarray I", difficulty: "Easy", topicSlugs: ["sliding-window", "array"], interviewRelevance: "medium" },
  { slug: "longest-repeating-character-replacement", title: "Longest Repeating Character Replacement", difficulty: "Medium", topicSlugs: ["sliding-window", "string", "hash-table"], interviewRelevance: "high" },
  { slug: "permutation-in-string", title: "Permutation in String", difficulty: "Medium", topicSlugs: ["sliding-window", "string", "hash-table"], interviewRelevance: "medium" },
  { slug: "minimum-size-subarray-sum", title: "Minimum Size Subarray Sum", difficulty: "Medium", topicSlugs: ["sliding-window", "array"], interviewRelevance: "high" },
  { slug: "sliding-window-maximum", title: "Sliding Window Maximum", difficulty: "Hard", topicSlugs: ["sliding-window", "array"], interviewRelevance: "high" },
  { slug: "find-pivot-index", title: "Find Pivot Index", difficulty: "Easy", topicSlugs: ["prefix-sum", "array"], interviewRelevance: "medium" },
  { slug: "contiguous-array", title: "Contiguous Array", difficulty: "Medium", topicSlugs: ["prefix-sum", "hash-table", "array"], interviewRelevance: "medium" },
  { slug: "continuous-subarray-sum", title: "Continuous Subarray Sum", difficulty: "Medium", topicSlugs: ["prefix-sum", "hash-table", "array"], interviewRelevance: "medium" },
  { slug: "range-sum-query-2d-immutable", title: "Range Sum Query 2D - Immutable", difficulty: "Medium", topicSlugs: ["prefix-sum", "array"], interviewRelevance: "medium" },
  { slug: "shortest-subarray-with-sum-at-least-k", title: "Shortest Subarray with Sum at Least K", difficulty: "Hard", topicSlugs: ["prefix-sum", "monotonic-stack", "array"], interviewRelevance: "medium" },

  // Binary Search / Binary Search on Answer
  { slug: "search-insert-position", title: "Search Insert Position", difficulty: "Easy", topicSlugs: ["binary-search", "array"], interviewRelevance: "high" },
  { slug: "find-first-and-last-position-of-element-in-sorted-array", title: "Find First and Last Position of Element in Sorted Array", difficulty: "Medium", topicSlugs: ["binary-search", "array"], interviewRelevance: "high" },
  { slug: "search-a-2d-matrix", title: "Search a 2D Matrix", difficulty: "Medium", topicSlugs: ["binary-search", "array"], interviewRelevance: "high" },
  { slug: "find-peak-element", title: "Find Peak Element", difficulty: "Medium", topicSlugs: ["binary-search", "array"], interviewRelevance: "medium" },
  { slug: "time-based-key-value-store", title: "Time Based Key-Value Store", difficulty: "Medium", topicSlugs: ["binary-search", "hash-table"], interviewRelevance: "medium" },
  { slug: "sqrtx", title: "Sqrt(x)", difficulty: "Easy", topicSlugs: ["binary-search-on-answer", "binary-search"], interviewRelevance: "medium" },
  { slug: "valid-perfect-square", title: "Valid Perfect Square", difficulty: "Easy", topicSlugs: ["binary-search-on-answer", "binary-search"], interviewRelevance: "medium" },
  { slug: "minimum-number-of-days-to-make-m-bouquets", title: "Minimum Number of Days to Make m Bouquets", difficulty: "Medium", topicSlugs: ["binary-search-on-answer", "binary-search", "array"], interviewRelevance: "medium" },
  { slug: "magnetic-force-between-two-balls", title: "Magnetic Force Between Two Balls", difficulty: "Medium", topicSlugs: ["binary-search-on-answer", "binary-search", "array"], interviewRelevance: "medium" },
  { slug: "find-the-smallest-divisor-given-a-threshold", title: "Find the Smallest Divisor Given a Threshold", difficulty: "Medium", topicSlugs: ["binary-search-on-answer", "binary-search", "array"], interviewRelevance: "medium" },
  { slug: "find-k-th-smallest-pair-distance", title: "Find K-th Smallest Pair Distance", difficulty: "Hard", topicSlugs: ["binary-search-on-answer", "binary-search", "two-pointers"], interviewRelevance: "medium" },

  // Stack / Monotonic Stack
  { slug: "implement-queue-using-stacks", title: "Implement Queue using Stacks", difficulty: "Easy", topicSlugs: ["stack"], interviewRelevance: "medium" },
  { slug: "remove-all-adjacent-duplicates-in-string", title: "Remove All Adjacent Duplicates In String", difficulty: "Easy", topicSlugs: ["stack", "string"], interviewRelevance: "medium" },
  { slug: "decode-string", title: "Decode String", difficulty: "Medium", topicSlugs: ["stack", "recursion", "string"], interviewRelevance: "high" },
  { slug: "asteroid-collision", title: "Asteroid Collision", difficulty: "Medium", topicSlugs: ["stack", "array"], interviewRelevance: "medium" },
  { slug: "generate-parentheses", title: "Generate Parentheses", difficulty: "Medium", topicSlugs: ["stack", "backtracking", "recursion", "string"], interviewRelevance: "high" },
  { slug: "basic-calculator", title: "Basic Calculator", difficulty: "Hard", topicSlugs: ["stack", "recursion", "string"], interviewRelevance: "medium" },
  { slug: "longest-valid-parentheses", title: "Longest Valid Parentheses", difficulty: "Hard", topicSlugs: ["stack", "dynamic-programming", "string"], interviewRelevance: "medium" },
  { slug: "final-prices-with-a-special-discount-in-a-shop", title: "Final Prices With a Special Discount in a Shop", difficulty: "Easy", topicSlugs: ["monotonic-stack", "stack", "array"], interviewRelevance: "medium" },
  { slug: "next-greater-element-ii", title: "Next Greater Element II", difficulty: "Medium", topicSlugs: ["monotonic-stack", "stack", "array"], interviewRelevance: "medium" },
  { slug: "online-stock-span", title: "Online Stock Span", difficulty: "Medium", topicSlugs: ["monotonic-stack", "stack"], interviewRelevance: "medium" },
  { slug: "remove-k-digits", title: "Remove K Digits", difficulty: "Medium", topicSlugs: ["monotonic-stack", "stack", "string"], interviewRelevance: "medium" },
  { slug: "car-fleet", title: "Car Fleet", difficulty: "Medium", topicSlugs: ["monotonic-stack", "stack", "array"], interviewRelevance: "medium" },
  { slug: "maximal-rectangle", title: "Maximal Rectangle", difficulty: "Hard", topicSlugs: ["monotonic-stack", "stack", "dynamic-programming", "array"], interviewRelevance: "medium" },

  // Recursion / Backtracking
  { slug: "palindrome-linked-list", title: "Palindrome Linked List", difficulty: "Easy", topicSlugs: ["linked-list", "recursion", "two-pointers"], interviewRelevance: "high" },
  { slug: "maximum-depth-of-binary-tree", title: "Maximum Depth of Binary Tree", difficulty: "Easy", topicSlugs: ["tree", "recursion", "depth-first-search"], interviewRelevance: "high" },
  { slug: "letter-combinations-of-a-phone-number", title: "Letter Combinations of a Phone Number", difficulty: "Medium", topicSlugs: ["backtracking", "recursion", "string"], interviewRelevance: "high" },
  { slug: "swap-nodes-in-pairs", title: "Swap Nodes in Pairs", difficulty: "Medium", topicSlugs: ["linked-list", "recursion"], interviewRelevance: "medium" },
  { slug: "reverse-nodes-in-k-group", title: "Reverse Nodes in k-Group", difficulty: "Hard", topicSlugs: ["linked-list", "recursion"], interviewRelevance: "medium" },
  { slug: "combination-sum", title: "Combination Sum", difficulty: "Medium", topicSlugs: ["backtracking", "array"], interviewRelevance: "high" },
  { slug: "combination-sum-ii", title: "Combination Sum II", difficulty: "Medium", topicSlugs: ["backtracking", "array"], interviewRelevance: "medium" },
  { slug: "subsets-ii", title: "Subsets II", difficulty: "Medium", topicSlugs: ["backtracking", "array"], interviewRelevance: "medium" },
  { slug: "palindrome-partitioning", title: "Palindrome Partitioning", difficulty: "Medium", topicSlugs: ["backtracking", "string", "dynamic-programming"], interviewRelevance: "medium" },
  { slug: "word-search", title: "Word Search", difficulty: "Medium", topicSlugs: ["backtracking", "array"], interviewRelevance: "high" },
  { slug: "n-queens-ii", title: "N-Queens II", difficulty: "Hard", topicSlugs: ["backtracking"], interviewRelevance: "medium" },

  // Linked List
  { slug: "middle-of-the-linked-list", title: "Middle of the Linked List", difficulty: "Easy", topicSlugs: ["linked-list", "two-pointers"], interviewRelevance: "high" },
  { slug: "intersection-of-two-linked-lists", title: "Intersection of Two Linked Lists", difficulty: "Easy", topicSlugs: ["linked-list", "two-pointers", "hash-table"], interviewRelevance: "high" },
  { slug: "remove-nth-node-from-end-of-list", title: "Remove Nth Node From End of List", difficulty: "Medium", topicSlugs: ["linked-list", "two-pointers"], interviewRelevance: "high" },
  { slug: "reorder-list", title: "Reorder List", difficulty: "Medium", topicSlugs: ["linked-list", "two-pointers", "recursion"], interviewRelevance: "high" },
  { slug: "linked-list-cycle-ii", title: "Linked List Cycle II", difficulty: "Medium", topicSlugs: ["linked-list", "two-pointers", "hash-table"], interviewRelevance: "medium" },
  { slug: "lru-cache", title: "LRU Cache", difficulty: "Medium", topicSlugs: ["hash-table", "linked-list"], interviewRelevance: "high" },
  { slug: "merge-k-sorted-lists", title: "Merge k Sorted Lists", difficulty: "Hard", topicSlugs: ["linked-list"], interviewRelevance: "high" },

  // String
  { slug: "longest-common-prefix", title: "Longest Common Prefix", difficulty: "Easy", topicSlugs: ["string"], interviewRelevance: "high" },
  { slug: "palindromic-substrings", title: "Palindromic Substrings", difficulty: "Medium", topicSlugs: ["string", "dynamic-programming"], interviewRelevance: "medium" },
  { slug: "wildcard-matching", title: "Wildcard Matching", difficulty: "Hard", topicSlugs: ["string", "dynamic-programming", "recursion"], interviewRelevance: "medium" },
  { slug: "regular-expression-matching", title: "Regular Expression Matching", difficulty: "Hard", topicSlugs: ["string", "dynamic-programming", "recursion"], interviewRelevance: "medium" },

  // Tree / Tree DP
  { slug: "same-tree", title: "Same Tree", difficulty: "Easy", topicSlugs: ["tree", "depth-first-search"], interviewRelevance: "medium" },
  { slug: "symmetric-tree", title: "Symmetric Tree", difficulty: "Easy", topicSlugs: ["tree", "depth-first-search", "breadth-first-search"], interviewRelevance: "high" },
  { slug: "balanced-binary-tree", title: "Balanced Binary Tree", difficulty: "Easy", topicSlugs: ["tree", "depth-first-search"], interviewRelevance: "high" },
  { slug: "lowest-common-ancestor-of-a-binary-tree", title: "Lowest Common Ancestor of a Binary Tree", difficulty: "Medium", topicSlugs: ["tree", "depth-first-search"], interviewRelevance: "high" },
  { slug: "kth-smallest-element-in-a-bst", title: "Kth Smallest Element in a BST", difficulty: "Medium", topicSlugs: ["tree", "depth-first-search"], interviewRelevance: "high" },
  { slug: "binary-tree-right-side-view", title: "Binary Tree Right Side View", difficulty: "Medium", topicSlugs: ["tree", "breadth-first-search", "depth-first-search"], interviewRelevance: "high" },
  { slug: "construct-binary-tree-from-preorder-and-inorder-traversal", title: "Construct Binary Tree from Preorder and Inorder Traversal", difficulty: "Medium", topicSlugs: ["tree", "array", "hash-table", "recursion"], interviewRelevance: "high" },
  { slug: "serialize-and-deserialize-binary-tree", title: "Serialize and Deserialize Binary Tree", difficulty: "Hard", topicSlugs: ["tree", "depth-first-search", "breadth-first-search"], interviewRelevance: "high" },
  { slug: "binary-tree-tilt", title: "Binary Tree Tilt", difficulty: "Easy", topicSlugs: ["tree-dp", "tree"], interviewRelevance: "medium" },
  { slug: "longest-univalue-path", title: "Longest Univalue Path", difficulty: "Medium", topicSlugs: ["tree-dp", "tree"], interviewRelevance: "medium" },
  { slug: "longest-zigzag-path-in-a-binary-tree", title: "Longest ZigZag Path in a Binary Tree", difficulty: "Medium", topicSlugs: ["tree-dp", "tree", "dynamic-programming"], interviewRelevance: "medium" },
  { slug: "maximum-sum-bst-in-binary-tree", title: "Maximum Sum BST in Binary Tree", difficulty: "Hard", topicSlugs: ["tree-dp", "tree", "dynamic-programming"], interviewRelevance: "medium" },
  { slug: "sum-of-distances-in-tree", title: "Sum of Distances in Tree", difficulty: "Hard", topicSlugs: ["tree-dp", "tree", "graph"], interviewRelevance: "medium" },

  // Dynamic Programming
  { slug: "min-cost-climbing-stairs", title: "Min Cost Climbing Stairs", difficulty: "Easy", topicSlugs: ["dynamic-programming"], interviewRelevance: "medium" },
  { slug: "house-robber", title: "House Robber", difficulty: "Medium", topicSlugs: ["dynamic-programming"], interviewRelevance: "high" },
  { slug: "house-robber-ii", title: "House Robber II", difficulty: "Medium", topicSlugs: ["dynamic-programming"], interviewRelevance: "high" },
  { slug: "longest-increasing-subsequence", title: "Longest Increasing Subsequence", difficulty: "Medium", topicSlugs: ["dynamic-programming", "array", "binary-search"], interviewRelevance: "high" },
  { slug: "unique-paths", title: "Unique Paths", difficulty: "Medium", topicSlugs: ["dynamic-programming", "array"], interviewRelevance: "high" },
  { slug: "decode-ways", title: "Decode Ways", difficulty: "Medium", topicSlugs: ["dynamic-programming", "string"], interviewRelevance: "high" },
  { slug: "word-break", title: "Word Break", difficulty: "Medium", topicSlugs: ["dynamic-programming", "string", "hash-table"], interviewRelevance: "high" },
  { slug: "longest-common-subsequence", title: "Longest Common Subsequence", difficulty: "Medium", topicSlugs: ["dynamic-programming", "string"], interviewRelevance: "high" },
  { slug: "minimum-path-sum", title: "Minimum Path Sum", difficulty: "Medium", topicSlugs: ["dynamic-programming", "array"], interviewRelevance: "medium" },
  { slug: "burst-balloons", title: "Burst Balloons", difficulty: "Hard", topicSlugs: ["dynamic-programming", "array"], interviewRelevance: "medium" },
  { slug: "distinct-subsequences", title: "Distinct Subsequences", difficulty: "Hard", topicSlugs: ["dynamic-programming", "string"], interviewRelevance: "medium" },

  // DFS / BFS / Graph
  { slug: "flood-fill", title: "Flood Fill", difficulty: "Easy", topicSlugs: ["depth-first-search", "breadth-first-search", "graph"], interviewRelevance: "medium" },
  { slug: "max-area-of-island", title: "Max Area of Island", difficulty: "Medium", topicSlugs: ["depth-first-search", "breadth-first-search", "graph"], interviewRelevance: "high" },
  { slug: "pacific-atlantic-water-flow", title: "Pacific Atlantic Water Flow", difficulty: "Medium", topicSlugs: ["depth-first-search", "breadth-first-search", "graph"], interviewRelevance: "high" },
  { slug: "surrounded-regions", title: "Surrounded Regions", difficulty: "Medium", topicSlugs: ["depth-first-search", "breadth-first-search", "union-find", "graph"], interviewRelevance: "medium" },
  { slug: "longest-increasing-path-in-a-matrix", title: "Longest Increasing Path in a Matrix", difficulty: "Hard", topicSlugs: ["depth-first-search", "topological-sort", "dynamic-programming", "graph"], interviewRelevance: "medium" },
  { slug: "making-a-large-island", title: "Making A Large Island", difficulty: "Hard", topicSlugs: ["depth-first-search", "union-find", "graph"], interviewRelevance: "medium" },
  { slug: "minimum-depth-of-binary-tree", title: "Minimum Depth of Binary Tree", difficulty: "Easy", topicSlugs: ["breadth-first-search", "depth-first-search", "tree"], interviewRelevance: "medium" },
  { slug: "01-matrix", title: "01 Matrix", difficulty: "Medium", topicSlugs: ["breadth-first-search", "dynamic-programming", "graph"], interviewRelevance: "high" },
  { slug: "shortest-path-in-binary-matrix", title: "Shortest Path in Binary Matrix", difficulty: "Medium", topicSlugs: ["breadth-first-search", "graph"], interviewRelevance: "medium" },
  { slug: "open-the-lock", title: "Open the Lock", difficulty: "Medium", topicSlugs: ["breadth-first-search", "graph"], interviewRelevance: "medium" },
  { slug: "sliding-puzzle", title: "Sliding Puzzle", difficulty: "Hard", topicSlugs: ["breadth-first-search", "graph"], interviewRelevance: "medium" },
  { slug: "find-if-path-exists-in-graph", title: "Find if Path Exists in Graph", difficulty: "Easy", topicSlugs: ["graph", "depth-first-search", "breadth-first-search", "union-find"], interviewRelevance: "medium" },
  { slug: "is-graph-bipartite", title: "Is Graph Bipartite?", difficulty: "Medium", topicSlugs: ["graph", "depth-first-search", "breadth-first-search", "union-find"], interviewRelevance: "high" },
  { slug: "evaluate-division", title: "Evaluate Division", difficulty: "Medium", topicSlugs: ["graph", "union-find", "depth-first-search"], interviewRelevance: "high" },
  { slug: "minimum-height-trees", title: "Minimum Height Trees", difficulty: "Medium", topicSlugs: ["graph", "topological-sort", "depth-first-search", "breadth-first-search"], interviewRelevance: "medium" },
  { slug: "reconstruct-itinerary", title: "Reconstruct Itinerary", difficulty: "Hard", topicSlugs: ["graph", "depth-first-search", "graph-algorithms"], interviewRelevance: "medium" },
  { slug: "critical-connections-in-a-network", title: "Critical Connections in a Network", difficulty: "Hard", topicSlugs: ["graph", "depth-first-search", "graph-algorithms"], interviewRelevance: "medium" },

  // Graph Algorithms (shortest paths / MST)
  { slug: "path-with-maximum-probability", title: "Path with Maximum Probability", difficulty: "Medium", topicSlugs: ["graph-algorithms", "graph"], interviewRelevance: "medium" },
  { slug: "path-with-minimum-effort", title: "Path With Minimum Effort", difficulty: "Medium", topicSlugs: ["graph-algorithms", "binary-search-on-answer", "graph"], interviewRelevance: "medium" },
  { slug: "min-cost-to-connect-all-points", title: "Min Cost to Connect All Points", difficulty: "Medium", topicSlugs: ["graph-algorithms", "graph", "union-find"], interviewRelevance: "medium" },
  { slug: "minimum-cost-to-make-at-least-one-valid-path-in-a-grid", title: "Minimum Cost to Make at Least One Valid Path in a Grid", difficulty: "Hard", topicSlugs: ["graph-algorithms", "breadth-first-search", "graph"], interviewRelevance: "medium" },
  { slug: "shortest-path-visiting-all-nodes", title: "Shortest Path Visiting All Nodes", difficulty: "Hard", topicSlugs: ["graph-algorithms", "breadth-first-search", "graph"], interviewRelevance: "medium" },

  // Topological Sort / Union Find
  { slug: "course-schedule-iv", title: "Course Schedule IV", difficulty: "Medium", topicSlugs: ["topological-sort", "graph"], interviewRelevance: "medium" },
  { slug: "find-eventual-safe-states", title: "Find Eventual Safe States", difficulty: "Medium", topicSlugs: ["topological-sort", "depth-first-search", "graph"], interviewRelevance: "medium" },
  { slug: "sort-items-by-groups-respecting-dependencies", title: "Sort Items by Groups Respecting Dependencies", difficulty: "Hard", topicSlugs: ["topological-sort", "graph"], interviewRelevance: "medium" },
  { slug: "build-a-matrix-with-conditions", title: "Build a Matrix With Conditions", difficulty: "Hard", topicSlugs: ["topological-sort", "graph", "array"], interviewRelevance: "medium" },
  { slug: "accounts-merge", title: "Accounts Merge", difficulty: "Medium", topicSlugs: ["union-find", "depth-first-search", "string"], interviewRelevance: "high" },
  { slug: "satisfiability-of-equality-equations", title: "Satisfiability of Equality Equations", difficulty: "Medium", topicSlugs: ["union-find", "graph"], interviewRelevance: "medium" },
  { slug: "redundant-connection-ii", title: "Redundant Connection II", difficulty: "Hard", topicSlugs: ["union-find", "graph"], interviewRelevance: "medium" },
];