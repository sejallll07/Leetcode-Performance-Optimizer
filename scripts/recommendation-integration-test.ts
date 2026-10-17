/**
 * Integration test: real catalog seeding + real recommendation
 * generation, against real Postgres. Builds on the same weak
 * Recursion/Backtracking scenario as the skill-graph test so the
 * "prerequisite-gap" recommendation path gets exercised end to end.
 * Run with `npm run test:recommendations`.
 */
import "dotenv/config";
import { signupUser } from "../src/services/auth/auth-service";
import { startSync, markSyncSuccess } from "../src/repositories/leetcode-repository";
import { upsertProblemWithTopics, upsertSubmission, upsertTopic } from "../src/repositories/leetcode-repository";
import { recomputeAnalyticsForUser } from "../src/services/analytics/analytics-service";
import { ensureProblemCatalogSeeded, loadProblemCatalog } from "../src/repositories/problem-catalog-repository";
import { pool } from "../src/lib/db";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`OK: ${message}`);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function insertSubmission(userId: string, topicSlug: string, topicName: string, problemSlug: string, title: string, daysBack: number) {
  const topicId = await upsertTopic({ name: topicName, slug: topicSlug });
  const problemId = await upsertProblemWithTopics({
    leetcodeId: problemSlug,
    slug: problemSlug,
    title,
    difficulty: "Easy",
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

async function main() {
  // 1. Catalog seeds correctly and idempotently.
  await ensureProblemCatalogSeeded();
  const catalogFirstPass = await loadProblemCatalog();
  assert(catalogFirstPass.length >= 40, `catalog has at least 40 known problems (got ${catalogFirstPass.length})`);
  await ensureProblemCatalogSeeded();
  const catalogSecondPass = await loadProblemCatalog();
  assert(catalogSecondPass.length === catalogFirstPass.length, "re-seeding the catalog is idempotent");
  const twoSum = catalogFirstPass.find((p) => p.slug === "two-sum");
  assert(twoSum?.interviewRelevance === "high", "curated interview-relevance survives seeding (Two Sum)");
  const arrayTopic = twoSum?.topicSlugs.includes("array");
  assert(!!arrayTopic, "Two Sum is correctly tagged with the array topic");

  // 2. Weak Backtracking + weak Recursion (same scenario as the skill-graph test)
  //    should produce a High-priority prerequisite-gap recommendation.
  const signup = await signupUser({
    name: "Recommendation Integration",
    email: `recommendation.integration.${Date.now()}@example.com`,
    password: "correct-horse-battery-staple",
  });
  if (!signup.ok) throw new Error("could not create test user");
  const userId = signup.userId;

  await startSync(userId, "fake-user");
  await markSyncSuccess(userId, { totalSolved: 4, easySolved: 4, mediumSolved: 0, hardSolved: 0, ranking: null });
  await insertSubmission(userId, "backtracking", "Backtracking", "subsets", "Subsets", 200);
  await insertSubmission(userId, "backtracking", "Backtracking", "combination-sum", "Combination Sum", 190);
  await insertSubmission(userId, "recursion", "Recursion", "fibonacci-number", "Fibonacci Number", 200);
  await insertSubmission(userId, "recursion", "Recursion", "power-of-x-n", "Pow(x, n)", 190);

  const result = await recomputeAnalyticsForUser(userId);
  assert(result !== null, "recompute returns a result");

  const { practiceToday, all } = result!.recommendations;
  assert(all.length > 0, "at least one recommendation was generated");
  assert(all.length <= 8, "total recommendations respect the configured cap");

  const prereqGapRec = all.find((r) => r.kind === "prerequisite-gap" && r.topicSlug === "backtracking");
  assert(prereqGapRec !== undefined, "a prerequisite-gap recommendation for Backtracking was generated");
  assert(prereqGapRec!.priority === "High", "prerequisite-gap recommendation is High priority");
  assert(prereqGapRec!.reason.includes("Recursion"), "reason names Recursion as the weak prerequisite");
  assert(prereqGapRec!.difficulty !== "Hard", "never recommends Hard for a shaky topic");

  // 3. Never recommends a problem the student already solved.
  const solvedSlugs = new Set(["subsets", "combination-sum", "fibonacci-number", "power-of-x-n"]);
  assert(
    all.every((r) => !solvedSlugs.has(r.problemSlug)),
    "no recommendation repeats an already-solved problem"
  );

  // 4. Practice Today is small and balanced.
  assert(practiceToday.length > 0, "Practice Today has at least one pick");
  assert(practiceToday.length <= 3, "Practice Today stays small (<=3)");

  // 5. Real problem links resolve to plausible LeetCode slugs (format check, not a live fetch).
  assert(
    all.every((r) => /^[a-z0-9-]+$/.test(r.problemSlug)),
    "every recommended problem slug is a valid LeetCode-style slug"
  );

  console.log("\nAll recommendation engine integration checks passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
