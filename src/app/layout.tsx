import type { Metadata } from "next";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "DSA Intelligence — Your personal DSA coach",
  description:
    "Connect your LeetCode profile and get a real diagnosis of what you're strong at, what you're weak at, and what to practice next.",
};

/**
 * Sets data-theme="light" on <html> before first paint if that's
 * the stored preference — dark needs no attribute at all (it's the
 * CSS default, see globals.css), so this only ever has to act for
 * the light case. Runs as a blocking inline script, not a
 * useEffect, because a useEffect only fires after React's first
 * paint — exactly the flash of the wrong theme this exists to
 * prevent. try/catch guards the rare case localStorage throws
 * (some privacy modes); theme then just falls back to dark for that
 * load rather than erroring.
 */
const THEME_INIT_SCRIPT = `(function(){try{if(localStorage.getItem('theme')==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <ThemeProvider>
          <AuthSessionProvider>{children}</AuthSessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}