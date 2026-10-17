import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Every protected route currently has both its layout (session gate
 * + redirect) and its own page (session.user.id for data fetching)
 * calling getServerSession independently — same request, same
 * result, computed twice. React's cache() memoizes a function's
 * result per request (not across requests, and not a real cache —
 * it's request-scoped dedup), which is exactly the shape of this
 * problem: free to call getCurrentSession() from as many server
 * components as convenient in one render without it actually
 * re-running more than once.
 *
 * Session strategy is JWT (see auth.ts), so this was never hitting
 * the database — the saving is the JWT decode/verify work itself,
 * smaller than a DB round trip but non-zero, and free to eliminate.
 */
export const getCurrentSession = cache(async () => {
  return getServerSession(authOptions);
});