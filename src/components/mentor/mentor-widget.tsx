"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Bot, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MentorChat } from "@/components/mentor/mentor-chat";
import type { MentorChatMessage } from "@/components/mentor/mentor-message-bubble";
import type { MentorCatalogProblem } from "@/lib/mentor/mentor-view";
import { cn } from "@/lib/utils";

type MentorWidgetProps = {
  initialMessages: MentorChatMessage[];
  /** Only slug, title, difficulty and topicSlugs, exactly as the page already passes them. */
  catalog?: MentorCatalogProblem[];
};

type FocusTarget = "composer" | "launcher";

/** Touch screens should not pop the keyboard open just because the window opened. */
function usesTouchInput(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

/**
 * A floating launcher plus a chat window. MentorChat is ALWAYS rendered (never behind
 * `{open && ...}` and never given a changing key), so its conversation, draft, selected
 * problem, pending request and error state survive closing and reopening. Closed means
 * invisible, non-interactive, inert and hidden from assistive technology, not unmounted.
 */
export function MentorWidget({ initialMessages, catalog }: MentorWidgetProps) {
  const [open, setOpen] = useState(false);

  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** Set by the click handlers, consumed after the next commit, so focus never moves on first render. */
  const pendingFocusRef = useRef<FocusTarget | null>(null);

  const panelId = useId();
  const titleId = useId();

  useEffect(() => {
    const target = pendingFocusRef.current;
    if (target === null) return;
    pendingFocusRef.current = null;

    const panel = panelRef.current;
    if (target === "launcher") {
      launcherRef.current?.focus();
      return;
    }
    const composer = usesTouchInput() ? null : panel?.querySelector<HTMLTextAreaElement>("textarea");
    (composer ?? panel)?.focus();
  }, [open]);

  function openWidget() {
    pendingFocusRef.current = "composer";
    setOpen(true);
  }

  function closeWidget() {
    pendingFocusRef.current = "launcher";
    setOpen(false);
  }

  function handlePanelKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Escape" || e.defaultPrevented || e.nativeEvent.isComposing) return;
    // In a search box, the first Escape clears the text; only an empty box lets Escape close the window.
    const target = e.target;
    if (target instanceof HTMLInputElement && target.type === "search" && target.value !== "") return;
    e.stopPropagation();
    closeWidget();
  }

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={openWidget}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        aria-hidden={open}
        inert={open}
        className={cn(
          "fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-brand px-4 text-sm font-medium text-brand-foreground shadow-lg hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:[transition:none]",
          open
            ? "pointer-events-none invisible scale-90 opacity-0 [transition:opacity_150ms,scale_150ms,visibility_0s_linear_150ms]"
            : "visible scale-100 opacity-100 [transition:opacity_150ms,scale_150ms,visibility_0s]"
        )}
      >
        <MessageCircle className="h-5 w-5" aria-hidden="true" />
        <span>AI Mentor</span>
      </button>

      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-hidden={!open}
        inert={!open}
        tabIndex={-1}
        onKeyDown={handlePanelKeyDown}
        className={cn(
          "fixed z-40 flex origin-bottom-right flex-col overflow-hidden border border-border bg-surface shadow-2xl focus:outline-none motion-reduce:[transition:none]",
          "inset-x-0 bottom-0 h-[85dvh] rounded-t-2xl border-b-0 pb-[env(safe-area-inset-bottom)]",
          "sm:inset-x-auto sm:bottom-4 sm:right-4 sm:h-[min(40rem,calc(100dvh-5rem))] sm:w-[26rem] sm:max-w-[calc(100vw-2rem)] sm:rounded-xl sm:border-b sm:pb-0",
          open
            ? "visible translate-y-0 scale-100 opacity-100 [transition:opacity_200ms,translate_200ms,scale_200ms,visibility_0s]"
            : "pointer-events-none invisible translate-y-3 scale-95 opacity-0 [transition:opacity_200ms,translate_200ms,scale_200ms,visibility_0s_linear_200ms]"
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand">
              <Bot className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 id={titleId} className="truncate text-sm font-semibold text-foreground">
              AI Mentor
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-9 shrink-0 px-0"
            onClick={closeWidget}
            aria-label="Close AI Mentor"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {/* MentorChat already fills the available height and width.
        Remove its standalone frame because the widget panel supplies
        the border, radius, shadow and surface. */}
        <MentorChat
          initialMessages={initialMessages}
          catalog={catalog}
          className="rounded-none border-0 bg-transparent"
        />
      </div>
    </>
  );
}