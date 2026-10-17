import pg from "pg";

/**
 * Prisma creates `DateTime` columns as TIMESTAMP(3) *without* time zone and
 * stores/reads them as UTC. The `pg` driver's defaults disagree: it reads
 * that column type as *local* time and writes JS Dates as *local* time. On a
 * machine whose timezone isn't UTC, a value written by the database's own
 * `now()` (e.g. leetcode_profiles.lastSyncedAt) then reads back hours off —
 * the dashboard would say "Synced 5 hours ago" right after a sync in India.
 * These two lines make both directions UTC, matching Prisma's convention.
 * (Harmless for TIMESTAMPTZ columns, which are unaffected by the parser.)
 */
pg.types.setTypeParser(1114, (value: string) => new Date(`${value.replace(" ", "T")}Z`));
pg.defaults.parseInputDatesAsUTC = true;

const { Pool } = pg;
type Pool = InstanceType<typeof pg.Pool>;

/**
 * Temporary Phase 1 data-access layer.
 *
 * The finalized architecture (PROJECT_STATUS.md) uses Prisma as the ORM.
 * This raw `pg` Pool exists only because the current build environment
 * cannot reach Prisma's engine-binary CDN to run `prisma generate` /
 * `prisma migrate dev`. `prisma/schema.prisma` is still the source of
 * truth for the data model — this file and `src/repositories/*` are a
 * drop-in stand-in with matching table/column names, meant to be
 * replaced by a generated `@prisma/client` the moment normal internet
 * access is available (see PROJECT_STATUS.md → Known Issues).
 *
 * Cached on `globalThis` so Next.js dev-mode hot reloads don't open a
 * fresh connection pool on every file change.
 */
declare global {
  var __dsaIntelligencePool: Pool | undefined;
}

export const pool =
  global.__dsaIntelligencePool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });

if (process.env.NODE_ENV !== "production") {
  global.__dsaIntelligencePool = pool;
}