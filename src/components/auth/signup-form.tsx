"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { signupAction, type SignupFormState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Lives here, not in src/actions/auth.ts: a "use server" file may only export
// async functions, so a plain object can't be exported from there.
const signupInitialState: SignupFormState = { ok: false };

export function SignupForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(signupAction, signupInitialState);

  // Kept only so we can auto-sign-in with the same credentials right
  // after the account is created — the form submission itself goes
  // through `formAction`/FormData, not these.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!state.ok) return;

    let cancelled = false;

    (async () => {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (cancelled) return;

      if (result?.error) {
        router.push("/login");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  // Once the account is created, `state.ok` stays true while we
  // auto-sign-in and redirect — no separate "signing in" state needed.
  const busy = isPending || state.ok;

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" type="text" autoComplete="name" required />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="mt-1 text-xs text-foreground-muted">At least 8 characters.</p>
      </div>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
