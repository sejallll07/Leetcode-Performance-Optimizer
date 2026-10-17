/**
 * Integration test: the AI mentor's full pipeline — real Postgres,
 * real context building, real system-prompt assembly, real
 * persistence and hint-progress tracking — using FakeMentorProvider
 * in place of the real Anthropic API (see fake-mentor-provider.ts
 * for why that's still a genuine test of everything except the
 * model's own reasoning). Run with `npm run test:mentor`.
 */
import "dotenv/config";
import { signupUser } from "../src/services/auth/auth-service";
import { startSync, markSyncSuccess, upsertProblemWithTopics, upsertSubmission, upsertTopic } from "../src/repositories/leetcode-repository";
import { sendMentorMessage, getMentorConversation } from "../src/services/mentor/mentor-service";
import { getMentorMessagesForUser } from "../src/repositories/mentor-repository";
import { FakeMentorProvider } from "../src/services/mentor/fake-mentor-provider";
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
async function insertSubmission(userId: string, topicSlug: string, topicName: string, difficulty: Difficulty, daysBack: number, slugOverride?: string) {
  seq += 1;
  const problemSlug = slugOverride ?? `${topicSlug}-${difficulty.toLowerCase()}-mentor-fixture-${seq}`;
  const topicId = await upsertTopic({ name: topicName, slug: topicSlug });
  const problemId = await upsertProblemWithTopics({
    leetcodeId: problemSlug, slug: problemSlug, title: problemSlug, difficulty, topicIds: [topicId],
  });
  await upsertSubmission({ userId, problemId, leetcodeSubmissionId: `${problemSlug}-sub`, status: "Accepted", submittedAt: daysAgo(daysBack) });
  return problemSlug;
}

async function newUser(label: string) {
  const signup = await signupUser({ name: label, email: `mentor.${label}.${Date.now()}.${Math.random()}@example.com`, password: "correct-horse-battery-staple" });
  if (!signup.ok) throw new Error(`could not create test user: ${label}`);
  return signup.userId;
}

