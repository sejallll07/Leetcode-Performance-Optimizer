import {
  fetchQuestionMetadataRaw,
  fetchRecentAcSubmissionsRaw,
  fetchUserProfileRaw,
} from "@/lib/leetcode/leetcode-client";
import { LeetCodeIncompleteDataError, LeetCodeUserNotFoundError } from "@/lib/leetcode/errors";
import type {
  LeetCodeProblemMetadata,
  LeetCodeProfileSummary,
  LeetCodeProvider,
  LeetCodeSubmissionSummary,
} from "@/services/leetcode/leetcode-provider";

function countFor(
  acSubmissionNum: { difficulty: string; count: number }[],
  difficulty: string
): number {
  return acSubmissionNum.find((row) => row.difficulty === difficulty)?.count ?? 0;
}

/** The real implementation — talks to LeetCode's public GraphQL API. */
export class GraphQLLeetCodeProvider implements LeetCodeProvider {
  async fetchProfile(username: string): Promise<LeetCodeProfileSummary> {
    const { matchedUser } = await fetchUserProfileRaw(username);

    if (!matchedUser) {
      throw new LeetCodeUserNotFoundError(username);
    }
    if (!matchedUser.submitStats) {
      throw new LeetCodeIncompleteDataError("matchedUser.submitStats missing");
    }

    const counts = matchedUser.submitStats.acSubmissionNum;
    return {
      username: matchedUser.username,
      ranking: matchedUser.profile?.ranking ?? null,
      totalSolved: countFor(counts, "All"),
      easySolved: countFor(counts, "Easy"),
      mediumSolved: countFor(counts, "Medium"),
      hardSolved: countFor(counts, "Hard"),
    };
  }

  async fetchRecentSubmissions(
    username: string,
    limit: number
  ): Promise<LeetCodeSubmissionSummary[]> {
    const { recentAcSubmissionList } = await fetchRecentAcSubmissionsRaw(username, limit);

    // A brand-new account with zero submissions is valid, not an
    // error — LeetCode returns an empty array for that case. `null`
    // instead of `[]` is the actual malformed-response case.
    if (recentAcSubmissionList === null) {
      throw new LeetCodeIncompleteDataError("recentAcSubmissionList missing");
    }

    return recentAcSubmissionList.map((row) => ({
      leetcodeSubmissionId: row.id,
      titleSlug: row.titleSlug,
      title: row.title,
      submittedAt: new Date(Number(row.timestamp) * 1000),
    }));
  }

  async fetchProblemMetadata(titleSlug: string): Promise<LeetCodeProblemMetadata> {
    const { question } = await fetchQuestionMetadataRaw(titleSlug);

    if (!question) {
      throw new LeetCodeIncompleteDataError(`question "${titleSlug}" not found`);
    }

    return {
      leetcodeId: question.questionFrontendId,
      slug: question.titleSlug,
      title: question.title,
      difficulty: question.difficulty,
      topics: question.topicTags.map((tag) => ({ name: tag.name, slug: tag.slug })),
    };
  }
}
