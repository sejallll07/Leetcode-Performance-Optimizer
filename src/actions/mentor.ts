"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendMentorMessage } from "@/services/mentor/mentor-service";
import type { MentorMessageRow } from "@/repositories/mentor-repository";

export type SendMentorMessageActionResult =
  | { ok: true; reply: MentorMessageRow }
  | { ok: false; error: string; retryable: boolean };

export async function sendMentorMessageAction(messageText: string): Promise<SendMentorMessageActionResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false, error: "You need to be signed in.", retryable: false };
  }
  return sendMentorMessage(session.user.id, messageText);
}
