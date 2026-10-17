/**
 * Seeds several distinct hypothetical student profiles so the
 * dashboard can be checked against realistic, varied data — not
 * just one happy path. Prints each user's login email so a
 * follow-up HTTP check script can log in as each one.
 */
import "dotenv/config";
import { signupUser } from "../src/services/auth/auth-service";
import { startSync, markSyncSuccess } from "../src/repositories/leetcode-repository";
import { upsertProblemWithTopics, upsertSubmission, upsertTopic } from "../src/repositories/leetcode-repository";
import { recomputeAnalyticsForUser } from "../src/services/analytics/analytics-service";
import { syncRevisionItemsForUser } from "../src/services/revision/revision-service";
import { pool } from "../src/lib/db";

const PASSWORD = "correct-horse-battery-staple";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function insertSubmission(
  userId: string,
  topicSlug: string,
  topicName: string,
  problemSlug: string,
  title: string,
  difficulty: "Easy" | "Medium" | "Hard",
  daysBack: number
) {
  const topicId = await upsertTopic({ name: topicName, slug: topicSlug });
  const problemId = await upsertProblemWithTopics({
    leetcodeId: problemSlug,
    slug: problemSlug,
    title,
    difficulty,
    topicIds: [topicId],
  });
  await upsertSubmission({
    userId,
    problemId,
    leetcodeSubmissionId: `${problemSlug}-${userId.slice(0, 6)}`,
    status: "Accepted",
    submittedAt: daysAgo(daysBack),
  });
}

async function makeUser(label: string, name: string) {
  const email = `dashboard.${label}.${Date.now()}@example.com`;
  const result = await signupUser({ name, email, password: PASSWORD });
  if (!result.ok) throw new Error(`could not create ${label}: ${result.error}`);
  return { userId: result.userId, email };
}

async function main() {
  const accounts: Record<string, string> = {};

  // --- Alex: strong generalist, improving across two sync generations ---
  const alex = await makeUser("alex", "Alex Strong");
  accounts.alex = alex.email;
  await startSync(alex.userId, "alex-leetcode");
  await markSyncSuccess(alex.userId, { totalSolved: 40, easySolved: 15, mediumSolved: 20, hardSolved: 5, ranking: 85000 });
  await insertSubmission(alex.userId, "array", "Array", "two-sum", "Two Sum", "Easy", 3);
  await insertSubmission(alex.userId, "array", "Array", "3sum", "3Sum", "Medium", 2);
  await insertSubmission(alex.userId, "dynamic-programming", "Dynamic Programming", "climbing-stairs", "Climbing Stairs", "Easy", 5);
  await insertSubmission(alex.userId, "dynamic-programming", "Dynamic Programming", "coin-change", "Coin Change", "Medium", 3);
  await recomputeAnalyticsForUser(alex.userId, daysAgo(10)); // generation 1 (as of 10 days ago)
  // More practice happens since then — generation 2 should look better.
  await insertSubmission(alex.userId, "dynamic-programming", "Dynamic Programming", "house-robber", "House Robber", "Medium", 1);
  await insertSubmission(alex.userId, "dynamic-programming", "Dynamic Programming", "edit-distance", "Edit Distance", "Hard", 1);
  await insertSubmission(alex.userId, "graph", "Graph", "number-of-islands", "Number of Islands", "Medium", 2);
  await insertSubmission(alex.userId, "depth-first-search", "Depth-First Search", "max-depth-binary-tree", "Maximum Depth of Binary Tree", "Easy", 2);
  await recomputeAnalyticsForUser(alex.userId, new Date()); // generation 2 (now)
  await syncRevisionItemsForUser(alex.userId);

  // --- Sam: brand new, connected but zero submissions ---
  const sam = await makeUser("sam", "Sam New");
  accounts.sam = sam.email;
  await startSync(sam.userId, "sam-leetcode");
  await markSyncSuccess(sam.userId, { totalSolved: 0, easySolved: 0, mediumSolved: 0, hardSolved: 0, ranking: null });
  await recomputeAnalyticsForUser(sam.userId, new Date());
  await syncRevisionItemsForUser(sam.userId);

  // --- Priya: fundamental-gap case (weak Backtracking, weak prerequisite Recursion) ---
  const priya = await makeUser("priya", "Priya Gaps");
  accounts.priya = priya.email;
  await startSync(priya.userId, "priya-leetcode");
  await markSyncSuccess(priya.userId, { totalSolved: 4, easySolved: 4, mediumSolved: 0, hardSolved: 0, ranking: 900000 });
  await insertSubmission(priya.userId, "backtracking", "Backtracking", "subsets", "Subsets", "Easy", 200);
  await insertSubmission(priya.userId, "backtracking", "Backtracking", "permutations", "Permutations", "Easy", 190);
  await insertSubmission(priya.userId, "recursion", "Recursion", "fibonacci", "Fibonacci Number", "Easy", 200);
  await insertSubmission(priya.userId, "recursion", "Recursion", "power-of-x", "Pow(x, n)", "Easy", 190);
  await recomputeAnalyticsForUser(priya.userId, new Date());
  await syncRevisionItemsForUser(priya.userId);

  // --- Jordan: was strong, now stale -> Revision Needed + declining trend ---
  const jordan = await makeUser("jordan", "Jordan Stale");
  accounts.jordan = jordan.email;
  await startSync(jordan.userId, "jordan-leetcode");
  await markSyncSuccess(jordan.userId, { totalSolved: 14, easySolved: 2, mediumSolved: 6, hardSolved: 6, ranking: 150000 });
  // Solid, high exposure, medium/hard-leaning evidence in "tree" —
  // enough that recency decay alone can push it into Revision Needed
  // without cratering the whole score (that needs real exposure/difficulty
  // depth backing it up, not just a couple of easy problems).
  await insertSubmission(jordan.userId, "tree", "Tree", "validate-bst", "Validate Binary Search Tree", "Medium", 60);
  await insertSubmission(jordan.userId, "tree", "Tree", "kth-smallest-in-bst", "Kth Smallest Element in a BST", "Medium", 59);
  await insertSubmission(jordan.userId, "tree", "Tree", "binary-tree-max-path-sum", "Binary Tree Maximum Path Sum", "Hard", 58);
  await insertSubmission(jordan.userId, "tree", "Tree", "serialize-deserialize-tree", "Serialize and Deserialize Binary Tree", "Hard", 57);
  await insertSubmission(jordan.userId, "tree", "Tree", "recover-bst", "Recover Binary Search Tree", "Hard", 56);
  await insertSubmission(jordan.userId, "tree", "Tree", "binary-tree-cameras", "Binary Tree Cameras", "Hard", 55);
  // First recompute shortly after that activity (simulated "now" set
  // right in the middle of that cluster) — should read as Strong.
  await recomputeAnalyticsForUser(jordan.userId, daysAgo(57));
  // No new activity since — recompute again with real "now". The
  // same evidence is now >45 days stale, which should reclassify
  // Strong -> Revision Needed and show up as a real, honest decline.
  await recomputeAnalyticsForUser(jordan.userId, new Date());
  await syncRevisionItemsForUser(jordan.userId);

  console.log(JSON.stringify(accounts, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
