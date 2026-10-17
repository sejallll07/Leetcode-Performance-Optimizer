"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInterviewReadiness, listRecentMockInterviews, startMockInterview, submitMockInterviewOutcomes } from "@/services/interview/interview-service";
import type { InterviewReadinessResult, MockInterviewProblemOutcome, MockInterviewSessionResult } from "@/lib/interview/types";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function requireUserId(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, error: "You need to be signed in." };
  return { ok: true, userId: session.user.id };
}

export async function getInterviewReadinessAction(): Promise<ActionResult<InterviewReadinessResult>> {
  const auth = await requireUserId();
  if (!auth.ok) return auth;
  const result = await getInterviewReadiness(auth.userId);
  return result.ok ? { ok: true, data: result.readiness } : { ok: false, error: result.error };
}

export async function startMockInterviewAction(): Promise<ActionResult<MockInterviewSessionResult>> {
  const auth = await requireUserId();
  if (!auth.ok) return auth;
  const result = await startMockInterview(auth.userId);
  return result.ok ? { ok: true, data: result.session } : { ok: false, error: result.error };
}

export async function submitMockInterviewOutcomesAction(sessionId: string, outcomes: MockInterviewProblemOutcome[]): Promise<ActionResult<MockInterviewSessionResult>> {
  const auth = await requireUserId();
  if (!auth.ok) return auth;
  if (typeof sessionId !== "string" || !sessionId) return { ok: false, error: "Invalid session." };
  const result = await submitMockInterviewOutcomes(auth.userId, sessionId, outcomes);
  return result.ok ? { ok: true, data: result.session } : { ok: false, error: result.error };
}

export async function listRecentMockInterviewsAction(): Promise<ActionResult<MockInterviewSessionResult[]>> {
  const auth = await requireUserId();
  if (!auth.ok) return auth;
  const sessions = await listRecentMockInterviews(auth.userId);
  return { ok: true, data: sessions };
}
