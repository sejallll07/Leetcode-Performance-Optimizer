"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { completeRevision } from "@/services/revision/revision-service";
import type { RevisionFeedback } from "@/lib/revision/types";

export type CompleteRevisionActionResult = { ok: true } | { ok: false; error: string };

export async function completeRevisionAction(
  revisionItemId: string,
  feedback: RevisionFeedback
): Promise<CompleteRevisionActionResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false, error: "You need to be signed in." };
  }

  return completeRevision(session.user.id, revisionItemId, feedback);
}
