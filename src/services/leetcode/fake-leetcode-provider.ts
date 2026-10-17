import {
  LeetCodeIncompleteDataError,
  LeetCodeNetworkError,
  LeetCodeRateLimitedError,
  LeetCodeUnavailableError,
  LeetCodeUserNotFoundError,
} from "@/lib/leetcode/errors";
import type {
  LeetCodeProblemMetadata,
  LeetCodeProfileSummary,
  LeetCodeProvider,
  LeetCodeSubmissionSummary,
} from "@/services/leetcode/leetcode-provider";

export type FakeScenario =
  | "healthy"
  | "new-account-no-submissions"
  | "user-not-found"
  | "rate-limited"
  | "unavailable"
  | "network-failure"
  | "incomplete-data";

const SAMPLE_PROBLEMS: (LeetCodeProblemMetadata & { submittedDaysAgo: number })[] = [
  {
    leetcodeId: "1",
    slug: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    topics: [
      { name: "Array", slug: "array" },
      { name: "Hash Table", slug: "hash-table" },
    ],
    submittedDaysAgo: 1,
  },
  {
    leetcodeId: "200",
    slug: "number-of-islands",
    title: "Number of Islands",
    difficulty: "Medium",
    topics: [
      { name: "Array", slug: "array" },
      { name: "Depth-First Search", slug: "depth-first-search" },
      { name: "Breadth-First Search", slug: "breadth-first-search" },
    ],
    submittedDaysAgo: 3,
  },
  {
    leetcodeId: "42",
    slug: "trapping-rain-water",
    title: "Trapping Rain Water",
    difficulty: "Hard",
    topics: [
      { name: "Array", slug: "array" },
      { name: "Two Pointers", slug: "two-pointers" },
      { name: "Dynamic Programming", slug: "dynamic-programming" },
    ],
    submittedDaysAgo: 7,
  },
];

/**
 * Test double for `LeetCodeProvider`. Configured with a scenario at
 * construction time so the ingestion pipeline can be exercised
 * against every failure mode without a real network call — see
 * scripts/leetcode-scenarios-test.ts.
 */
export class FakeLeetCodeProvider implements LeetCodeProvider {
  constructor(private readonly scenario: FakeScenario) {}

  private maybeThrowSharedFailure(context: string): void {
    switch (this.scenario) {
      case "user-not-found":
        throw new LeetCodeUserNotFoundError("fake-user");
      case "rate-limited":
        throw new LeetCodeRateLimitedError();
      case "unavailable":
        throw new LeetCodeUnavailableError("HTTP 503 (simulated)");
      case "network-failure":
        throw new LeetCodeNetworkError({ cause: new Error("simulated ECONNRESET") });
      case "incomplete-data":
        throw new LeetCodeIncompleteDataError(`simulated malformed response in ${context}`);
      default:
        return;
    }
  }

  async fetchProfile(username: string): Promise<LeetCodeProfileSummary> {
    this.maybeThrowSharedFailure("fetchProfile");

    if (this.scenario === "new-account-no-submissions") {
      return {
        username,
        ranking: 4_200_000,
        totalSolved: 0,
        easySolved: 0,
        mediumSolved: 0,
        hardSolved: 0,
      };
    }

    return {
      username,
      ranking: 128_452,
      totalSolved: SAMPLE_PROBLEMS.length,
      easySolved: SAMPLE_PROBLEMS.filter((p) => p.difficulty === "Easy").length,
      mediumSolved: SAMPLE_PROBLEMS.filter((p) => p.difficulty === "Medium").length,
      hardSolved: SAMPLE_PROBLEMS.filter((p) => p.difficulty === "Hard").length,
    };
  }

  async fetchRecentSubmissions(
    username: string,
    limit: number
  ): Promise<LeetCodeSubmissionSummary[]> {
    this.maybeThrowSharedFailure("fetchRecentSubmissions");

    if (this.scenario === "new-account-no-submissions") {
      return [];
    }

    const now = Date.now();
    return SAMPLE_PROBLEMS.slice(0, limit).map((problem) => ({
      leetcodeSubmissionId: `fake-submission-${problem.slug}`,
      titleSlug: problem.slug,
      title: problem.title,
      submittedAt: new Date(now - problem.submittedDaysAgo * 24 * 60 * 60 * 1000),
    }));
  }

  async fetchProblemMetadata(titleSlug: string): Promise<LeetCodeProblemMetadata> {
    this.maybeThrowSharedFailure("fetchProblemMetadata");

    const problem = SAMPLE_PROBLEMS.find((p) => p.slug === titleSlug);
    if (!problem) {
      throw new LeetCodeIncompleteDataError(`unknown fake problem "${titleSlug}"`);
    }
    return problem;
  }
}
