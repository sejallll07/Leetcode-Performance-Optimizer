import { ensureSkillGraphSeeded } from "@/repositories/skill-graph-repository";
import { ensureProblemCatalogSeeded } from "@/repositories/problem-catalog-repository";

/**
 * ensureSkillGraphSeeded/ensureProblemCatalogSeeded are idempotent
 * upserts against curated data that's effectively static — it never
 * changes outside a deliberate code change to the seed data itself.
 * Before this, getDashboardData/getRoadmapData/getMentorAnalyticsBundle/
 * reports-service/interview-service each called both on literally
 * every page view (5 of the app's 7 routes), which meant real
 * Postgres round trips re-verifying data that was seeded once and
 * never changes, on nearly every navigation.
 *
 * A module-level singleton promise is the right tool here, not
 * React's cache() (which only dedupes within one request) and not a
 * time-based TTL cache (this data doesn't go stale on any schedule —
 * it only changes on a deploy). First call does the real check and
 * every call afterward — same request or any later one, for the
 * life of this server process — gets the already-resolved promise
 * instantly. If the process restarts (a deploy), the first request
 * after that pays the cost once more, which is correct: a fresh
 * process genuinely hasn't verified the seed yet.
 */
let seededPromise: Promise<void> | null = null;

export function ensureReferenceDataSeededOnce(): Promise<void> {
  if (!seededPromise) {
    seededPromise = Promise.all([ensureSkillGraphSeeded(), ensureProblemCatalogSeeded()])
      .then(() => undefined)
      .catch((err) => {
        // Don't poison the cache with a failed attempt — the next
        // call should retry rather than carry a rejected promise
        // forward forever.
        seededPromise = null;
        throw err;
      });
  }
  return seededPromise;
}