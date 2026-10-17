import { getMentorAnalyticsBundle } from "@/services/analytics/analytics-service";
import { getRevisionCenterData } from "@/services/revision/revision-service";
import { findUserById } from "@/repositories/user-repository";
import {
  getHintSignalsForUser,
  getMentorMessagesForUser,
  insertMentorMessage,
  type MentorMessageRow,
} from "@/repositories/mentor-repository";
import { loadProblemCatalog } from "@/repositories/problem-catalog-repository";
import { buildMentorContext } from "@/lib/mentor/context-builder";
import { buildMentorSystemPrompt } from "@/lib/mentor/system-prompt";
import { computeHintProgress } from "@/lib/mentor/hint-tracking";
import { searchProblemCatalog } from "@/lib/mentor/problem-search";
import { MENTOR_CONFIG } from "@/lib/mentor/config";
import { ClaudeMentorProvider } from "@/services/mentor/claude-mentor-provider";
import type { MentorProvider } from "@/services/mentor/mentor-provider";
import type { MentorChatTurn } from "@/lib/mentor/types";

export type SendMentorMessageResult =
  | { ok: true; reply: MentorMessageRow }
  | { ok: false; error: string; retryable: boolean };

const MAX_MESSAGE_LENGTH = 4000;

/** The whole visible conversation, oldest first — what the chat page renders. */
export async function getMentorConversation(userId: string): Promise<MentorMessageRow[]> {
  return getMentorMessagesForUser(userId);
}

/**
 * The one entry point for a mentor turn: persist the student's
 * message, gather the structured context (never raw DB access for
 * the model — see context-builder.ts), build the system prompt,
 * call the provider (real Claude by default; swappable — see
 * mentor-provider.ts), and persist the reply. Returns a Result, not
 * a throw: an AI failure is a routine, expected outcome here, not
 * an exceptional one, so the caller (the server action) can show it
 * to the student directly rather than a generic error boundary.
 */
export async function sendMentorMessage(
  userId: string,
  messageText: string,
  options: { provider?: MentorProvider; now?: Date } = {}
): Promise<SendMentorMessageResult> {
  const trimmed = messageText.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "Type a message first.", retryable: false };
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: "That message is too long — try breaking it into smaller questions.", retryable: false };
  }

  const provider = options.provider ?? new ClaudeMentorProvider();
  const now = options.now ?? new Date();

  // Persisted immediately, before the AI call — a failed or slow AI
  // turn should never lose what the student actually typed.
  await insertMentorMessage({ userId, role: "user", content: trimmed, hintLevel: null, problemSlug: null });

  const [user, bundle, revisionData, catalog, recentMessages, hintSignals] = await Promise.all([
    findUserById(userId),
    getMentorAnalyticsBundle(userId, now),
    getRevisionCenterData(userId),
    loadProblemCatalog(),
    getMentorMessagesForUser(userId, MENTOR_CONFIG.historyMessageLimit),
    getHintSignalsForUser(userId),
  ]);

  const studentName = user?.name ?? "there";

  const context = bundle
    ? buildMentorContext({
        studentName,
        hasProfile: true,
        analytics: bundle.analytics,
        progressTrend: bundle.progressTrend,
        revisionData,
        roadmap: bundle.roadmap,
        submissions: bundle.submissions,
        now,
      })
    : buildMentorContext({ studentName, hasProfile: false });

  // Hint progress is computed from *every* message that ever carried a hintLevel,
  // not just the capped `recentMessages` window used for conversational context —
  // see getHintSignalsForUser's own comment for why.
  const hintProgress = computeHintProgress(hintSignals);
  const problemTitleBySlug = new Map(catalog.map((p) => [p.slug, p.title]));
  const systemPrompt = buildMentorSystemPrompt(context, hintProgress, problemTitleBySlug);

  const history: MentorChatTurn[] = recentMessages.map((m) => ({ role: m.role, content: m.content }));
  const solvedSlugs = new Set(bundle?.submissions.map((s) => s.problemSlug) ?? []);

  const result = await provider.sendMessage({
    systemPrompt,
    history,
    searchCatalog: (filters) => searchProblemCatalog(catalog, { ...filters, excludeSlugs: [...solvedSlugs] }),
  });

  if (!result.ok) {
    return result;
  }

  const reply = await insertMentorMessage({
    userId,
    role: "assistant",
    content: result.message,
    hintLevel: result.hintLevel,
    problemSlug: result.problemSlug,
  });

  return { ok: true, reply };
}
