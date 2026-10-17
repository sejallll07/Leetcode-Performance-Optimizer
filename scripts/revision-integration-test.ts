/**
 * Integration test: real revision-item creation + scheduling +
 * completion, against real Postgres. Run with `npm run test:revision`.
 */
import "dotenv/config";
import { signupUser } from "../src/services/auth/auth-service";
import { startSync, markSyncSuccess, upsertProblemWithTopics, upsertSubmission, upsertTopic } from "../src/repositories/leetcode-repository";
import { syncRevisionItemsForUser, getRevisionCenterData, completeRevision } from "../src/services/revision/revision-service";
import { getRevisionItemsForUser } from "../src/repositories/revision-repository";
import { REVISION_CONFIG } from "../src/lib/revision/config";
import { pool } from "../src/lib/db";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`OK: ${message}`);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function main() {
  const signup = await signupUser({
    name: "Revision Integration",
    email: `revision.integration.${Date.now()}@example.com`,
    password: "correct-horse-battery-staple",
  });
  if (!signup.ok) throw new Error("could not create test user");
  const userId = signup.userId;

  await startSync(userId, "fake-user");
  await markSyncSuccess(userId, { totalSolved: 2, easySolved: 2, mediumSolved: 0, hardSolved: 0, ranking: null });

  // Solve two problems: one 10 days ago (should be overdue for its
  // first 3-day revision), one just now (should be upcoming).
  const topicId = await upsertTopic({ name: "Array", slug: "array" });
  const oldProblemId = await upsertProblemWithTopics({
    leetcodeId: "two-sum", slug: "two-sum", title: "Two Sum", difficulty: "Easy", topicIds: [topicId],
  });
  const newProblemId = await upsertProblemWithTopics({
    leetcodeId: "3sum", slug: "3sum", title: "3Sum", difficulty: "Medium", topicIds: [topicId],
  });
  await upsertSubmission({ userId, problemId: oldProblemId, leetcodeSubmissionId: "old-sub", status: "Accepted", submittedAt: daysAgo(10) });
  await upsertSubmission({ userId, problemId: newProblemId, leetcodeSubmissionId: "new-sub", status: "Accepted", submittedAt: new Date() });

  // 1. Sync creates revision items for both solved problems.
  await syncRevisionItemsForUser(userId);
  const items = await getRevisionItemsForUser(userId);
  assert(items.length === 2, `revision items created for both solved problems (got ${items.length})`);

  // 2. Re-syncing is idempotent — doesn't duplicate or reset existing items.
  await syncRevisionItemsForUser(userId);
  const itemsAfterResync = await getRevisionItemsForUser(userId);
  assert(itemsAfterResync.length === 2, "re-sync does not duplicate revision items");

  // 3. Categorization: the 10-day-old solve's 3-day interval should be overdue; the new one upcoming.
  const centerData = await getRevisionCenterData(userId);
  assert(centerData.overdue.items.length === 1, `exactly one item overdue (got ${centerData.overdue.items.length})`);
  assert(centerData.overdue.items[0].problemSlug === "two-sum", "the overdue item is the one solved 10 days ago");
  assert(centerData.upcoming.items.length === 1, "the just-solved problem is upcoming, not overdue");

  // 4. Complete a revision with "Difficult" feedback — interval should decrease (floored at 0), stays actionable.
  const overdueItem = centerData.overdue.items[0];
  assert(overdueItem.intervalIndex === 0, "a first-time revision starts at interval index 0");
  const difficultResult = await completeRevision(userId, overdueItem.id, "Difficult");
  assert(difficultResult.ok, "completing a revision with Difficult feedback succeeds");

  const afterDifficult = (await getRevisionItemsForUser(userId)).find((i) => i.id === overdueItem.id)!;
  assert(afterDifficult.intervalIndex === 0, "Difficult on an already-shortest interval stays floored at 0");
  assert(afterDifficult.reviewCount === 1, "review count incremented");
  assert(afterDifficult.lastFeedback === "Difficult", "last feedback persisted correctly");
  assert(afterDifficult.dueAt > new Date(), "rescheduled to a future date (3 days from now)");

  // 5. Complete it again with "Easy" — interval should jump forward.
  const easyResult = await completeRevision(userId, overdueItem.id, "Easy");
  assert(easyResult.ok, "completing a revision with Easy feedback succeeds");
  const afterEasy = (await getRevisionItemsForUser(userId)).find((i) => i.id === overdueItem.id)!;
  assert(afterEasy.intervalIndex === 2, `Easy from index 0 jumps to index 2 (got ${afterEasy.intervalIndex})`);
  assert(afterEasy.reviewCount === 2, "review count incremented again");

  // 6. Revision history log has both entries.
  const historyResult = await pool.query(
    `SELECT "feedback", "previousInterval", "newInterval" FROM "revision_history" WHERE "revisionItemId" = $1 ORDER BY "reviewedAt" ASC`,
    [overdueItem.id]
  );
  assert(historyResult.rows.length === 2, "revision history has one row per completed review");
  assert(historyResult.rows[0].feedback === "Difficult" && historyResult.rows[1].feedback === "Easy", "history rows are in chronological order with correct feedback");

  // 7. Recently completed shows both reviews' worth of activity.
  const centerDataAfter = await getRevisionCenterData(userId);
  assert(centerDataAfter.recentlyCompleted.items.some((i) => i.id === overdueItem.id), "the reviewed item shows up in recentlyCompleted");

  // 8. Ownership check: a different user cannot complete someone else's revision item.
  const otherSignup = await signupUser({
    name: "Other User",
    email: `revision.other.${Date.now()}@example.com`,
    password: "correct-horse-battery-staple",
  });
  if (!otherSignup.ok) throw new Error("could not create second test user");
  const ownershipResult = await completeRevision(otherSignup.userId, overdueItem.id, "Easy");
  assert(!ownershipResult.ok, "a different user cannot complete someone else's revision item");

  // 9. A very active user's overdue list is capped for display, but the true count is never hidden.
  const heavySignup = await signupUser({
    name: "Heavy User",
    email: `revision.heavy.${Date.now()}@example.com`,
    password: "correct-horse-battery-staple",
  });
  if (!heavySignup.ok) throw new Error("could not create heavy-user test account");
  const heavyUserId = heavySignup.userId;
  await startSync(heavyUserId, "fake-user");
  await markSyncSuccess(heavyUserId, { totalSolved: 40, easySolved: 40, mediumSolved: 0, hardSolved: 0, ranking: null });

  const overCap = REVISION_CONFIG.sectionCaps.overdue + 8;
  for (let i = 0; i < overCap; i++) {
    const slug = `heavy-problem-${i}`;
    const problemId = await upsertProblemWithTopics({
      leetcodeId: slug, slug, title: slug, difficulty: "Easy", topicIds: [topicId],
    });
    await upsertSubmission({ userId: heavyUserId, problemId, leetcodeSubmissionId: `${slug}-sub`, status: "Accepted", submittedAt: daysAgo(30) });
  }
  await syncRevisionItemsForUser(heavyUserId);
  const heavyCenterData = await getRevisionCenterData(heavyUserId);
  assert(
    heavyCenterData.overdue.totalCount === overCap,
    `the true overdue count is reported in full, uncapped (got ${heavyCenterData.overdue.totalCount}, expected ${overCap})`
  );
  assert(
    heavyCenterData.overdue.items.length === REVISION_CONFIG.sectionCaps.overdue,
    `the rendered overdue list is capped at ${REVISION_CONFIG.sectionCaps.overdue} (got ${heavyCenterData.overdue.items.length})`
  );

  console.log("\nAll revision system integration checks passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
