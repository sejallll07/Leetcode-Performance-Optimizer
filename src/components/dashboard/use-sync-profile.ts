"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncLeetCodeProfileAction } from "@/actions/leetcode";

/**
 * One shared hook instance (owned by DashboardHero, see that
 * file) rather than SyncButton and the auto-sync effect each calling
 * the action independently — that would mean two separate pending
 * states that don't know about each other (the status badge could
 * read "Synced" while a manual click is still in flight, or an
 * auto-triggered sync wouldn't disable the manual button), and in
 * the worst case both firing a sync at once.
 */
export function useSyncProfile() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function trigger() {
    setError(null);
    startTransition(async () => {
      const result = await syncLeetCodeProfileAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return { trigger, isPending, error };
}