# DSA Intelligence

A personalized LeetCode analytics and DSA coaching platform. See
`PROJECT_STATUS.md` for the current phase, finalized architecture, and
known issues.

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and NEXTAUTH_SECRET
```

Generate a secret: `openssl rand -base64 32`

`ANTHROPIC_API_KEY` is optional — set it to enable the AI Mentor (`/mentor`); everything else works without it.

### Database

This project's data layer is Prisma (`prisma/schema.prisma` is the
source of truth). Set up your database with:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

**Currently, `src/lib/db.ts` and `src/repositories/*` use raw `pg`
queries instead of the generated Prisma Client.** This is a Phase 1
stopgap only — it was written because the sandbox this phase was
built in couldn't reach Prisma's engine-binary CDN to run the two
commands above. It has nothing to do with your machine or your
deployment target; run the commands above locally or in CI and they
will work normally.

To switch back to real Prisma once you've run `prisma generate`:
1. Replace the contents of `src/lib/db.ts` with a standard
   `PrismaClient` singleton.
2. Rewrite `src/repositories/user-repository.ts`,
   `src/repositories/leetcode-repository.ts`,
   `src/repositories/analytics-repository.ts`,
   `src/repositories/skill-graph-repository.ts`,
   `src/repositories/problem-catalog-repository.ts`, and
   `src/repositories/revision-repository.ts` to call Prisma Client
   methods instead of raw SQL. Nothing outside `src/repositories/`
   needs to change — services and Server Actions only call
   repository functions, never SQL directly. Genuinely overdue now
   (see PROJECT_STATUS.md) — the schema is at 10 tables.
3. Delete the `prisma/migrations/00*_sandbox_*` folders and run
   `npx prisma migrate dev --name init` for real, Prisma-tracked
   migration history.

### LeetCode sync

No API key needed — it calls LeetCode's public GraphQL endpoint
directly. **This has not been tested against the real
`leetcode.com`** (see PROJECT_STATUS.md → Known Issues, same
network-sandbox reason as above); the first real sync you run is
this feature's true first test. If LeetCode has changed their schema
since, `src/lib/leetcode/leetcode-client.ts` is the only file that
should need updating.

### Run

```bash
npm run dev
```

### Verify

```bash
npm run lint
npm run build
npm test                  # unit tests for the analytics engine (no DB needed)
npm run test:foundation   # signup/login against your DB
npm run test:leetcode     # ingestion pipeline against your DB, via a fake LeetCode provider
npm run test:analytics    # ingestion -> analytics -> persisted snapshots, end to end
npm run test:skill-graph  # skill graph seeding + gap detection, end to end
npm run test:recommendations  # problem catalog + recommendation engine, end to end
npm run test:revision     # revision scheduling + Revision Center, end to end
npm run test:roadmap      # personalized roadmap, incl. that it updates when analytics change
npm run test:mentor       # AI mentor pipeline end to end, via a fake provider (no API key needed)
```

### Try the dashboard with realistic data

```bash
npm run seed:demo-profiles
```

Seeds four distinct hypothetical students (an active improver, a
brand-new account, a fundamental-gap case, and a stale-but-solid
case) and prints their login emails — password for all of them is
`correct-horse-battery-staple`. Useful for actually looking at the
dashboard without needing a real LeetCode history.
