import { categorizeRevisionItems } from "@/lib/revision/revision-categorizer";
import { computeNextSchedule } from "@/lib/revision/revision-scheduler";
import type { RevisionCenterData, RevisionFeedback } from "@/lib/revision/types";
import {
  ensureRevisionItemsForSolvedProblems,
  getRevisionItemOwner,
  getRevisionItemsForUser,
  recordRevisionCompletion,
} from "@/repositories/revision-repository";

/** Called after a sync (alongside analytics recompute) — creates
 *  revision items for any newly-solved problems. Idempotent. */
export async function syncRevisionItemsForUser(userId: string): Promise<void> {
  await ensureRevisionItemsForSolvedProblems(userId);
}

export async function getRevisionCenterData(userId: string, now: Date = new Date()): Promise<RevisionCenterData> {
  const items = await getRevisionItemsForUser(userId);
  return categorizeRevisionItems(items, now);
}

export type CompleteRevisionResult = { ok: true } | { ok: false; error: string };

/**
 * Records a completed revision and reschedules it. Ownership is
 * checked here rather than trusted from the client — the Server
 * Action passes whatever `revisionItemId` the form posts, and
 * without this check one user could mark another's revision items.
 */
export async function completeRevision(
  userId: string,
  revisionItemId: string,
  feedback: RevisionFeedback,
  now: Date = new Date()
): Promise<CompleteRevisionResult> {
  const ownerId = await getRevisionItemOwner(revisionItemId);
  if (!ownerId) {
    return { ok: false, error: "That revision item doesn't exist." };
  }
  if (ownerId !== userId) {
    return { ok: false, error: "You don't have access to that revision item." };
  }

  // Re-fetch current state right before scheduling — avoids acting
  // on a stale interval index if something else changed it between
  // page load and this action.
  const items = await getRevisionItemsForUser(userId);
  const current = items.find((i) => i.id === revisionItemId);
  if (!current) {
    return { ok: false, error: "That revision item doesn't exist." };
  }

  const { intervalIndex: newInterval, dueAt } = computeNextSchedule(current.intervalIndex, feedback, now);
  await recordRevisionCompletion(revisionItemId, feedback, current.intervalIndex, newInterval, dueAt, now);

  return { ok: true };
}
