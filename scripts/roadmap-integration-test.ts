/**
 * Integration test: real roadmap building — real Postgres, real
 * skill graph, real analytics recompute, real getRoadmapData read
 * path. Run with `npm run test:roadmap`.
 */
import "dotenv/config";
import { signupUser } from "../src/services/auth/auth-service";
import { startSync, markSyncSuccess, upsertProblemWithTopics, upsertSubmission, upsertTopic } from "../src/repositories/leetcode-repository";
import { recomputeAnalyticsForUser, getRoadmapData } from "../src/services/analytics/analytics-service";
import { pool } from "../src/lib/db";
import type { Difficulty } from "../src/lib/analytics/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`OK: ${message}`);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

let seq = 0;
async function insertSubmission(
  userId: string,
  topicSlug: string,
  topicName: string,
  difficulty: Difficulty,
  daysBack: number
) {
  seq += 1;
  // Lowercase, kebab-case: the "problems" table is shared/global across every test
  // script's data, so a malformed slug here (e.g. embedding "Easy" capitalized) can
  // leak into another script's later candidate pool, not just this run's own checks.
  const problemSlug = `${topicSlug}-${difficulty.toLowerCase()}-roadmap-fixture-${seq}`;
  const topicId = await upsertTopic({ name: topicName, slug: topicSlug });
  const problemId = await upsertProblemWithTopics({
    leetcodeId: problemSlug,
    slug: problemSlug,
    title: problemSlug,
    difficulty,
    topicIds: [topicId],
  });
  await upsertSubmission({
    userId,
    problemId,
    leetcodeSubmissionId: `${problemSlug}-submission`,
    status: "Accepted",
    submittedAt: daysAgo(daysBack),
  });
}

