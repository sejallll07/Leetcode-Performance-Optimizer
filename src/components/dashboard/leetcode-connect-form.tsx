"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { connectLeetCodeProfileAction, type ConnectLeetCodeState } from "@/actions/leetcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Lives here, not in src/actions/leetcode.ts: a "use server" file may only export
// async functions, so a plain object can't be exported from there.
const connectLeetCodeInitialState: ConnectLeetCodeState = {};

export function LeetCodeConnectForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    connectLeetCodeProfileAction,
    connectLeetCodeInitialState
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="username">LeetCode username</Label>
        <Input
          id="username"
          name="username"
          type="text"
          placeholder="e.g. your-leetcode-handle"
          autoComplete="off"
          required
          disabled={isPending}
        />
        <p className="mt-1 text-xs text-foreground-muted">
          This is the handle in your profile URL — leetcode.com/u/<span className="italic">this part</span>/
        </p>
      </div>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Connecting..." : "Connect profile"}
      </Button>
    </form>
  );
}
