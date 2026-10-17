"use client";

import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { Bot } from "lucide-react";
import { sendMentorMessageAction } from "@/actions/mentor";
import { Button } from "@/components/ui/button";
import { MentorMessageBubble, type MentorChatMessage } from "@/components/mentor/mentor-message-bubble";

const SUGGESTIONS = [
  "What should I practice today?",
  "Why did my score decrease?",
  "What should I learn next?",
  "Give me a Binary Search problem.",
];

export function MentorChat({ initialMessages }: { initialMessages: MentorChatMessage[] }) {
  const [messages, setMessages] = useState<MentorChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPending]);

  function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isPending) return;
    setError(null);
    setInput("");
    // Persisted server-side before the AI call runs (see mentor-service.ts), so this
    // optimistic bubble stays even if the AI turn below fails — it isn't lost.
    setMessages((prev) => [...prev, { id: `pending-${Date.now()}`, role: "user", content: trimmed, hintLevel: null }]);

    startTransition(async () => {
      const result = await sendMentorMessageAction(trimmed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessages((prev) => [
        ...prev,
        { id: result.reply.id, role: "assistant", content: result.reply.content, hintLevel: result.reply.hintLevel },
      ]);
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-3 text-sm text-foreground-muted">
            <p>Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setInput(s)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-surface-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MentorMessageBubble key={m.id} message={m} />
        ))}

        {isPending && (
          <div className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground-muted">Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <div className="border-t border-border bg-danger/10 px-4 py-2 text-xs text-danger">{error}</div>}

      <div className="flex items-end gap-2 border-t border-border p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask your mentor anything..."
          rows={1}
          disabled={isPending}
          className="max-h-32 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <Button onClick={() => handleSend(input)} disabled={isPending || input.trim().length === 0} size="md">
          {isPending ? "Sending..." : "Send"}
        </Button>
      </div>
    </div>
  );
}
