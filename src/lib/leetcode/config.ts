/**
 * How old lastSyncedAt has to be before the dashboard auto-triggers a
 * refresh on entry, rather than syncing on every single page view.
 * 60 minutes: frequent enough that data doesn't feel stale during an
 * active study session, infrequent enough that bouncing between
 * Dashboard/Reports/Revision/Dashboard within that window never
 * re-triggers a sync — only genuinely returning after a while does.
 */
export const SYNC_STALENESS_MINUTES = 60;

export function isSyncStale(lastSyncedAt: Date | null, now: Date = new Date()): boolean {
  if (!lastSyncedAt) return false; // never-synced isn't "stale" — that's the connect-profile empty state, not an auto-refresh case
  const ageMinutes = (now.getTime() - new Date(lastSyncedAt).getTime()) / 60_000;
  return ageMinutes >= SYNC_STALENESS_MINUTES;
}