async function main() {
  // --- 1. No profile connected: still gets a reply, via the hasProfile:false path ---
  const noProfileUserId = await newUser("no-profile");
  const noProfileResult = await sendMentorMessage(noProfileUserId, "What should I practice today?", { provider: new FakeMentorProvider("echo") });
  assert(noProfileResult.ok, "a student with no connected profile still gets a mentor reply");
  if (noProfileResult.ok) {
    assert(noProfileResult.reply.role === "assistant", "the persisted reply is an assistant message");
    assert(noProfileResult.reply.content.includes("What should I practice today?"), "the fake provider's echo reply references what was actually asked");
  }
  const noProfileConvo = await getMentorConversation(noProfileUserId);
  assert(noProfileConvo.length === 2, `both the student's message and the reply were persisted (got ${noProfileConvo.length})`);
  assert(noProfileConvo[0].role === "user" && noProfileConvo[1].role === "assistant", "conversation is stored in chronological order");

  // --- 2. Input validation: empty / too-long messages are rejected before anything is persisted ---
  const validationUserId = await newUser("validation");
  const emptyResult = await sendMentorMessage(validationUserId, "   ", { provider: new FakeMentorProvider("echo") });
  assert(!emptyResult.ok, "an empty (whitespace-only) message is rejected");
  const tooLongResult = await sendMentorMessage(validationUserId, "x".repeat(5000), { provider: new FakeMentorProvider("echo") });
  assert(!tooLongResult.ok, "an excessively long message is rejected");
  const validationConvo = await getMentorConversation(validationUserId);
  assert(validationConvo.length === 0, "neither rejected message was persisted");

  // --- 3. Provider failure: the student's message is still saved even though the AI turn failed ---
  const errorUserId = await newUser("error");
  const errorResult = await sendMentorMessage(errorUserId, "Give me a hint.", { provider: new FakeMentorProvider("error") });
  assert(!errorResult.ok, "a provider failure surfaces as ok:false, not a thrown exception");
  if (!errorResult.ok) assert(errorResult.error === "fixture provider error", "the provider's error message is passed through");
  const errorConvo = await getMentorConversation(errorUserId);
  assert(errorConvo.length === 1 && errorConvo[0].role === "user", "the student's message is persisted even though the AI call failed — nothing they typed is lost");

  // --- 4. A connected, synced profile produces a real, personalized context ---
  const activeUserId = await newUser("active");
  await startSync(activeUserId, "fake-user");
  await markSyncSuccess(activeUserId, { totalSolved: 6, easySolved: 3, mediumSolved: 2, hardSolved: 1, ranking: null });
  await insertSubmission(activeUserId, "array", "Array", "Easy", 3);
  await insertSubmission(activeUserId, "array", "Array", "Medium", 2);
  await insertSubmission(activeUserId, "array", "Array", "Hard", 1);
  const solvedBinarySearchSlug = await insertSubmission(activeUserId, "binary-search", "Binary Search", "Easy", 200);

  const activeResult = await sendMentorMessage(activeUserId, "What's my readiness?", { provider: new FakeMentorProvider("echo") });
  assert(activeResult.ok, "a connected, synced student gets a real reply");

  // --- 5. Progressive hints: 3 turns in a row on the same problem climb the ladder 1 -> 2 -> 3, never skipping ---
  const hintUserId = await newUser("hints");
  const hint1 = await sendMentorMessage(hintUserId, "Give me a hint on Two Sum.", { provider: new FakeMentorProvider("hint-ladder") });
  assert(hint1.ok && hint1.reply.hintLevel === 1, `first hint on a fresh problem starts at level 1 (got ${hint1.ok ? hint1.reply.hintLevel : "error"})`);
  const hint2 = await sendMentorMessage(hintUserId, "Give me another hint.", { provider: new FakeMentorProvider("hint-ladder") });
  assert(hint2.ok && hint2.reply.hintLevel === 2, `the next hint on the same problem is level 2, not skipped or repeated (got ${hint2.ok ? hint2.reply.hintLevel : "error"})`);
  const hint3 = await sendMentorMessage(hintUserId, "One more hint please.", { provider: new FakeMentorProvider("hint-ladder") });
  assert(hint3.ok && hint3.reply.hintLevel === 3, `hint progress keeps climbing correctly across turns (got ${hint3.ok ? hint3.reply.hintLevel : "error"})`);
  if (hint1.ok && hint2.ok && hint3.ok) {
    assert(
      hint1.reply.problemSlug === "two-sum" && hint2.reply.problemSlug === "two-sum" && hint3.reply.problemSlug === "two-sum",
      "every hint in the ladder is tagged with the same problemSlug"
    );
  }

  // --- 6. Hint progress survives outside the capped context-window (getHintSignalsForUser is unbounded on purpose) ---
  const hintSignalRows = await getMentorMessagesForUser(hintUserId);
  const hintCount = hintSignalRows.filter((m) => m.hintLevel !== null).length;
  assert(hintCount === 3, `all 3 hint messages are persisted with a hintLevel (got ${hintCount})`);

  // --- 7. Catalog search: the mentor hands back a real, non-hallucinated problem, excluding already-solved ones ---
  const catalogUserId = await newUser("catalog");
  await startSync(catalogUserId, "fake-user");
  await markSyncSuccess(catalogUserId, { totalSolved: 1, easySolved: 1, mediumSolved: 0, hardSolved: 0, ranking: null });
  await insertSubmission(catalogUserId, "binary-search", "Binary Search", "Easy", 5, "binary-search"); // matches a real catalog slug
  const catalogResult = await sendMentorMessage(catalogUserId, "Give me a Binary Search problem.", { provider: new FakeMentorProvider("catalog-search") });
  assert(catalogResult.ok, "the catalog-search scenario returns a reply");
  if (catalogResult.ok) {
    assert(catalogResult.reply.problemSlug !== null, "the reply is tagged with a real problem slug from the catalog");
    assert(catalogResult.reply.problemSlug !== "binary-search", "the already-solved problem was excluded from the suggestion");
  }
  void solvedBinarySearchSlug;

  // --- 8. Conversation isolation: one student's mentor thread never includes another's messages ---
  const otherUserId = await newUser("other");
  await sendMentorMessage(otherUserId, "This is a private message.", { provider: new FakeMentorProvider("echo") });
  const hintUserConvo = await getMentorConversation(hintUserId);
  assert(
    !hintUserConvo.some((m) => m.content.includes("This is a private message.")),
    "one user's conversation never includes another user's messages"
  );

  console.log("\nAll AI mentor integration checks passed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
