import { HINT_LEVELS, MAX_HINT_LEVEL } from "@/lib/mentor/config";
import { computeHintProgress } from "@/lib/mentor/hint-tracking";
import type { Difficulty } from "@/lib/analytics/types";

/**
 * Pure view model for the redesigned Mentor page: which problem is
 * active, how far into the hint ladder the student is, which quick
 * actions make sense, how the problem picker filters the catalog,
 * how a reply is split into text and code, whether a draft can be
 * sent, and how a failed send is explained. No I/O and no new
 * mentoring rules: hint progress reuses computeHintProgress, hint
 * names come from HINT_LEVELS, and the quick actions only produce
 * ordinary messages that go through the existing send action, so
 * the system prompt's own ladder rules still decide what the Mentor
 * answers. Symbols are plain ASCII.
 */

// ---------- Shared types ----------

/** The only catalog fields the client ever receives. */
export type MentorCatalogProblem = {
  slug: string;
  title: string;
  difficulty: Difficulty;
  topicSlugs: string[];
};

/** The minimal projection of a chat message this file needs. */
export type MentorViewMessage = {
  role: "user" | "assistant";
  hintLevel: number | null;
  problemSlug: string | null;
};

// ---------- Small formatting helpers ----------

/** "binary-search" becomes "Binary search". Only slugs reach the client, so names are derived from them. */
export function topicLabel(slug: string): string {
  const words = slug.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "Array, Hash table", or "Array, Hash table +2" when there are more than `max`. */
export function formatTopics(slugs: string[], max = 2): string {
  const labels = slugs.map(topicLabel);
  if (labels.length <= max) return labels.join(", ");
  return `${labels.slice(0, max).join(", ")} +${labels.length - max}`;
}

const DIFFICULTY_RANK: Record<Difficulty, number> = { Easy: 0, Medium: 1, Hard: 2 };

export function findProblem(catalog: MentorCatalogProblem[], slug: string | null): MentorCatalogProblem | null {
  if (slug === null) return null;
  return catalog.find((p) => p.slug === slug) ?? null;
}

// ---------- Active problem and hint ladder ----------

/** The problem the Mentor most recently tagged a reply with, or null. Only assistant replies carry a problem slug. */
export function latestProblemSlug(messages: MentorViewMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant" && m.problemSlug !== null) return m.problemSlug;
  }
  return null;
}

export type LadderStepState = "done" | "current" | "upcoming";

export type LadderState = {
  /** Highest hint level given for this problem so far; 0 means none yet. */
  currentLevel: number;
  maxLevel: number;
  currentName: string | null;
  nextLevel: number | null;
  nextName: string | null;
  /** True once level 6 (the solution explanation) has been given. */
  solutionShown: boolean;
  steps: { level: number; name: string; state: LadderStepState }[];
  /** "No hints yet", "Hint 3/6 Approach hint" or "Solution shown". */
  label: string;
};

function levelName(level: number): string | null {
  return HINT_LEVELS.find((h) => h.level === level)?.name ?? null;
}

/** Ladder state for one problem, computed from the stored messages with the same function the server uses. */
export function getLadderState(messages: MentorViewMessage[], problemSlug: string | null): LadderState {
  const entry = problemSlug === null ? undefined : computeHintProgress(messages).find((e) => e.problemSlug === problemSlug);
  const currentLevel = Math.min(MAX_HINT_LEVEL, entry?.currentLevel ?? 0);
  const nextLevel = currentLevel < MAX_HINT_LEVEL ? currentLevel + 1 : null;
  const solutionShown = currentLevel >= MAX_HINT_LEVEL;

  const label =
    currentLevel === 0
      ? "No hints yet"
      : solutionShown
        ? "Solution shown"
        : `Hint ${currentLevel}/${MAX_HINT_LEVEL} ${levelName(currentLevel) ?? ""}`.trim();

  return {
    currentLevel,
    maxLevel: MAX_HINT_LEVEL,
    currentName: currentLevel === 0 ? null : levelName(currentLevel),
    nextLevel,
    nextName: nextLevel === null ? null : levelName(nextLevel),
    solutionShown,
    steps: HINT_LEVELS.map((h) => ({
      level: h.level,
      name: h.name,
      state: h.level < currentLevel ? "done" : h.level === currentLevel ? "current" : "upcoming",
    })),
    label,
  };
}

// ---------- Quick actions ----------

export type QuickActionId = "hint" | "quiz" | "review" | "skip" | "similar" | "another";