async function main() {
  const signup = await signupUser({
    name: "Roadmap Integration",
    email: `roadmap.integration.${Date.now()}@example.com`,
    password: "correct-horse-battery-staple",
  });
  if (!signup.ok) throw new Error("could not create test user");
  const userId = signup.userId;

  // No profile connected yet -> getRoadmapData returns null, same as getDashboardData.
  const beforeConnect = await getRoadmapData(userId);
  assert(beforeConnect === null, "getRoadmapData returns null before any LeetCode profile is connected");

  await startSync(userId, "fake-user");
  await markSyncSuccess(userId, { totalSolved: 8, easySolved: 3, mediumSolved: 2, hardSolved: 3, ranking: null });

  // 1. "array": 6 recent, difficulty-diverse submissions -> should read Strong.
  await insertSubmission(userId, "array", "Array", "Easy", 3);
  await insertSubmission(userId, "array", "Array", "Medium", 2);
  await insertSubmission(userId, "array", "Array", "Medium", 2);
  await insertSubmission(userId, "array", "Array", "Hard", 1);
  await insertSubmission(userId, "array", "Array", "Hard", 1);
  await insertSubmission(userId, "array", "Array", "Hard", 0);

  // 2. "recursion" and "backtracking" (backtracking's prerequisite is recursion,
  //    strength 0.9): both thin, old, Easy-only -> both should read Fundamental Gap,
  //    and backtracking's weakness should trace back to recursion.
  await insertSubmission(userId, "recursion", "Recursion", "Easy", 200);
  await insertSubmission(userId, "recursion", "Recursion", "Easy", 190);
  await insertSubmission(userId, "backtracking", "Backtracking", "Easy", 200);
  await insertSubmission(userId, "backtracking", "Backtracking", "Easy", 190);

  // "tree" (also a dependent of recursion) and "stack" (no tracked prerequisites)
  // are left with zero evidence on purpose.

  await recomputeAnalyticsForUser(userId);
  const before = await getRoadmapData(userId);
  assert(before !== null, "getRoadmapData returns a result once a profile is connected and synced");

  const byslug = (slug: string) => before!.topics.find((t) => t.topicSlug === slug);

  // --- Already strong ---
  const array = byslug("array");
  assert(array !== undefined, "array was analyzed");
  assert(array!.status === "Strong", `array reads Strong (got ${array!.status})`);
  assert(array!.recommendedAction === "Maintain", `array's action is Maintain (got ${array!.recommendedAction})`);
  assert(before!.groups.strong.some((t) => t.topicSlug === "array"), "array appears in groups.strong");

  // --- Fundamental gap + prerequisite topic ---
  const backtracking = byslug("backtracking");
  assert(backtracking !== undefined, "backtracking was analyzed");
  assert(backtracking!.status === "Fundamental Gap", `backtracking reads Fundamental Gap (got ${backtracking!.status})`);
  assert(backtracking!.isPrerequisiteGap === true, "backtracking's weakness is flagged as a prerequisite gap");
  assert(backtracking!.actionReason.includes("Recursion"), "backtracking's reason names Recursion as the weak prerequisite");
  assert(
    before!.groups.fundamentalGaps.some((t) => t.topicSlug === "backtracking"),
    "backtracking appears in groups.fundamentalGaps"
  );
  assert(
    before!.groups.prerequisiteTopics.some((t) => t.topicSlug === "backtracking"),
    "backtracking also appears in groups.prerequisiteTopics (the root-cause overlay)"
  );

  // --- Postponed (zero evidence, weak prerequisite) ---
  const tree = byslug("tree");
  assert(tree !== undefined, "tree appears on the roadmap even with zero evidence");
  assert(tree!.status === "Postponed", `tree reads Postponed while recursion is weak (got ${tree!.status})`);
  assert(tree!.masteryScore === null, "tree has no mastery score while postponed");
  assert(before!.groups.postponed.some((t) => t.topicSlug === "tree"), "tree appears in groups.postponed");

  // --- Recommended next (zero evidence, no weak prerequisite) ---
  const stack = byslug("stack");
  assert(stack !== undefined, "stack appears on the roadmap even with zero evidence");
  assert(stack!.status === "Recommended Next", `stack with no tracked prerequisites reads Recommended Next (got ${stack!.status})`);
  assert(before!.groups.recommendedNext.some((t) => t.topicSlug === "stack"), "stack appears in groups.recommendedNext");

  // --- Tiering + the highlighted pick ---
  assert(tree!.tier === backtracking!.tier, `tree and backtracking sit at the same tier (both direct dependents of recursion) — got ${tree!.tier} vs ${backtracking!.tier}`);
  assert(byslug("recursion")!.tier < tree!.tier, "recursion sits at an earlier tier than its dependents");
  assert(before!.recommendedNextTopic !== null, "a recommended-next topic was picked");
  assert(before!.recommendedNextTopic!.tier === 0, "the highlighted pick is a tier-0 topic");
  assert(before!.recommendedNextTopic!.status === "Recommended Next", "the highlighted pick's status is Recommended Next");

  // === Now change the underlying analytics and confirm the roadmap actually updates ===
  // Push recursion up to Strong with fresh, difficulty-diverse practice.
  await insertSubmission(userId, "recursion", "Recursion", "Easy", 1);
  await insertSubmission(userId, "recursion", "Recursion", "Medium", 1);
  await insertSubmission(userId, "recursion", "Recursion", "Hard", 0);
  await insertSubmission(userId, "recursion", "Recursion", "Hard", 0);

  await recomputeAnalyticsForUser(userId);
  const after = await getRoadmapData(userId);
  assert(after !== null, "getRoadmapData still returns a result after the second recompute");

  const byslugAfter = (slug: string) => after!.topics.find((t) => t.topicSlug === slug);
  const recursionAfter = byslugAfter("recursion");
  assert(recursionAfter !== undefined, "recursion was analyzed after the update");
  assert(recursionAfter!.status === "Strong", `recursion now reads Strong (got ${recursionAfter!.status})`);

  const backtrackingAfter = byslugAfter("backtracking");
  assert(backtrackingAfter !== undefined, "backtracking was re-analyzed after the update");
  assert(
    backtrackingAfter!.status === "Fundamental Gap",
    "backtracking's own classification is unchanged (its evidence didn't change)"
  );
  assert(
    backtrackingAfter!.isPrerequisiteGap === false,
    "backtracking is no longer flagged as a prerequisite gap now that recursion is no longer weak"
  );

  const treeAfter = byslugAfter("tree");
  assert(treeAfter !== undefined, "tree still appears on the roadmap after the update");
  assert(
    treeAfter!.status === "Recommended Next",
    `tree flips from Postponed to Recommended Next now that recursion is no longer weak (got ${treeAfter!.status})`
  );

  console.log("\nAll roadmap integration checks passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
