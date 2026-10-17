/**
 * Integration test: real ingestion (via FakeLeetCodeProvider) feeding
 * the real analytics service, against real Postgres — confirms the
 * whole pipeline is actually wired, not just unit-tested in
 * isolation. Run with `npm run test:analytics`.
 */
import "dotenv/config";
import { signupUser } from "../src/services/auth/auth-service";
import { syncLeetCodeProfile } from "../src/services/leetcode/ingestion-service";
import { FakeLeetCodeProvider } from "../src/services/leetcode/fake-leetcode-provider";
import { recomputeAnalyticsForUser } from "../src/services/analytics/analytics-service";
import { getLatestMasterySnapshots } from "../src/repositories/analytics-repository";
import { pool } from "../src/lib/db";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`OK: ${message}`);
}

async function main() {
  const signup = await signupUser({
    name: "Analytics Integration",
    email: `analytics.integration.${Date.now()}@example.com`,
    password: "correct-horse-battery-staple",
  });
  if (!signup.ok) throw new Error("could not create test user");
  const userId = signup.userId;

  // No profile connected yet — should be a no-op, not a crash.
  const beforeConnect = await recomputeAnalyticsForUser(userId);
  assert(beforeConnect === null, "recompute is a no-op before any LeetCode profile is connected");

  const syncResult = await syncLeetCodeProfile(new FakeLeetCodeProvider("healthy"), userId, "fake-user");
  assert(syncResult.ok, "fake sync succeeds");

  const engineResult = await recomputeAnalyticsForUser(userId);
  assert(engineResult !== null, "recompute returns a real result once a profile is connected");
  assert(engineResult!.mastery.length > 0, "at least one topic was analyzed");

  const snapshots = await getLatestMasterySnapshots(userId);
  assert(snapshots.length === engineResult!.mastery.length, "one persisted snapshot per analyzed topic");

  const arraySnapshot = snapshots.find((s) => s.topicSlug === "array");
  assert(arraySnapshot !== undefined, "the Array topic (touched by all 3 fake problems) was persisted");
  assert(arraySnapshot.problemCount === 3, "Array's persisted problemCount matches the fake data");
  assert(
    typeof arraySnapshot.explanation === "string" && arraySnapshot.explanation.length > 0,
    "an explanation string was persisted"
  );

  // Re-syncing + recomputing should add a new snapshot generation, not corrupt the old one.
  await syncLeetCodeProfile(new FakeLeetCodeProvider("healthy"), userId, "fake-user");
  await recomputeAnalyticsForUser(userId);
  const afterResyncResult = await pool.query(
    `SELECT COUNT(*)::int AS count FROM "user_topic_mastery" WHERE "userId" = $1`,
    [userId]
  );
  assert(
    afterResyncResult.rows[0].count === engineResult!.mastery.length * 2,
    "re-sync + recompute appends a new snapshot generation (time series, not overwrite)"
  );

  console.log("\nAll analytics integration checks passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
