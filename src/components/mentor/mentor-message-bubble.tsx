import type { ReactNode } from "react";
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

// ---------- Minimal, safe Markdown for assistant replies ----------
// Builds React elements only (text stays text), so model output can never become raw HTML.
// Supported: **bold**, *italic*, `inline code`, # headings, - / * / + lists, 1. lists, --- rules.
// Anything else (links, tables, images, nested lists) is left as plain text.

type InlineNode =
  | { kind: "text"; value: string }
  | { kind: "code"; value: string }
  | { kind: "strong"; children: InlineNode[] }
  | { kind: "em"; children: InlineNode[] };

type TextBlockNode =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "rule" };

const MAX_INLINE_DEPTH = 3;
const HEADING = /^\s{0,3}#{1,6}\s+(.*)$/;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const BULLET = /^\s*[-*+]\s+(.+)$/;
const ORDERED = /^\s*\d{1,3}[.)]\s+(.+)$/;

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9_]/.test(ch);
}

function isSpace(ch: string | undefined): boolean {
  return ch === undefined || /\s/.test(ch);
}

function parseInline(text: string, depth = 0): InlineNode[] {
  const nodes: InlineNode[] = [];
  let buffer = "";
  let i = 0;

  const flush = () => {
    if (buffer.length > 0) {
      nodes.push({ kind: "text", value: buffer });
      buffer = "";
    }
  };

  while (i < text.length) {
    const ch = text[i];

    if (ch === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i + 1) {
        flush();
        nodes.push({ kind: "code", value: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    if (ch === "*" && text[i + 1] === "*" && depth < MAX_INLINE_DEPTH) {
      const end = text.indexOf("**", i + 2);
      if (end > i + 2) {
        const inner = text.slice(i + 2, end);
        if (!isSpace(inner[0]) && !isSpace(inner[inner.length - 1])) {
          flush();
          nodes.push({ kind: "strong", children: parseInline(inner, depth + 1) });
          i = end + 2;
          continue;
        }
      }
    }

    if (
      ch === "*" &&
      text[i + 1] !== "*" &&
      depth < MAX_INLINE_DEPTH &&
      !isWordChar(text[i - 1]) &&
      !isSpace(text[i + 1])
    ) {
      const end = text.indexOf("*", i + 1);
      if (end > i + 1 && text[end + 1] !== "*" && !isSpace(text[end - 1]) && !isWordChar(text[end + 1])) {
        flush();
        nodes.push({ kind: "em", children: parseInline(text.slice(i + 1, end), depth + 1) });
        i = end + 1;
        continue;
      }
    }

    buffer += ch;
    i += 1;
  }

  flush();
  return nodes;
}

function isSpecialLine(line: string): boolean {
  return HEADING.test(line) || RULE.test(line) || BULLET.test(line) || ORDERED.test(line);
}

function parseTextBlocks(text: string): TextBlockNode[] {
  const lines = text.split(/\r?\n/);
  const blocks: TextBlockNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", text: heading[1].replace(/\s+#+\s*$/, "") });
      i += 1;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ kind: "rule" });
      i += 1;
      continue;
    }

    if (BULLET.test(line) || ORDERED.test(line)) {
      const ordered = !BULLET.test(line);
      const pattern = ordered ? ORDERED : BULLET;
      const items: string[] = [];
      while (i < lines.length) {
        const match = pattern.exec(lines[i]);
        if (!match) break;
        items.push(match[1]);
        i += 1;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !isSpecialLine(lines[i])) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push({ kind: "paragraph", text: paragraph.join("\n") });
  }

  return blocks;
}

function renderInline(nodes: InlineNode[]): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.kind) {
      case "text":
        return node.value;
      case "code":
        return (
          <code key={index} className="rounded border border-border bg-surface px-1 py-0.5 font-mono text-[0.85em]">
            {node.value}
          </code>
        );
      case "strong":
        return (
          <strong key={index} className="font-semibold">
            {renderInline(node.children)}
          </strong>
        );
      case "em":
        return <em key={index}>{renderInline(node.children)}</em>;
    }
  });
}

function MarkdownText({ text }: { text: string }) {
  return (
    <>
      {parseTextBlocks(text).map((block, index) => {
        switch (block.kind) {
          case "heading":
            return (
              <p key={index} className="break-words font-semibold">
                {renderInline(parseInline(block.text))}
              </p>
            );
          case "rule":
            return <hr key={index} className="border-border" />;
          case "list": {
            const items = block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="break-words">
                {renderInline(parseInline(item))}
              </li>
            ));
            return block.ordered ? (
              <ol key={index} className="list-decimal space-y-1 pl-5">
                {items}
              </ol>
            ) : (
              <ul key={index} className="list-disc space-y-1 pl-5">
                {items}
              </ul>
            );
          }
          case "paragraph":
            return (
              <p key={index} className="whitespace-pre-wrap break-words">
                {renderInline(parseInline(block.text))}
              </p>
            );
        }
      })}
    </>
  );
}

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
            ) : isUser ? (
              <p key={index} className="whitespace-pre-wrap break-words">
                {block.text}
              </p>
            ) : (
              <MarkdownText key={index} text={block.text} />
            )
          )}
        </div>
      </div>
    </div>
  );
}