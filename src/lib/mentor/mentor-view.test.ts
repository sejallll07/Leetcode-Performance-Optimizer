import { describe, expect, it } from "vitest";
import {
  MAX_START_PROBLEMS,
  MENTOR_MESSAGE_MAX_LENGTH,
  PROGRESS_QUESTIONS,
  SKIP_CONFIRMATION,
  classifySendFailure,
  filterCatalog,
  findProblem,
  formatTopics,
  getDraftStatus,
  getLadderState,
  getQuickActions,
  latestProblemSlug,
  splitMessageBlocks,
  topicLabel,
  type MentorCatalogProblem,
  type MentorViewMessage,
} from "@/lib/mentor/mentor-view";

const FENCE = "```";

const problem = (slug: string, title: string, difficulty: MentorCatalogProblem["difficulty"], topicSlugs: string[]): MentorCatalogProblem => ({
  slug,
  title,
  difficulty,
  topicSlugs,
});

const assistant = (hintLevel: number | null, problemSlug: string | null): MentorViewMessage => ({ role: "assistant", hintLevel, problemSlug });
const user = (): MentorViewMessage => ({ role: "user", hintLevel: null, problemSlug: null });

const CATALOG: MentorCatalogProblem[] = [
  problem("two-sum", "Two Sum", "Easy", ["array", "hash-table"]),
  problem("binary-search", "Binary Search", "Easy", ["binary-search"]),
  problem("search-insert-position", "Search Insert Position", "Easy", ["binary-search", "array"]),
  problem("coin-change", "Coin Change", "Medium", ["dynamic-programming"]),
  problem("word-break", "Word Break", "Medium", ["dynamic-programming", "hash-table"]),
  problem("median-of-two-sorted-arrays", "Median of Two Sorted Arrays", "Hard", ["binary-search", "array"]),
];

describe("formatting helpers", () => {
  it("turns topic slugs into readable labels", () => {
    expect(topicLabel("binary-search")).toBe("Binary search");
    expect(topicLabel("dynamic_programming")).toBe("Dynamic programming");
    expect(topicLabel("array")).toBe("Array");
  });

  it("lists topics and collapses extras into +N", () => {
    expect(formatTopics(["array", "hash-table"])).toBe("Array, Hash table");
    expect(formatTopics(["array", "hash-table", "two-pointers", "sorting"])).toBe("Array, Hash table +2");
    expect(formatTopics([])).toBe("");
  });

  it("finds a problem by slug, or null", () => {
    expect(findProblem(CATALOG, "two-sum")?.title).toBe("Two Sum");
    expect(findProblem(CATALOG, "nope")).toBeNull();
    expect(findProblem(CATALOG, null)).toBeNull();
  });
});

describe("latestProblemSlug", () => {
  it("returns the most recent assistant problem slug", () => {
    expect(latestProblemSlug([user(), assistant(1, "two-sum"), user(), assistant(null, "coin-change"), user()])).toBe("coin-change");
  });

  it("returns null when no assistant message carries a slug", () => {
    expect(latestProblemSlug([])).toBeNull();
    expect(latestProblemSlug([user(), assistant(null, null)])).toBeNull();
  });
});

