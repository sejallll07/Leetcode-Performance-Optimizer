/**
 * Scenario test for the LeetCode ingestion pipeline. Exercises the
 * real ingestion service + repository against a real Postgres DB,
 * using FakeLeetCodeProvider to simulate every case this sandbox
 * can't reach the real leetcode.com to test live (see
 * PROJECT_STATUS.md). Run with `npm run test:leetcode`.
 */
import "dotenv/config";
import { signupUser } from "../src/services/auth/auth-service";
import { syncLeetCodeProfile } from "../src/services/leetcode/ingestion-service";
import { FakeLeetCodeProvider, type FakeScenario } from "../src/services/leetcode/fake-leetcode-provider";
import { getLeetCodeProfileByUserId, countSubmissionsForUser } from "../src/repositories/leetcode-repository";
import { pool } from "../src/lib/db";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`OK: ${message}`);
}

async function makeTestUser(label: string): Promise<string> {
  const result = await signupUser({
    name: `Scenario ${label}`,
    email: `leetcode.scenario.${label}.${Date.now()}@example.com`,
    password: "correct-horse-battery-staple",
  });
  if (!result.ok) throw new Error(`could not create test user: ${result.error}`);
  return result.userId;
}

async function run(scenario: FakeScenario, label: string) {
  console.log(`\n--- scenario: ${scenario} ---`);
  const userId = await makeTestUser(label);
  const provider = new FakeLeetCodeProvider(scenario);
  const result = await syncLeetCodeProfile(provider, userId, "fake-user");
  const profile = await getLeetCodeProfileByUserId(userId);
  const submissionCount = await countSubmissionsForUser(userId);
  return { result, profile, submissionCount };
}

async function main() {
  // 1. Healthy profile with real submissions
  {
    const { result, profile, submissionCount } = await run("healthy", "healthy");
    assert(result.ok, "healthy scenario reports success");
    assert(profile?.syncStatus === "SUCCESS", "profile syncStatus is SUCCESS");
    assert(profile?.totalSolved === 3, "totalSolved matches fake data (3)");
    assert(submissionCount === 3, "3 submissions stored");
    assert(profile?.lastSyncError === null, "no error recorded on success");
  }

  // 2. New account, zero submissions — valid, NOT an error
  {
    const { result, profile, submissionCount } = await run(
      "new-account-no-submissions",
      "newacct"
    );
    assert(result.ok, "new-account scenario reports success (sparse data is not a failure)");
    assert(profile?.syncStatus === "SUCCESS", "profile syncStatus is SUCCESS for a new account");
    assert(profile?.totalSolved === 0, "totalSolved is honestly 0, not fabricated");
    assert(submissionCount === 0, "0 submissions stored");
  }

  // 3. Username doesn't exist
  {
    const { result, profile } = await run("user-not-found", "notfound");
    assert(!result.ok, "user-not-found scenario reports failure");
    if (!result.ok) assert(result.errorCode === "USER_NOT_FOUND", "error code is USER_NOT_FOUND");
    assert(profile?.syncStatus === "ERROR", "profile syncStatus is ERROR");
    assert(profile?.lastSyncErrorCode === "USER_NOT_FOUND", "lastSyncErrorCode persisted");
  }

  // 4. Rate limited
  {
    const { result, profile } = await run("rate-limited", "ratelimited");
    assert(!result.ok, "rate-limited scenario reports failure");
    if (!result.ok) assert(result.errorCode === "RATE_LIMITED", "error code is RATE_LIMITED");
    assert(profile?.syncStatus === "ERROR", "profile syncStatus is ERROR");
  }

  // 5. LeetCode unavailable (5xx / blocked)
  {
    const { result, profile } = await run("unavailable", "unavailable");
    assert(!result.ok, "unavailable scenario reports failure");
    if (!result.ok) assert(result.errorCode === "UNAVAILABLE", "error code is UNAVAILABLE");
    assert(profile?.syncStatus === "ERROR", "profile syncStatus is ERROR");
  }

  // 6. Network failure (timeout / DNS / connection reset)
  {
    const { result, profile } = await run("network-failure", "network");
    assert(!result.ok, "network-failure scenario reports failure");
    if (!result.ok) assert(result.errorCode === "NETWORK_ERROR", "error code is NETWORK_ERROR");
    assert(profile?.syncStatus === "ERROR", "profile syncStatus is ERROR");
  }

  // 7. Incomplete / malformed data from LeetCode
  {
    const { result, profile } = await run("incomplete-data", "incomplete");
    assert(!result.ok, "incomplete-data scenario reports failure");
    if (!result.ok) assert(result.errorCode === "INCOMPLETE_DATA", "error code is INCOMPLETE_DATA");
    assert(profile?.syncStatus === "ERROR", "profile syncStatus is ERROR");
  }

  // 8. Invalid username format — rejected before any network call
  {
    const userId = await makeTestUser("badformat");
    const provider = new FakeLeetCodeProvider("healthy");
    const result = await syncLeetCodeProfile(provider, userId, "not a valid username!!");
    assert(!result.ok, "malformed username is rejected");
    if (!result.ok) assert(result.errorCode === "USER_NOT_FOUND", "format error surfaces as a validation error");
  }

  // 9. Re-sync (refresh) is idempotent — same submissions aren't duplicated
  {
    const userId = await makeTestUser("resync");
    const provider = new FakeLeetCodeProvider("healthy");
    await syncLeetCodeProfile(provider, userId, "fake-user");
    await syncLeetCodeProfile(provider, userId, "fake-user");
    const submissionCount = await countSubmissionsForUser(userId);
    assert(submissionCount === 3, "re-sync does not duplicate submissions (still 3)");
  }

  console.log("\nAll LeetCode ingestion scenarios passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
