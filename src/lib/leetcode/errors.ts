/**
 * Typed error taxonomy for anything that can go wrong talking to
 * LeetCode. Every error carries a stable `code` so the ingestion
 * service and UI can react to specific failure modes (e.g. show a
 * "try again in a bit" message for rate limits, vs. "check the
 * spelling" for a missing user) without string-matching messages.
 */

export type LeetCodeErrorCode =
  | "USER_NOT_FOUND"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "NETWORK_ERROR"
  | "INCOMPLETE_DATA"
  | "UNKNOWN";

export class LeetCodeError extends Error {
  readonly code: LeetCodeErrorCode;

  constructor(code: LeetCodeErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LeetCodeError";
    this.code = code;
  }
}

export class LeetCodeUserNotFoundError extends LeetCodeError {
  constructor(username: string) {
    super("USER_NOT_FOUND", `No LeetCode profile found for username "${username}"`);
    this.name = "LeetCodeUserNotFoundError";
  }
}

export class LeetCodeRateLimitedError extends LeetCodeError {
  constructor() {
    super("RATE_LIMITED", "LeetCode is rate-limiting requests right now");
    this.name = "LeetCodeRateLimitedError";
  }
}

export class LeetCodeUnavailableError extends LeetCodeError {
  constructor(detail: string) {
    super("UNAVAILABLE", `LeetCode is temporarily unavailable (${detail})`);
    this.name = "LeetCodeUnavailableError";
  }
}

export class LeetCodeNetworkError extends LeetCodeError {
  constructor(options?: { cause?: unknown }) {
    super("NETWORK_ERROR", "Could not reach LeetCode — network error or timeout", options);
    this.name = "LeetCodeNetworkError";
  }
}

export class LeetCodeIncompleteDataError extends LeetCodeError {
  constructor(detail: string) {
    super("INCOMPLETE_DATA", `LeetCode returned an unexpected response shape (${detail})`);
    this.name = "LeetCodeIncompleteDataError";
  }
}

export class LeetCodeUnknownError extends LeetCodeError {
  constructor(options?: { cause?: unknown }) {
    super("UNKNOWN", "Something unexpected went wrong talking to LeetCode", options);
    this.name = "LeetCodeUnknownError";
  }
}

/** User-facing copy for each error code — used by the UI, not just logs. */
export const LEETCODE_ERROR_MESSAGES: Record<LeetCodeErrorCode, string> = {
  USER_NOT_FOUND: "We couldn't find a LeetCode profile with that username. Double-check the spelling.",
  RATE_LIMITED: "LeetCode is rate-limiting requests right now. Try syncing again in a few minutes.",
  UNAVAILABLE: "LeetCode looks temporarily unavailable. Try again shortly.",
  NETWORK_ERROR: "Couldn't reach LeetCode — check your connection and try again.",
  INCOMPLETE_DATA: "LeetCode returned incomplete data. Try syncing again — if it keeps happening, this may need a code fix.",
  UNKNOWN: "Something went wrong syncing your LeetCode profile. Try again in a bit.",
};