describe("getLadderState", () => {
  it("starts empty with every step upcoming", () => {
    const s = getLadderState([user()], "two-sum");
    expect(s.currentLevel).toBe(0);
    expect(s.nextLevel).toBe(1);
    expect(s.nextName).toBe("Conceptual hint");
    expect(s.currentName).toBeNull();
    expect(s.solutionShown).toBe(false);
    expect(s.label).toBe("No hints yet");
    expect(s.steps.every((step) => step.state === "upcoming")).toBe(true);
    expect(s.steps).toHaveLength(6);
  });

  it("is empty when there is no active problem", () => {
    const s = getLadderState([assistant(3, "two-sum")], null);
    expect(s.currentLevel).toBe(0);
    expect(s.label).toBe("No hints yet");
  });

  it("uses the highest level reached, not the latest", () => {
    const s = getLadderState([assistant(1, "two-sum"), assistant(3, "two-sum"), assistant(2, "two-sum")], "two-sum");
    expect(s.currentLevel).toBe(3);
    expect(s.currentName).toBe("Approach hint");
    expect(s.nextLevel).toBe(4);
    expect(s.nextName).toBe("Detailed reasoning");
    expect(s.label).toBe("Hint 3/6 Approach hint");
    expect(s.steps.map((x) => x.state)).toEqual(["done", "done", "current", "upcoming", "upcoming", "upcoming"]);
  });

  it("tracks each problem separately", () => {
    const messages = [assistant(4, "two-sum"), assistant(1, "coin-change")];
    expect(getLadderState(messages, "two-sum").currentLevel).toBe(4);
    expect(getLadderState(messages, "coin-change").currentLevel).toBe(1);
    expect(getLadderState(messages, "word-break").currentLevel).toBe(0);
  });

  it("reports the solution as shown at level 6 with no next level", () => {
    const s = getLadderState([assistant(6, "two-sum")], "two-sum");
    expect(s.solutionShown).toBe(true);
    expect(s.nextLevel).toBeNull();
    expect(s.nextName).toBeNull();
    expect(s.label).toBe("Solution shown");
    expect(s.steps[5].state).toBe("current");
  });

  it("ignores messages without a hint level", () => {
    expect(getLadderState([assistant(null, "two-sum"), user()], "two-sum").currentLevel).toBe(0);
  });
});

describe("getQuickActions", () => {
  const twoSum = CATALOG[0];

  it("offers nothing without an active problem", () => {
    expect(getQuickActions(null, getLadderState([], null))).toEqual([]);
  });

  it("offers a first hint, quiz, review and a guarded skip before any hint", () => {
    const actions = getQuickActions(twoSum, getLadderState([], "two-sum"));
    expect(actions.map((a) => a.id)).toEqual(["hint", "quiz", "review", "skip"]);
    expect(actions[0].label).toBe("Get a hint");
    expect(actions[0].message).toBe('Give me a hint for "Two Sum" (two-sum).');
    expect(actions.find((a) => a.id === "skip")?.requiresConfirm).toBe(true);
    expect(actions.filter((a) => a.id !== "skip").every((a) => !a.requiresConfirm)).toBe(true);
  });

  it("labels the hint action with the next level mid-ladder", () => {
    const actions = getQuickActions(twoSum, getLadderState([assistant(3, "two-sum")], "two-sum"));
    expect(actions[0].label).toBe("Next hint (4/6)");
    expect(actions[0].message).toBe('Give me the next hint for "Two Sum" (two-sum).');
  });

  it("asks explicitly for the solution when skipping", () => {
    const skip = getQuickActions(twoSum, getLadderState([], "two-sum")).find((a) => a.id === "skip");
    expect(skip?.message).toContain("full solution");
    expect(skip?.message).toContain("(two-sum)");
  });

  it("switches to quiz, similar and pick-another once the solution is shown", () => {
    const actions = getQuickActions(twoSum, getLadderState([assistant(6, "two-sum")], "two-sum"));
    expect(actions.map((a) => a.id)).toEqual(["quiz", "similar", "another"]);
    expect(actions.find((a) => a.id === "another")?.message).toBeNull();
    expect(actions.find((a) => a.id === "similar")?.message).toContain("(two-sum)");
    expect(actions.some((a) => a.id === "hint" || a.id === "skip")).toBe(false);
  });

  it("exposes confirmation copy for the skip action", () => {
    expect(SKIP_CONFIRMATION.prompt.length).toBeGreaterThan(0);
    expect(SKIP_CONFIRMATION.confirmLabel).toBe("Show solution");
    expect(SKIP_CONFIRMATION.cancelLabel).toBe("Keep hinting");
  });
});

