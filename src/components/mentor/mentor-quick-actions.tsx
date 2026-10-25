"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { SKIP_CONFIRMATION, type QuickAction, type QuickActionId } from "@/lib/mentor/mentor-view";

type MentorQuickActionsProps = {
  /** The value returned by getQuickActions for the active problem. */
  actions: QuickAction[];
  /** Called with the ordinary student message for an action. The parent sends it. */
  onSend: (message: string) => void;
  /** Called for actions handled in the UI (message is null), such as picking another problem. */
  onPickAnother: () => void;
  /** Lock every control, for example while a reply is on its way. */
  disabled?: boolean;
};

export function MentorQuickActions({ actions, onSend, onPickAnother, disabled = false }: MentorQuickActionsProps) {
  const [confirmId, setConfirmId] = useState<QuickActionId | null>(null);
  const confirmPanelId = useId();

  // Derived from the current actions, so a stale confirmation vanishes on its own.
  const confirming = confirmId === null ? null : (actions.find((a) => a.id === confirmId && a.requiresConfirm) ?? null);

  if (actions.length === 0) return null;

  function handleAction(action: QuickAction) {
    if (action.requiresConfirm) {
      setConfirmId((current) => (current === action.id ? null : action.id));
      return;
    }
    setConfirmId(null);
    if (action.message === null) {
      onPickAnother();
      return;
    }
    onSend(action.message);
  }

  function handleConfirm() {
    if (confirming === null || confirming.message === null) return;
    const message = confirming.message;
    setConfirmId(null);
    onSend(message);
  }

  return (
    <div className="space-y-2">
      <div role="group" aria-label="Quick actions" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {actions.map((action) => {
          const isGuarded = action.requiresConfirm;
          return (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant={action.id === "hint" ? "primary" : isGuarded ? "ghost" : "secondary"}
              className="shrink-0"
              onClick={() => handleAction(action)}
              disabled={disabled}
              {...(isGuarded
                ? { "aria-expanded": confirming?.id === action.id, "aria-controls": confirmPanelId }
                : {})}
            >
              {isGuarded ? `${action.label}...` : action.label}
            </Button>
          );
        })}
      </div>

      {confirming && (
        <div
          id={confirmPanelId}
          role="group"
          aria-label="Confirm skipping to the solution"
          className="flex flex-col gap-2 rounded-md border border-border bg-surface-muted p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-foreground">{SKIP_CONFIRMATION.prompt}</p>
          <div className="flex shrink-0 gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => setConfirmId(null)}>
              {SKIP_CONFIRMATION.cancelLabel}
            </Button>
            <Button type="button" size="sm" variant="primary" onClick={handleConfirm} disabled={disabled}>
              {SKIP_CONFIRMATION.confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}