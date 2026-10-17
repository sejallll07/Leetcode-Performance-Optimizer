import {
  LeetCodeIncompleteDataError,
  LeetCodeNetworkError,
  LeetCodeRateLimitedError,
  LeetCodeUnavailableError,
  LeetCodeUnknownError,
} from "@/lib/leetcode/errors";
import type {
  GraphQLEnvelope,
  RawQuestionResponse,
  RawRecentSubmissionsResponse,
  RawUserProfileResponse,
} from "@/lib/leetcode/types";

/**
 * The only file in the app that knows LeetCode's GraphQL endpoint,
 * query strings, and HTTP quirks. Everything above this talks to
 * `LeetCodeProvider` (src/services/leetcode) instead — see that
 * file's comment for why the split exists.
 *
 * There is no official LeetCode API. This uses the same public,
 * unauthenticated GraphQL endpoint LeetCode's own site calls
 * (https://leetcode.com/graphql) — no session cookie, no private
 * data. See PROJECT_STATUS.md for the reliability trade-offs.
 */

const ENDPOINT = "https://leetcode.com/graphql";
const REQUEST_TIMEOUT_MS = 10_000;

const USER_PROFILE_QUERY = `
  query getUserProfile($username: String!) {
    matchedUser(username: $username) {
      username
      profile {
        ranking
      }
      submitStats: submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
          submissions
        }
      }
    }
  }
`;

const RECENT_AC_SUBMISSIONS_QUERY = `
  query recentAcSubmissions($username: String!, $limit: Int!) {
    recentAcSubmissionList(username: $username, limit: $limit) {
      id
      title
      titleSlug
      timestamp
    }
  }
`;

const QUESTION_METADATA_QUERY = `
  query questionMetadata($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      questionFrontendId
      title
      titleSlug
      difficulty
      topicTags {
        name
        slug
      }
    }
  }
`;

async function postGraphQL<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // LeetCode's endpoint rejects requests with no Referer.
        Referer: "https://leetcode.com",
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
  } catch (cause) {
    // Covers both a hung request hitting our own timeout (abort)
    // and any other fetch-level failure (DNS, connection refused).
    throw new LeetCodeNetworkError({ cause });
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) {
    throw new LeetCodeRateLimitedError();
  }
  if (response.status === 403 || response.status >= 500) {
    throw new LeetCodeUnavailableError(`HTTP ${response.status}`);
  }
  if (!response.ok) {
    throw new LeetCodeUnknownError({ cause: `HTTP ${response.status}` });
  }

  let envelope: GraphQLEnvelope<T>;
  try {
    envelope = await response.json();
  } catch {
    // Most often LeetCode returning an HTML challenge/interstitial
    // page instead of JSON — a soft block, not a crash.
    throw new LeetCodeUnavailableError("non-JSON response");
  }

  if (envelope.errors?.length) {
    const message = envelope.errors[0]?.message ?? "unknown GraphQL error";
    if (/rate.?limit/i.test(message)) {
      throw new LeetCodeRateLimitedError();
    }
    throw new LeetCodeIncompleteDataError(message);
  }

  if (!envelope.data) {
    throw new LeetCodeIncompleteDataError("missing `data` in response");
  }

  return envelope.data;
}

export async function fetchUserProfileRaw(username: string): Promise<RawUserProfileResponse> {
  return postGraphQL<RawUserProfileResponse>(USER_PROFILE_QUERY, { username });
}

export async function fetchRecentAcSubmissionsRaw(
  username: string,
  limit: number
): Promise<RawRecentSubmissionsResponse> {
  return postGraphQL<RawRecentSubmissionsResponse>(RECENT_AC_SUBMISSIONS_QUERY, {
    username,
    limit,
  });
}

export async function fetchQuestionMetadataRaw(titleSlug: string): Promise<RawQuestionResponse> {
  return postGraphQL<RawQuestionResponse>(QUESTION_METADATA_QUERY, { titleSlug });
}
