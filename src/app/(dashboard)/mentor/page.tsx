import type { Metadata } from "next";
import { getCurrentSession } from "@/lib/session";
import { getMentorConversation } from "@/services/mentor/mentor-service";
import { MentorChat } from "@/components/mentor/mentor-chat";

export const metadata: Metadata = {
  title: "AI Mentor — DSA Intelligence",
};

export default async function MentorPage() {
  const session = await getCurrentSession();
  const messages = session?.user
    ? await getMentorConversation(session.user.id)
    : [];

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col">
      <div className="mb-4 shrink-0">
        <h1 className="text-2xl font-semibold text-foreground">
          AI Mentor
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Ask what to practice, why a topic is weak, or get a progressive hint
          on a problem — answers are grounded in your own data, not generic
          DSA advice.
        </p>
      </div>

      <MentorChat
        initialMessages={messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          hintLevel: m.hintLevel,
        }))}
      />
    </div>
  );
}