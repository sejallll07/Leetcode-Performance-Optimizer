"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UserMenu({ email }: { email: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-foreground-muted sm:inline">{email}</span>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => signOut({ callbackUrl: "/" })}
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </div>
  );
}
