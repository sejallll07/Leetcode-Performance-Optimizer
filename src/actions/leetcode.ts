"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GraphQLLeetCodeProvider } from "@/services/leetcode/graphql-leetcode-provider";
import { syncLeetCodeProfile } from "@/services/leetcode/ingestion-service";
import { getLeetCodeProfileByUserId } from "@/repositories/leetcode-repository";
import { recomputeAnalyticsForUser } from "@/services/analytics/analytics-service";
import { syncRevisionItemsForUser } from "@/services/revision/revision-service";

const provider = new GraphQLLeetCodeProvider();

/**
 * Post-sync bookkeeping (analytics recompute, revision-item sync) is
 * a courtesy, not a critical path — a sync that stored real LeetCode
 * data should never be reported as failed just because one of these
 * (separate, deterministic) follow-up steps hit a bug. Errors are
 * swallowed here and would show up in server logs.
 */
async function runPostSyncStepsQuietly(userId: string): Promise<void> {
  try {
    await recomputeAnalyticsForUser(userId);
  } catch (err) {
    console.error("Analytics recompute failed after a successful sync:", err);
  }
  try {
    await syncRevisionItemsForUser(userId);
  } catch (err) {
    console.error("Revision item sync failed after a successful sync:", err);
  }
}

export type ConnectLeetCodeState = {
  error?: string;
  success?: boolean;
};

/** Bound to the "connect your profile" form (see LeetCodeConnectForm). */
export async function connectLeetCodeProfileAction(
  _prevState: ConnectLeetCodeState,
  formData: FormData
): Promise<ConnectLeetCodeState> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: "You need to be signed in." };
  }

  const username = String(formData.get("username") ?? "");
  const result = await syncLeetCodeProfile(provider, session.user.id, username);

  if (!result.ok) {
    return { error: result.error };
  }

  await runPostSyncStepsQuietly(session.user.id);
  return { success: true };
}

export type SyncActionResult = { ok: true } | { ok: false; error: string };

/** Bound to the "Sync now" button on an already-connected profile. */
export async function syncLeetCodeProfileAction(): Promise<SyncActionResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false, error: "You need to be signed in." };
  }

  const existing = await getLeetCodeProfileByUserId(session.user.id);
  if (!existing) {
    return { ok: false, error: "No LeetCode profile connected yet." };
  }

  const result = await syncLeetCodeProfile(provider, session.user.id, existing.leetcodeUsername);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  await runPostSyncStepsQuietly(session.user.id);
  return { ok: true };
}
