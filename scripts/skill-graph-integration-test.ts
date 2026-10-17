/**
 * Integration test: real skill-graph seeding + real gap detection,
 * against real Postgres. Inserts submissions directly (rather than
 * through a fake LeetCode sync, which Phase 2/3 already cover
 * thoroughly) so this test can focus on what's new — the graph and
 * gap detection. Run with `npm run test:skill-graph`.
 */
import "dotenv/config";
import { signupUser } from "../src/services/auth/auth-service";
import { startSync, markSyncSuccess } from "../src/repositories/leetcode-repository";
import { upsertProblemWithTopics, upsertSubmission, upsertTopic } from "../src/repositories/leetcode-repository";
import { recomputeAnalyticsForUser } from "../src/services/analytics/analytics-service";
import { getLatestMasterySnapshots } from "../src/repositories/analytics-repository";
import { ensureSkillGraphSeeded, loadSkillGraphEdges } from "../src/repositories/skill-graph-repository";
import { pool } from "../src/lib/db";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`OK: ${message}`);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function insertWeakSubmission(userId: string, topicSlug: string, topicName: string, problemSlug: string, daysBack: number) {
  const topicId = await upsertTopic({ name: topicName, slug: topicSlug });
  const problemId = await upsertProblemWithTopics({
    leetcodeId: problemSlug,
    slug: problemSlug,
    title: problemSlug,
    difficulty: "Easy",
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
  // 1. The graph seeds correctly and idempotently.
  await ensureSkillGraphSeeded();
  const edgesFirstPass = await loadSkillGraphEdges();
  assert(edgesFirstPass.length >= 15, `seeded at least 15 relationships (got ${edgesFirstPass.length})`);
  await ensureSkillGraphSeeded(); // run again
  const edgesSecondPass = await loadSkillGraphEdges();
  assert(edgesSecondPass.length === edgesFirstPass.length, "re-seeding is idempotent (no duplicate edges)");
  assert(
    edgesFirstPass.some((e) => e.topicSlug === "backtracking" && e.prerequisiteSlug === "recursion"),
    "Recursion -> Backtracking edge exists"
  );
  assert(
    edgesFirstPass.some((e) => e.topicSlug === "tree-dp" && e.prerequisiteSlug === "tree"),
    "Tree -> Tree DP edge exists"
  );

  // 2. Set up a test user with a connected (fake) LeetCode profile.
  const signup = await signupUser({
    name: "Skill Graph Integration",
    email: `skillgraph.integration.${Date.now()}@example.com`,
    password: "correct-horse-battery-staple",
  });
  if (!signup.ok) throw new Error("could not create test user");
  const userId = signup.userId;

  await startSync(userId, "fake-user");
  await markSyncSuccess(userId, { totalSolved: 4, easySolved: 4, mediumSolved: 0, hardSolved: 0, ranking: null });

  // 3. Weak, old evidence for both "backtracking" and its prerequisite "recursion".
  await insertWeakSubmission(userId, "backtracking", "Backtracking", "subsets", 200);
  await insertWeakSubmission(userId, "backtracking", "Backtracking", "permutations", 190);
  await insertWeakSubmission(userId, "recursion", "Recursion", "fibonacci", 200);
  await insertWeakSubmission(userId, "recursion", "Recursion", "power-of-x", 190);

  // 4. Weak evidence for "tree" only (not "tree-dp" itself) — should
  //    produce a forward-looking gap for Tree DP.
  await insertWeakSubmission(userId, "tree", "Tree", "invert-binary-tree", 200);
  await insertWeakSubmission(userId, "tree", "Tree", "same-tree", 190);

  const engineResult = await recomputeAnalyticsForUser(userId);
  assert(engineResult !== null, "recompute returns a result");

  const backtracking = engineResult!.mastery.find((m) => m.topicSlug === "backtracking");
  assert(backtracking !== undefined, "backtracking was analyzed");
  assert(
    backtracking!.classification === "Weak" || backtracking!.classification === "Fundamental Gap",
    `backtracking scored as shaky (got ${backtracking!.classification})`
  );
  assert(backtracking!.gapVerdict === "prerequisite-gap", `backtracking's gap verdict is prerequisite-gap (got ${backtracking!.gapVerdict})`);
  assert(backtracking!.gapExplanation.includes("Recursion"), "explanation names Recursion as the weak prerequisite");
  assert(backtracking!.gapExplanation.includes("should not be your immediate priority"), "explanation matches the requested phrasing pattern");

  const treeDpGap = engineResult!.forwardLookingGaps.find((g) => g.topicSlug === "tree-dp");
  assert(treeDpGap !== undefined, "Tree DP surfaces as a forward-looking gap (no direct evidence, weak prerequisite)");
  assert(treeDpGap!.explanation.includes("Tree DP"), "forward-looking explanation names Tree DP");

  // 5. Persistence: gap fields actually made it into the DB, not just the return value.
  const snapshots = await getLatestMasterySnapshots(userId);
  const persistedBacktracking = snapshots.find((s) => s.topicSlug === "backtracking");
  assert(persistedBacktracking !== undefined, "backtracking snapshot persisted");
  assert(persistedBacktracking.gapVerdict === "prerequisite-gap", "persisted gapVerdict matches");
  assert(
    typeof persistedBacktracking.gapExplanation === "string" && persistedBacktracking.gapExplanation.length > 0,
    "persisted gapExplanation is a real string"
  );

  console.log("\nAll skill graph integration checks passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
