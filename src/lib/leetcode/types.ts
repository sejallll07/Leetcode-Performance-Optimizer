/**
 * Raw shapes as LeetCode's GraphQL API actually returns them. These
 * are intentionally kept separate from our own domain types
 * (src/services/leetcode/leetcode-provider.ts) — nothing outside
 * this folder should import from here.
 */

export type RawAcSubmissionNum = {
  difficulty: "All" | "Easy" | "Medium" | "Hard";
  count: number;
  submissions: number;
};

export type RawMatchedUser = {
  username: string;
  profile: {
    ranking: number | null;
  } | null;
  submitStats: {
    acSubmissionNum: RawAcSubmissionNum[];
  } | null;
} | null;

export type RawUserProfileResponse = {
  matchedUser: RawMatchedUser;
};

export type RawRecentAcSubmission = {
  id: string;
  title: string;
  titleSlug: string;
  timestamp: string; // unix seconds, as a string
};

export type RawRecentSubmissionsResponse = {
  recentAcSubmissionList: RawRecentAcSubmission[] | null;
};

export type RawTopicTag = {
  name: string;
  slug: string;
};

export type RawQuestion = {
  questionFrontendId: string;
  title: string;
  titleSlug: string;
  difficulty: "Easy" | "Medium" | "Hard";
  topicTags: RawTopicTag[];
} | null;

export type RawQuestionResponse = {
  question: RawQuestion;
};

export type GraphQLEnvelope<T> = {
  data?: T;
  errors?: { message: string }[];
};
