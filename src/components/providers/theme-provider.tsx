"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

type Theme = "light" | "dark";
type ThemeContextValue = { theme: Theme; toggleTheme: () => void };

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "theme";

/**
 * The theme lives in one place: the `data-theme` attribute on <html>.
 * The blocking script in the root layout's <head> sets it before first
 * paint when the stored preference is "light"; dark needs no attribute
 * at all (it's the CSS default, see globals.css). So React doesn't keep
 * its own copy of the theme in state — it reads that attribute, as an
 * external store, with useSyncExternalStore.
 *
 * That's what makes this hydration-safe without an effect: during
 * hydration React uses getServerSnapshot ("dark" — the only thing the
 * server can know and what the server HTML was rendered with), then,
 * if the real attribute says otherwise, re-renders with it right after
 * hydration. No setState-in-an-effect, no mismatch warning.
 */
function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function getServerTheme(): Theme {
  return "dark";
}

/** Notifies React whenever <html>'s data-theme attribute changes — from the toggle, or from anything else. */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function applyTheme(theme: Theme): void {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Some privacy modes throw on localStorage access — theme still
    // works for the current session, it just won't persist.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, getServerTheme);

  // Reads the live attribute rather than closing over `theme`, so the
  // callback is stable and always flips whatever is actually on screen.
  const toggleTheme = useCallback(() => {
    applyTheme(readTheme() === "light" ? "dark" : "light");
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}