describe("start panel data", () => {
  it("lists progress questions to send as-is", () => {
    expect(PROGRESS_QUESTIONS).toHaveLength(3);
    expect(PROGRESS_QUESTIONS.every((q) => q.endsWith("?"))).toBe(true);
  });

  it("sorts with no query from Easy to Hard, then alphabetically", () => {
    const { problems } = filterCatalog(CATALOG, { limit: 10 });
    expect(problems.map((p) => p.slug)).toEqual([
      "binary-search",
      "search-insert-position",
      "two-sum",
      "coin-change",
      "word-break",
      "median-of-two-sorted-arrays",
    ]);
  });

  it("caps the list and reports how many are hidden", () => {
    const many = Array.from({ length: 12 }, (_, i) => problem(`p-${i}`, `Problem ${String(i).padStart(2, "0")}`, "Easy", ["array"]));
    const result = filterCatalog(many);
    expect(result.problems).toHaveLength(MAX_START_PROBLEMS);
    expect(result.total).toBe(12);
    expect(result.hiddenCount).toBe(12 - MAX_START_PROBLEMS);
  });

  it("matches title, slug and topic names without regard to case", () => {
    expect(filterCatalog(CATALOG, { query: "TWO SUM" }).problems.map((p) => p.slug)).toEqual(["two-sum"]);
    expect(filterCatalog(CATALOG, { query: "word-break" }).problems.map((p) => p.slug)).toEqual(["word-break"]);
    expect(filterCatalog(CATALOG, { query: "dynamic programming" }).problems.map((p) => p.slug)).toEqual(["coin-change", "word-break"]);
  });

  it("requires every word of the query to match", () => {
    expect(filterCatalog(CATALOG, { query: "binary hard" }).total).toBe(0);
    expect(filterCatalog(CATALOG, { query: "binary array" }).problems.map((p) => p.slug)).toEqual(["search-insert-position", "median-of-two-sorted-arrays"]);
  });

  it("puts title-prefix matches before other matches", () => {
    const result = filterCatalog(CATALOG, { query: "search", limit: 10 });
    expect(result.problems.map((p) => p.slug)).toEqual(["search-insert-position", "binary-search", "median-of-two-sorted-arrays"]);
  });

  it("filters by difficulty and combines it with a query", () => {
    expect(filterCatalog(CATALOG, { difficulty: "Hard" }).problems.map((p) => p.slug)).toEqual(["median-of-two-sorted-arrays"]);
    expect(filterCatalog(CATALOG, { difficulty: "Easy", query: "array" }).problems.map((p) => p.slug)).toEqual(["search-insert-position", "two-sum"]);
  });

  it("returns an empty result rather than throwing when nothing matches", () => {
    expect(filterCatalog(CATALOG, { query: "zzz" })).toEqual({ problems: [], total: 0, hiddenCount: 0 });
    expect(filterCatalog([], {})).toEqual({ problems: [], total: 0, hiddenCount: 0 });
  });

  it("does not mutate the catalog it is given", () => {
    const copy = CATALOG.map((p) => p.slug);
    filterCatalog(CATALOG, { query: "a" });
    expect(CATALOG.map((p) => p.slug)).toEqual(copy);
  });
});

describe("splitMessageBlocks", () => {
  it("returns one text block for plain prose", () => {
    expect(splitMessageBlocks("Think about the complement.")).toEqual([{ type: "text", text: "Think about the complement." }]);
  });

  it("returns nothing for an empty or blank message", () => {
    expect(splitMessageBlocks("")).toEqual([]);
    expect(splitMessageBlocks("  \n \n")).toEqual([]);
  });

  it("separates text, a fenced code block with a language, and trailing text", () => {
    const content = ["Here is the idea:", "", `${FENCE}python`, "def f(x):", "    return x", FENCE, "", "That is O(n)."].join("\n");
    expect(splitMessageBlocks(content)).toEqual([
      { type: "text", text: "Here is the idea:" },
      { type: "code", code: "def f(x):\n    return x", language: "python" },
      { type: "text", text: "That is O(n)." },
    ]);
  });

  it("handles a fence with no language and several blocks", () => {
    const content = [FENCE, "a = 1", FENCE, "between", `${FENCE}js`, "let b = 2;", FENCE].join("\n");
    expect(splitMessageBlocks(content)).toEqual([
      { type: "code", code: "a = 1", language: null },
      { type: "text", text: "between" },
      { type: "code", code: "let b = 2;", language: "js" },
    ]);
  });

  it("treats a fence that is never closed as code to the end", () => {
    const content = ["Start", `${FENCE}python`, "for i in range(3):", "    pass"].join("\n");
    expect(splitMessageBlocks(content)).toEqual([
      { type: "text", text: "Start" },
      { type: "code", code: "for i in range(3):\n    pass", language: "python" },
    ]);
  });

  it("leaves inline backticks inside text", () => {
    expect(splitMessageBlocks("Use `dict` and ```inline``` here.")).toEqual([
      { type: "text", text: "Use `dict` and ```inline``` here." },
    ]);
  });

  it("preserves indentation inside code and drops blank edges around text", () => {
    const content = ["", "", "Intro", "", `${FENCE}`, "  indented", FENCE, ""].join("\n");
    expect(splitMessageBlocks(content)).toEqual([
      { type: "text", text: "Intro" },
      { type: "code", code: "  indented", language: null },
    ]);
  });
});

