"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";

/**
 * No "mounted" guard needed any more. ThemeProvider reads the theme
 * with useSyncExternalStore, so during hydration it reports "dark" —
 * exactly what the server rendered — and only then re-renders with the
 * real preference. That means this button's first client render always
 * matches the server HTML (Sun icon, "Switch to light mode"), and the
 * correct icon and label follow immediately after hydration, with no
 * placeholder, no effect, and no layout shift.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-9 w-9 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}