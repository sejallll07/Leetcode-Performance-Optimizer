"use client";

import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent, type UIEvent } from "react";
import { ArrowDown, Bot } from "lucide-react";
import { sendMentorMessageAction } from "@/actions/mentor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MentorMessageBubble, type MentorChatMessage } from "@/components/mentor/mentor-message-bubble";
import { MentorProblemBar } from "@/components/mentor/mentor-problem-bar";
import { MentorQuickActions } from "@/components/mentor/mentor-quick-actions";
import { MentorStartPanel } from "@/components/mentor/mentor-start-panel";
import {
  classifySendFailure,
  findProblem,
  getDraftStatus,
  getLadderState,
  getQuickActions,
  latestProblemSlug,
  type MentorCatalogProblem,
  type MentorViewMessage,
  type SendFailure,
} from "@/lib/mentor/mentor-view";
import { cn } from "@/lib/utils";

type MentorChatProps = {
  initialMessages: MentorChatMessage[];
  /** Only slug, title, difficulty and topicSlugs. Optional so the page can add it in a later step. */
  catalog?: MentorCatalogProblem[];
  /** Merged onto the outer box, so a parent (such as a floating window) can restyle the frame. */
  className?: string;
};

const EMPTY_CATALOG: MentorCatalogProblem[] = [];
const MAX_TEXTAREA_HEIGHT = 160;
/** Within this many pixels of the bottom counts as "reading the latest messages". */
const NEAR_BOTTOM_PX = 80;

function toViewMessages(messages: MentorChatMessage[]): MentorViewMessage[] {
  return messages.map((m) => ({ role: m.role, hintLevel: m.hintLevel, problemSlug: m.problemSlug ?? null }));
}