describe("getDraftStatus", () => {
  it("treats empty and whitespace-only drafts as unsendable", () => {
    for (const text of ["", "   ", "\n\t"]) {
      const s = getDraftStatus(text);
      expect(s.isEmpty).toBe(true);
      expect(s.canSend).toBe(false);
      expect(s.isOverLimit).toBe(false);
    }
  });

  it("allows a normal draft and counts trimmed length", () => {
    const s = getDraftStatus("  hello  ");
    expect(s.length).toBe(5);
    expect(s.remaining).toBe(MENTOR_MESSAGE_MAX_LENGTH - 5);
    expect(s.canSend).toBe(true);
    expect(s.showCounter).toBe(false);
  });

  it("allows exactly the limit and blocks one character over", () => {
    expect(getDraftStatus("a".repeat(MENTOR_MESSAGE_MAX_LENGTH)).canSend).toBe(true);
    const over = getDraftStatus("a".repeat(MENTOR_MESSAGE_MAX_LENGTH + 1));
    expect(over.isOverLimit).toBe(true);
    expect(over.canSend).toBe(false);
    expect(over.remaining).toBe(-1);
  });

  it("does not count surrounding whitespace toward the limit", () => {
    expect(getDraftStatus(`  ${"a".repeat(MENTOR_MESSAGE_MAX_LENGTH)}  `).canSend).toBe(true);
  });

  it("shows the counter from 80 percent of the limit", () => {
    expect(getDraftStatus("a".repeat(3199)).showCounter).toBe(false);
    expect(getDraftStatus("a".repeat(3200)).showCounter).toBe(true);
  });

  it("mirrors the server limit", () => {
    expect(MENTOR_MESSAGE_MAX_LENGTH).toBe(4000);
  });
});

describe("classifySendFailure", () => {
  it("recognises a signed-out failure as not saved", () => {
    const f = classifySendFailure("You need to be signed in.", false);
    expect(f.kind).toBe("signed-out");
    expect(f.messageSaved).toBe(false);
    expect(f.detail).toContain("not sent");
  });

  it("recognises server validation failures as not saved", () => {
    const empty = classifySendFailure("Type a message first.", false);
    expect(empty.kind).toBe("validation");
    expect(empty.messageSaved).toBe(false);

    const tooLong = classifySendFailure("That message is too long \u2014 try breaking it into smaller questions.", false);
    expect(tooLong.kind).toBe("validation");
    expect(tooLong.messageSaved).toBe(false);
  });

  it("treats any other failure as an AI failure with the message already saved", () => {
    const f = classifySendFailure("The AI mentor is temporarily overloaded \u2014 try again shortly.", true);
    expect(f.kind).toBe("ai-failure");
    expect(f.messageSaved).toBe(true);
    expect(f.detail).toContain("saved");
    expect(f.detail).toContain("usually temporary");
    expect(f.reason).toContain("overloaded");
  });

  it("does not call a non-retryable failure temporary, and never suggests re-sending", () => {
    const f = classifySendFailure("The AI mentor isn't configured yet \u2014 no API key is set up.", false);
    expect(f.kind).toBe("ai-failure");
    expect(f.detail).not.toContain("temporary");
    expect(f.detail.toLowerCase()).not.toContain("resend");
    expect(f.detail.toLowerCase()).not.toContain("send it again");
  });
});