/**
 * The boundary between "the rest of the app" and "however we
 * actually get LeetCode data". The ingestion service depends only
 * on this interface — never on `src/lib/leetcode/leetcode-client.ts`
 * directly. That's what makes it possible to swap the real GraphQL
 * implementation for a fake one in tests, or for a different
 * data-access method later, without touching ingestion logic.
 */

export type LeetCodeProfileSummary = {
  username: string;
  ranking: number | null;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
};

export type LeetCodeSubmissionSummary = {
  leetcodeSubmissionId: string;
  titleSlug: string;
  title: string;
  submittedAt: Date;
};

export type LeetCodeProblemMetadata = {
  leetcodeId: string;
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  topics: { name: string; slug: string }[];
};

export interface LeetCodeProvider {
  /** Throws LeetCodeUserNotFoundError if the username doesn't exist. */
  fetchProfile(username: string): Promise<LeetCodeProfileSummary>;

  /** Most recent accepted submissions, newest first. May be empty for a new account. */
  fetchRecentSubmissions(username: string, limit: number): Promise<LeetCodeSubmissionSummary[]>;

  /** Throws LeetCodeIncompleteDataError if the problem can't be found. */
  fetchProblemMetadata(titleSlug: string): Promise<LeetCodeProblemMetadata>;
}