export type QuickAction = {
  id: QuickActionId;
  label: string;
  /** Sent as an ordinary student message. Null means the action is handled in the UI (pick another problem). */
  message: string | null;
  /** True when the UI must ask for confirmation before sending. */
  requiresConfirm: boolean;
};

/** Copy for the inline confirmation shown before "Skip to solution" is sent. */
export const SKIP_CONFIRMATION = {
  prompt: "Skip the remaining hints and see the full solution?",
  confirmLabel: "Show solution",
  cancelLabel: "Keep hinting",
} as const;

/** Title plus slug, so the Mentor can tag its reply with the right slug for hint tracking. */
function problemRef(problem: MentorCatalogProblem): string {
  return `"${problem.title}" (${problem.slug})`;
}

export function getQuickActions(problem: MentorCatalogProblem | null, ladder: LadderState): QuickAction[] {
  if (problem === null) return [];
  const ref = problemRef(problem);

  if (ladder.solutionShown) {
    return [
      { id: "quiz", label: "Quiz me", message: `Quiz me on ${ref}. Ask one question and wait for my answer.`, requiresConfirm: false },
      { id: "similar", label: "Practice a similar problem", message: `Give me a similar problem to ${ref} that I haven't solved yet.`, requiresConfirm: false },
      { id: "another", label: "Pick another problem", message: null, requiresConfirm: false },
    ];
  }

  const hintAction: QuickAction =
    ladder.currentLevel === 0
      ? { id: "hint", label: "Get a hint", message: `Give me a hint for ${ref}.`, requiresConfirm: false }
      : { id: "hint", label: `Next hint (${ladder.nextLevel}/${ladder.maxLevel})`, message: `Give me the next hint for ${ref}.`, requiresConfirm: false };

  return [
    hintAction,
    { id: "quiz", label: "Quiz me", message: `Quiz me on ${ref}. Ask one question and wait for my answer.`, requiresConfirm: false },
    { id: "review", label: "Review my approach", message: `I'd like you to review my approach to ${ref}.`, requiresConfirm: false },
    { id: "skip", label: "Skip to solution", message: `Skip the hints and give me the full solution explanation for ${ref}.`, requiresConfirm: true },
  ];
}

// ---------- Start panel ----------

/** Progress questions shown beside the problem picker. Each one is sent as-is when tapped. */
export const PROGRESS_QUESTIONS = [
  "What should I practice today?",
  "Why did my score decrease?",
  "What should I learn next?",
] as const;

/** How many problems the picker lists before "N more" is shown. */
export const MAX_START_PROBLEMS = 8;

export type CatalogFilter = {
  query?: string;
  difficulty?: Difficulty | null;
  limit?: number;
};

export type CatalogResult = {
  problems: MentorCatalogProblem[];
  /** Matches before the limit was applied. */
  total: number;
  /** Matches that are not shown. */
  hiddenCount: number;
};

/**
 * Filters the problem list for the picker. Every word of the query
 * must appear in the title, slug or a topic name. Title-prefix
 * matches come first, then other title matches, then topic matches;
 * ties go Easy, Medium, Hard, then alphabetical. With no query the
 * list is simply Easy to Hard, alphabetical. The input is not mutated.
 */
export function filterCatalog(catalog: MentorCatalogProblem[], filter: CatalogFilter = {}): CatalogResult {
  const query = (filter.query ?? "").trim().toLowerCase();
  const tokens = query.length > 0 ? query.split(/\s+/) : [];
  const limit = filter.limit ?? MAX_START_PROBLEMS;

  const haystack = (p: MentorCatalogProblem) =>
    `${p.title} ${p.slug} ${p.topicSlugs.join(" ")} ${p.topicSlugs.map(topicLabel).join(" ")}`.toLowerCase();

  const score = (p: MentorCatalogProblem) => {
    if (query.length === 0) return 0;
    const title = p.title.toLowerCase();
    if (title.startsWith(query)) return 0;
    if (title.includes(query)) return 1;
    return 2;
  };

  const matches = catalog
    .filter((p) => (filter.difficulty ? p.difficulty === filter.difficulty : true))
    .filter((p) => tokens.every((t) => haystack(p).includes(t)))
    .sort(
      (a, b) =>
        score(a) - score(b) ||
        DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] ||
        a.title.localeCompare(b.title)
    );

  const problems = matches.slice(0, limit);
  return { problems, total: matches.length, hiddenCount: matches.length - problems.length };
}

// ---------- Message formatting ----------

export type MessageBlock = { type: "text"; text: string } | { type: "code"; code: string; language: string | null };

