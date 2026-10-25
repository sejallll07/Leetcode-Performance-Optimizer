import { Bot, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HINT_LEVELS } from "@/lib/mentor/config";
import { splitMessageBlocks, type MessageBlock } from "@/lib/mentor/mentor-view";
import { cn } from "@/lib/utils";

export type MentorChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  hintLevel: number | null;
  /** Optional so existing callers keep compiling; only assistant replies carry a slug. */
  problemSlug?: string | null;
};

export function MentorMessageBubble({ message }: { message: MentorChatMessage }) {
  const isUser = message.role === "user";
  const hint = message.hintLevel !== null ? HINT_LEVELS.find((h) => h.level === message.hintLevel) : null;

  const parsed = splitMessageBlocks(message.content);
  // Whitespace-only content yields no blocks; fall back so the bubble is never empty markup.
  const blocks: MessageBlock[] = parsed.length > 0 ? parsed : [{ type: "text", text: message.content }];

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
      <div className={cn("min-w-0 max-w-[85%] space-y-1 text-left", isUser && "flex flex-col items-end")}>
        {hint && (
          <Badge variant="brand">
            Hint {hint.level}/6 {"\u2014"} {hint.name}
          </Badge>
        )}
        <div
          className={cn(
            "min-w-0 max-w-full space-y-2 rounded-lg px-3 py-2 text-left text-sm",
            isUser ? "bg-brand text-brand-foreground" : "bg-surface-muted text-foreground"
          )}
        >
          {blocks.map((block, index) =>
            block.type === "code" ? (
              <div key={index} className="space-y-1">
                {block.language && (
                  <p className="text-xs font-medium text-foreground-muted">{block.language}</p>
                )}
                <pre
                  role="region"
                  aria-label={block.language ? `${block.language} code` : "Code"}
                  tabIndex={0}
                  className="overflow-x-auto rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs leading-relaxed text-foreground"
                >
                  <code>{block.code}</code>
                </pre>
              </div>
            ) : (
              <p key={index} className="whitespace-pre-wrap break-words">
                {block.text}
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}