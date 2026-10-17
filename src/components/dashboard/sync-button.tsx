"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SyncButton({
  onClick,
  isPending,
}: {
  onClick: () => void;
  isPending: boolean;
}) {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onClick}
      disabled={isPending}
    >
      <RefreshCw
        className={cn("h-4 w-4", isPending && "animate-spin")}
      />
      {isPending ? "Syncing..." : "Sync now"}
    </Button>
  );
}