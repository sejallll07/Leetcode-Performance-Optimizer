import { LeetCodeError } from "@/lib/leetcode/errors";
import {
  LEETCODE_ERROR_MESSAGES,
  type LeetCodeErrorCode,
} from "@/lib/leetcode/errors";
import { leetcodeUsernameSchema } from "@/lib/validation";
import type { LeetCodeProvider } from "@/services/leetcode/leetcode-provider";
import {
  getLeetCodeProfileByUserId,
  getProblemsBySlugs,
  markSyncError,
  markSyncSuccess,
  startSync,
  upsertProblemWithTopics,
  upsertSubmission,
  upsertTopic,
  type LeetCodeProfileRow,
} from "@/repositories/leetcode-repository";

const RECENT_SUBMISSIONS_LIMIT = 20;

/**
 * How many not-yet-seen problems to resolve metadata for at once.
 * A small bounded concurrency keeps the sync faster without firing
 * all requests simultaneously.
 */
const METADATA_FETCH_CONCURRENCY = 3;

export type SyncResult =
  | { ok: true; profile: LeetCodeProfileRow | null }
  | { ok: false; errorCode: LeetCodeErrorCode; error: string };

/**
 * Orchestrates a LeetCode sync:
 * validate username, fetch profile/submissions, resolve problem/topic
 * metadata, store submissions, then mark sync success.
 */
export async function syncLeetCodeProfile(
  provider: LeetCodeProvider,
  userId: string,
  username: string
): Promise<SyncResult> {
  const parsedUsername = leetcodeUsernameSchema.safeParse(username);

  if (!parsedUsername.success) {
    return {
      ok: false,
      errorCode: "USER_NOT_FOUND",
      error: parsedUsername.error.issues[0]?.message ?? "Invalid username",
    };
  }

  username = parsedUsername.data;

  await startSync(userId, username);

  try {
    const profile = await provider.fetchProfile(username);
    const submissions = await provider.fetchRecentSubmissions(
      username,
      RECENT_SUBMISSIONS_LIMIT
    );

    // Resolve all existing problems in one database query.
    const uniqueSlugs = [
      ...new Set(submissions.map((submission) => submission.titleSlug)),
    ];

    const knownProblemIds = await getProblemsBySlugs(uniqueSlugs);

    const unknownSlugs = uniqueSlugs.filter(
      (slug) => !knownProblemIds.has(slug)
    );

    // Fetch metadata for genuinely new problems in bounded batches.
    const newProblemIds = new Map<string, string>();

    for (
      let i = 0;
      i < unknownSlugs.length;
      i += METADATA_FETCH_CONCURRENCY
    ) {
      const batch = unknownSlugs.slice(
        i,
        i + METADATA_FETCH_CONCURRENCY
      );

      const resolved = await Promise.all(
        batch.map(async (slug) => {
          const metadata = await provider.fetchProblemMetadata(slug);

          const topicIds = await Promise.all(
            metadata.topics.map((topic) => upsertTopic(topic))
          );

          const problemId = await upsertProblemWithTopics({
            leetcodeId: metadata.leetcodeId,
            slug: metadata.slug,
            title: metadata.title,
            difficulty: metadata.difficulty,
            topicIds,
          });

          return [slug, problemId] as const;
        })
      );

      for (const [slug, id] of resolved) {
        newProblemIds.set(slug, id);
      }
    }

    const allProblemIds = new Map([
      ...knownProblemIds,
      ...newProblemIds,
    ]);

    // Submissions are independent rows, so store them concurrently.
    await Promise.all(
      submissions.map((submission) =>
        upsertSubmission({
          userId,
          problemId: allProblemIds.get(submission.titleSlug)!,
          leetcodeSubmissionId: submission.leetcodeSubmissionId,
          status: "Accepted",
          submittedAt: submission.submittedAt,
        })
      )
    );

    await markSyncSuccess(userId, profile);

    return {
      ok: true,
      profile: await getLeetCodeProfileByUserId(userId),
    };
  } catch (err) {
    const leetCodeError =
      err instanceof LeetCodeError
        ? err
        : new LeetCodeError(
            "UNKNOWN",
            err instanceof Error ? err.message : "Unknown error"
          );

    await markSyncError(
      userId,
      leetCodeError.code,
      leetCodeError.message
    );

    return {
      ok: false,
      errorCode: leetCodeError.code,
      error: LEETCODE_ERROR_MESSAGES[leetCodeError.code],
    };
  }
}