const FENCE = /^\s*```([A-Za-z0-9_+#.-]*)\s*$/;

/**
 * Splits a reply into prose and fenced code blocks so code can be
 * shown in monospace with horizontal scrolling. A fence is a line
 * holding only three backticks and an optional language. A fence
 * that is never closed (for example a reply cut off at the token
 * limit) runs to the end of the message as code. Inline backticks
 * are left alone.
 */
export function splitMessageBlocks(content: string): MessageBlock[] {
  const blocks: MessageBlock[] = [];
  let buffer: string[] = [];
  let inCode = false;
  let language: string | null = null;

  const flushText = () => {
    const text = buffer.join("\n").replace(/^\n+/, "").replace(/\s+$/, "");
    if (text.length > 0) blocks.push({ type: "text", text });
    buffer = [];
  };
  const flushCode = () => {
    const code = buffer.join("\n").replace(/\n+$/, "");
    if (code.length > 0) blocks.push({ type: "code", code, language });
    buffer = [];
  };

  for (const line of content.split("\n")) {
    const fence = FENCE.exec(line);
    if (fence) {
      if (inCode) {
        flushCode();
        inCode = false;
        language = null;
      } else {
        flushText();
        inCode = true;
        language = fence[1] ? fence[1] : null;
      }
      continue;
    }
    buffer.push(line);
  }

  if (inCode) flushCode();
  else flushText();
  return blocks;
}

// ---------- Draft validation ----------

/**
 * Mirrors MAX_MESSAGE_LENGTH in services/mentor/mentor-service.ts so
 * the composer can stop an over-long draft before it is sent. The
 * server stays authoritative and is not changed; keep the two in sync.
 */
export const MENTOR_MESSAGE_MAX_LENGTH = 4000;

/** The character counter appears once a draft reaches this share of the limit. */
const COUNTER_FROM = Math.floor(MENTOR_MESSAGE_MAX_LENGTH * 0.8);

export type DraftStatus = {
  /** Length after trimming, which is how the server measures it. */
  length: number;
  remaining: number;
  isEmpty: boolean;
  isOverLimit: boolean;
  showCounter: boolean;
  canSend: boolean;
};

export function getDraftStatus(text: string): DraftStatus {
  const length = text.trim().length;
  const isEmpty = length === 0;
  const isOverLimit = length > MENTOR_MESSAGE_MAX_LENGTH;
  return {
    length,
    remaining: MENTOR_MESSAGE_MAX_LENGTH - length,
    isEmpty,
    isOverLimit,
    showCounter: length >= COUNTER_FROM,
    canSend: !isEmpty && !isOverLimit,
  };
}

// ---------- Failed sends ----------

export type SendFailure = {
  /** "signed-out" and "validation" mean nothing was saved; "ai-failure" means the message is saved but the Mentor did not reply. */
  kind: "signed-out" | "validation" | "ai-failure";
  messageSaved: boolean;
  headline: string;
  detail: string;
  /** The server's own wording, kept for display or logging. */
  reason: string;
};

// The server action returns the same { ok: false, error } shape for every failure, so the
// cases where nothing was saved are recognised by their exact wording (see actions/mentor.ts
// and services/mentor/mentor-service.ts). Everything else comes after the user message was
// already stored, because the service saves it before calling the provider.
const SIGNED_OUT_ERROR = "You need to be signed in.";
const EMPTY_ERROR = "Type a message first.";
const TOO_LONG_ERROR_PREFIX = "That message is too long";

/**
 * Explains a failed send without offering to re-send it: a message
 * that was saved must not be saved a second time. The guidance for
 * a saved message is to send a follow-up when ready.
 */
export function classifySendFailure(error: string, retryable: boolean): SendFailure {
  if (error === SIGNED_OUT_ERROR) {
    return {
      kind: "signed-out",
      messageSaved: false,
      headline: "You are signed out.",
      detail: "Your message was not sent. Sign in again, then write it again.",
      reason: error,
    };
  }
  if (error === EMPTY_ERROR || error.startsWith(TOO_LONG_ERROR_PREFIX)) {
    return {
      kind: "validation",
      messageSaved: false,
      headline: "That message could not be sent.",
      detail: "It was not saved. Edit it and send it again.",
      reason: error,
    };
  }
  return {
    kind: "ai-failure",
    messageSaved: true,
    headline: "The Mentor could not reply this time.",
    detail: `Your message is saved in the conversation. You can send a follow-up when you are ready.${retryable ? " This is usually temporary." : ""}`,
    reason: error,
  };
}