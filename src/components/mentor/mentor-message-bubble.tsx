import { Bot, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HINT_LEVELS } from "@/lib/mentor/config";
import { cn } from "@/lib/utils";

export type MentorChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  hintLevel: number | null;
};

export function MentorMessageBubble({ message }: { message: MentorChatMessage }) {
  const isUser = message.role === "user";
  const hint = message.hintLevel !== null ? HINT_LEVELS.find((h) => h.level === message.hintLevel) : null;

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-surface-muted text-foreground-muted" : "bg-brand-subtle text-brand"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn("max-w-[85%] space-y-1", isUser && "items-end text-right")}>
        {hint && (
          <Badge variant="brand">
            Hint {hint.level}/6 — {hint.name}
          </Badge>
        )}
        <div
          className={cn(
            "whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
            isUser ? "bg-brand text-brand-foreground" : "bg-surface-muted text-foreground"
          )}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}