/** Touch screens keep Enter for new lines; the Send button is the way to send there. */
function usesTouchInput(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function MentorChat({ initialMessages, catalog = EMPTY_CATALOG, className }: MentorChatProps) {
  const [messages, setMessages] = useState<MentorChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [failure, setFailure] = useState<SendFailure | null>(null);
  const [activeSlug, setActiveSlug] = useState<string | null>(() =>
    latestProblemSlug(toViewMessages(initialMessages))
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hasUnseen, setHasUnseen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasScrolledRef = useRef(false);
  /** True while the student is at (or near) the bottom, so new content should be followed. */
  const stickRef = useRef(true);
  const helpId = useId();
  const counterId = useId();

  const activeProblem = findProblem(catalog, activeSlug);
  const ladder = getLadderState(toViewMessages(messages), activeProblem ? activeProblem.slug : null);
  const quickActions = getQuickActions(activeProblem, ladder);
  const draft = getDraftStatus(input);
  const isEmptyThread = messages.length === 0;
  const showPicker = pickerOpen || (isEmptyThread && activeProblem === null);

  // Follow new content only when the student is already near the bottom (or has just sent a message).
  // The first scroll is instant, and smooth scrolling is skipped under reduced motion.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (showPicker) {
      el.scrollTop = 0;
      return;
    }
    if (!stickRef.current) return;
    const smooth = hasScrolledRef.current && !prefersReducedMotion();
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    hasScrolledRef.current = true;
  }, [messages, isPending, showPicker]);

  // Auto-grow the composer. The box uses border-box sizing, so the border widths must be added to
  // scrollHeight; otherwise the box is a couple of pixels short and always shows a scrollbar.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const style = window.getComputedStyle(el);
    const borders = (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
    el.style.height = "auto";
    const wanted = el.scrollHeight + borders;
    el.style.height = `${Math.min(wanted, MAX_TEXTAREA_HEIGHT)}px`;
    el.style.overflowY = wanted > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
  }, [input]);

  function handleScroll(e: UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
    stickRef.current = nearBottom;
    if (nearBottom) setHasUnseen(false);
  }

  function jumpToLatest() {
    const el = scrollRef.current;
    stickRef.current = true;
    setHasUnseen(false);
    el?.scrollTo({ top: el.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  /** Opens the picker without touching the selected problem, so "Back" can restore it. */
  function openPicker() {
    setPickerOpen(true);
  }

  function closePicker() {
    stickRef.current = true;
    setPickerOpen(false);
  }

  function handleSelectProblem(slug: string) {
    setActiveSlug(slug);
    closePicker();
  }

  function send(text: string, clearDraft: boolean) {
    if (isPending) return;
    // Client-side check: an empty or over-long draft never creates a bubble.
    if (!getDraftStatus(text).canSend) return;

    const trimmed = text.trim();
    const pendingId = `pending-${Date.now()}`;

    stickRef.current = true;
    setHasUnseen(false);
    setPickerOpen(false);
    setFailure(null);
    if (clearDraft) setInput("");
    // The server saves the user message before the AI call runs, so this bubble matches what is stored
    // unless the failure below says it was not saved.
    setMessages((prev) => [
      ...prev,
      { id: pendingId, role: "user", content: trimmed, hintLevel: null, problemSlug: null },
    ]);

    startTransition(async () => {
      const result = await sendMentorMessageAction(trimmed);

      if (!result.ok) {
        const classified = classifySendFailure(result.error, result.retryable);
        setFailure(classified);
        if (!classified.messageSaved) {
          // Nothing was stored: drop the bubble and hand the text back for editing. The student sends it again.
          setMessages((prev) => prev.filter((m) => m.id !== pendingId));
          setInput((current) => (current.length === 0 ? trimmed : current));
        }
        return;
      }

      const reply = result.reply;
      setMessages((prev) => [
        ...prev,
        {
          id: reply.id,
          role: "assistant",
          content: reply.content,
          hintLevel: reply.hintLevel,
          problemSlug: reply.problemSlug ?? null,
        },
      ]);
      if (reply.problemSlug) setActiveSlug(reply.problemSlug);
      // A reply that lands while the student is reading older messages must not drag them down.
      if (!stickRef.current) setHasUnseen(true);
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    if (usesTouchInput()) return;
    e.preventDefault();
    send(input, true);
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface",
        className
      )}
    >
      {activeProblem && !pickerOpen && (
        <div className="shrink-0 border-b border-border p-3">
          <MentorProblemBar problem={activeProblem} ladder={ladder} onChange={openPicker} />
        </div>
      )}

      {!activeProblem && !isEmptyThread && !pickerOpen && catalog.length > 0 && (
        <div className="shrink-0 border-b border-border px-3 py-2">
          <Button type="button" variant="ghost" size="sm" onClick={openPicker} disabled={isPending}>
            Choose a problem to practice
          </Button>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          role="region"
          aria-label="Mentor panel"
          tabIndex={0}
          onScroll={handleScroll}
          className="mentor-scrollbar h-full overflow-y-auto p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
        >
          {showPicker && (
            <div className="space-y-3">
              {pickerOpen && (activeProblem !== null || !isEmptyThread) && (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Choose a problem</p>
                    {activeProblem && (
                      <p className="truncate text-xs text-foreground-muted">{`Current: ${activeProblem.title}`}</p>
                    )}
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={closePicker}>
                    {isEmptyThread ? "Back" : "Back to conversation"}
                  </Button>
                </div>
              )}
              <MentorStartPanel
                compact
                catalog={catalog}
                onSelectProblem={handleSelectProblem}
                onAskQuestion={(question) => send(question, false)}
                disabled={isPending}
              />
            </div>
          )}

          {!showPicker && isEmptyThread && activeProblem && (
            <p className="text-sm text-foreground-muted">
              {`Ask a question about ${activeProblem.title}, or use a quick action below.`}
            </p>
          )}

          {/* Always mounted so replies keep being announced; hidden while the picker is showing. */}
          <div
            role="log"
            aria-label="Conversation with your mentor"
            aria-live="polite"
            className={cn("space-y-4", showPicker && "hidden")}
          >
            {messages.map((m) => (
              <MentorMessageBubble key={m.id} message={m} />
            ))}

            {isPending && (
              <div className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand">
                  <Bot className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground-muted">
                  {"Your mentor is thinking\u2026"}
                </div>
              </div>
            )}
          </div>
        </div>

        {hasUnseen && !showPicker && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="pointer-events-auto shadow-md"
              onClick={jumpToLatest}
              aria-label="Jump to latest message"
            >
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
              Jump to latest
            </Button>
          </div>
        )}
      </div>

      {quickActions.length > 0 && !showPicker && (
        <div className="mentor-scrollbar shrink-0 border-t border-border px-3 pt-3 [&_[role=group]]:[scrollbar-width:thin]">
          <MentorQuickActions
            actions={quickActions}
            onSend={(message) => send(message, false)}
            onPickAnother={openPicker}
            disabled={isPending}
          />
        </div>
      )}

      {failure && (
        <div role="alert" className="shrink-0 space-y-1 border-t border-border bg-danger-subtle px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-danger">{failure.headline}</p>
            {failure.messageSaved ? (
              <Badge variant="neutral">Message saved</Badge>
            ) : (
              <Badge variant="warning">Not saved</Badge>
            )}
          </div>
          <p className="text-foreground-muted">{failure.detail}</p>
          {failure.kind === "ai-failure" && (
            <p className="text-xs text-foreground-muted">{`Details: ${failure.reason}`}</p>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => setFailure(null)}>
            Dismiss
          </Button>
        </div>
      )}

      <div className="shrink-0 space-y-1.5 border-t border-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your mentor anything..."
            rows={1}
            aria-label="Message to your mentor"
            aria-describedby={draft.showCounter ? `${helpId} ${counterId}` : helpId}
            aria-invalid={draft.isOverLimit}
            className={cn(
              "mentor-scrollbar min-h-10 flex-1 resize-none overflow-y-hidden rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand",
              draft.isOverLimit ? "border-danger" : "border-border"
            )}
          />
          <Button type="button" onClick={() => send(input, true)} disabled={isPending || !draft.canSend} size="md">
            {isPending ? "Sending..." : "Send"}
          </Button>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <p id={helpId} className="text-xs text-foreground-muted">
            Computer: Enter sends, Shift+Enter adds a line. Touch screen: use the Send button.
          </p>
          {draft.showCounter &&
            (draft.isOverLimit ? (
              <p id={counterId} role="status" className="text-xs font-medium text-danger">
                {`${-draft.remaining} over the limit. Shorten your message to send it.`}
              </p>
            ) : (
              <p id={counterId} className="text-xs text-foreground-muted">
                {`${draft.remaining} characters left`}
              </p>
            ))}
        </div>
      </div>
    </div>
  );
}