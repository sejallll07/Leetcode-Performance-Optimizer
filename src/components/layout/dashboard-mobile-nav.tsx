"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import { Logo } from "@/components/layout/logo";

export function DashboardMobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="flex h-9 w-9 items-center justify-center rounded-md text-foreground"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex w-72 flex-col overflow-y-auto bg-surface">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <Logo />

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-md text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <DashboardNav />
          </div>

          <button
            type="button"
            aria-label="Close menu"
            className="flex-1 bg-black/40"
            onClick={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}