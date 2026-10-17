# PROJECT_STATUS.md — DSA Intelligence

## Current Phase
Phase 9 — AI DSA Mentor complete. A real, working `/mentor` chat,
backed by the actual Anthropic API, grounded in a structured summary
of the student's own data (never raw DB access for the model), with
a genuinely enforced 6-level progressive hint ladder and a
tool-based real-problem lookup (no hallucinated problems).

## Completed
- **`src/lib/mentor/context-builder.ts`** (pure): assembles
  `MentorContext` — readiness, strong/weak/fundamental-gap/
  revision-needed topics, recent activity (Phase 5's progress
  trend), revision due (Phase 7), recommended problems (Phase 6),
  roadmap (Phase 8), and "relevant history" (the student's most
  recent solved problems, interpreted as distinct from "recent
  activity" — see below). Every field is a re-shaping of something
  an earlier phase's engine already computed; this file never scores
  or classifies anything itself, preserving the Phase 0 boundary
  ("AI is reserved for explanations/chat, never deterministic
  scoring") this project has held since the very first architecture
  doc
- **`hasProfile: false` is its own real case**, not just empty
  lists — a student with nothing connected yet still gets a mentor
  (it can explain/hint/quiz a *named* problem via the catalog
  search tool), just without personalized diagnosis
- **`src/lib/mentor/system-prompt.ts`** (pure): persona + rules +
  the structured context, serialized as readable text sections with
  honest empty-state fallbacks (same "never hide, say so plainly"
  discipline as every prior phase). Includes the full 6-level hint
  ladder (`HINT_LEVELS` in config.ts) and a "Hint progress" fact
  table computed from the student's own history, so the model is
  told exactly which level comes next rather than trusted to count
  correctly from raw conversation text
- **Progressive hints are enforced two ways**: (1) a deterministic
  fact table in the system prompt states the next allowed level per
  problem; (2) the model reports back what it actually did via a
  `[[MENTOR_META hintLevel=N problem=slug]]` line at the start of a
  problem-specific reply (`reply-parser.ts` strips and decodes it;
  `hint-tracking.ts`'s `clampHintLevel` defends against a malformed
  or out-of-range value). Hint progress is computed from *every*
  message the student has ever gotten a hint on
  (`getHintSignalsForUser`, unbounded), not just the capped
  conversational context window — otherwise a long chat would
  silently forget earlier progress and let the ladder restart
- **"Give me a Binary Search problem" is a real tool call**
  (`search_problem_catalog`), not the model inventing a problem: the
  real curated catalog (Phase 6) is searched by topic/difficulty,
  already-solved problems excluded server-side. `claude-mentor-provider.ts`
  runs the whole tool-use loop (capped at `maxToolIterations`) so the
  service layer only ever sees the final reply
- **Provider abstraction** (`MentorProvider`, mirrors
  `LeetCodeProvider`'s pattern exactly): `ClaudeMentorProvider` is
  the real Anthropic-backed implementation (`fetch` to
  `api.anthropic.com/v1/messages`, no SDK dependency added);
  `FakeMentorProvider` is a deterministic test double whose
  `hint-ladder` scenario reads the *real* hint-progress table out of
  the real system prompt to decide what to report — so a multi-turn
  integration test genuinely exercises hint progression end to end;
  only the model's own reasoning is faked
- **API key stays server-side**: read once, inside
  `claude-mentor-provider.ts`, from `process.env.ANTHROPIC_API_KEY`.
  Nothing in `src/components` or `src/app` ever touches it; the only
  client-reachable entry point is `sendMentorMessageAction`
  (`src/actions/mentor.ts`), a Server Action, same architecture as
  every other mutation in this app — no new API route was added
- **Error handling for AI failures**, all returning a Result
  (`{ok:false, error, retryable}`), never throwing into the UI:
  missing/blank API key (no network call made), request timeout
  (`AbortController`, 30s), network failure, malformed JSON, empty
  or malformed tool-use response, too many tool iterations, and
  HTTP-status-specific messages (401/403 auth, 429 rate-limited,
  5xx/529 overloaded) — verified against the *real* Anthropic API
  with an intentionally invalid key (see Known Issues: no valid key
  is available in this sandbox, but the 401 path was confirmed real,
  not simulated)
- **One continuous mentor thread per user**, not a list of named
  conversations — `mentor_messages` (new table, see below), read
  oldest-first. The student's own message is always persisted
  *before* the AI call runs, so a failed or slow AI turn never loses
  what they actually typed (verified in the integration test)
- **UI**: `/mentor` (nav item flipped to enabled) — message list
  with a hint-level badge on hint replies, suggested-question chips
  on an empty conversation, optimistic send (the student's bubble
  appears immediately; it's genuinely already saved), inline error
  display that never wipes what was already sent. Plain text
  rendering (`whitespace-pre-wrap`), no new markdown-rendering
  dependency added — a deliberate, documented scope decision, not an
  oversight
- **Schema**: one new table, `mentor_messages` (migration
  `006_sandbox_mentor`, same raw-SQL stopgap as every migration
  since 000 — see Known Issues for this phase's fresh Prisma
  re-check). `problemSlug` is a plain string, not a foreign key —
  the mentor can discuss a problem before it's necessarily a
  `Problem` row the student has synced evidence against
- **Interpretive choice, documented per this project's own habit**:
  the brief listed "recent activity" and "relevant history" as
  separate context items without defining either. Interpreted as:
  recent activity = Phase 5's aggregate progress trend
  (improving/declining, why); relevant history = a short list of
  concrete recently-solved problems by name. Distinct and
  non-redundant, both genuinely useful for different questions
  ("why did my score decrease" vs. "what have I been doing lately")
- **Tested**: 53 new unit tests across 6 pure modules (context
  builder, system prompt, hint tracking, reply parser, problem
  search) — 163 total now, all pure/no-DB. New `npm run test:mentor`
  integration script (20 checks against real Postgres, via
  `FakeMentorProvider`): no-profile path, input validation, provider
  failure preserving the student's own message, a full 3-turn hint
  ladder climbing 1→2→3 without skipping, hint progress surviving
  the message it's tagged on, catalog search excluding an
  already-solved problem, and conversation isolation between users.
  **A real bug was caught by this integration test, not assumed
  away**: `buildMentorSystemPrompt`'s no-profile branch originally
  returned early and dropped the hint-progress table entirely, so a
  hint ladder silently reset to level 1 forever for any student
  without a connected profile — fixed, and a dedicated unit test
  added alongside the integration coverage that caught it. All 8
  integration suites and all unit tests re-verified together,
  `tsc`/`eslint`/`next build` all clean. Spot-checked via a real HTTP
  login session as the seeded "Alex" profile — `/mentor` returns 200
  with the real chat UI, not a stub

## Pending (Phase 10+)
- Weekly/monthly reports, mock interview, profile/settings page
- Finer-grained problem tagging for curated skill-graph nodes
- The Prisma swap-back (still outstanding — see Known Issues)
- A conversation-length cap/summarization strategy for the mentor
  chat isn't built yet — `historyMessageLimit` (30 messages) bounds
  what goes into each API call, but nothing yet trims or archives
  `mentor_messages` itself, so a very long-running chat grows the
  table indefinitely (same *category* of gap Phase 7's revision caps
  fixed, not yet applied here — flagged honestly rather than fixed
  speculatively, since "how long before this matters" isn't known
  yet)

## Important Architectural Decisions
- **The mentor never queries the database directly, and never will
  by design.** `context-builder.ts` is the only bridge, and it's
  pure — the model only ever sees the structured summary, exactly as
  the brief specified. Extending what the mentor knows means adding
  a field to `MentorContext`, not loosening this boundary
- **Hint-level enforcement is belt-and-suspenders, not purely
  trust-the-model.** The system prompt's fact table is the primary
  steering mechanism; `clampHintLevel`'s 1-6 range clamp is a cheap,
  deterministic data-integrity backstop against a malformed value —
  it does not attempt to detect "did the model skip a level," since
  that would require re-litigating the same natural-language
  judgment (did the student explicitly ask for the solution?) that's
  correctly left to the model in the first place
- **No second forced tool call for structured hint metadata.** A
  `[[MENTOR_META ...]]` text-line convention was used instead of a
  second tool (alongside `search_problem_catalog`) — mixing an
  `auto`-choice tool for catalog lookups with a `forced`-choice tool
  for the final structured reply would have meant switching
  `tool_choice` mid-loop, more moving parts for the same result. The
  parser degrades gracefully (a missing/malformed line just means
  `hintLevel`/`problemSlug` come back null, never a failed turn)
- **One thread per user, no conversation list.** The brief describes
  a mentor that answers questions and gives hints, not a
  multi-conversation inbox — building conversation-switching UI
  would be scope the brief never asked for. Easy to revisit if a
  real need shows up
- **Schema grows to 11 tables.** One new migration
  (`006_sandbox_mentor`) — same raw-SQL mirror as every prior one,
  see Known Issues for why

## Known Issues
- Everything from Phases 2-8's Known Issues still applies except
  what's been fixed along the way (see prior phases' Completed
  sections): no live `leetcode.com` call tested from this sandbox;
  accepted-only submission data; unofficial API can change; curated
  skill-graph nodes rarely get direct evidence yet; curated problem
  catalog is small relative to the real LeetCode catalog.
- **The real Claude Mentor Provider has never been tested against a
  real, successful API call** — this sandbox has no valid
  `ANTHROPIC_API_KEY` (`.env`'s is blank, matching `.env.example`).
  What *was* verified for real: `api.anthropic.com` is reachable
  from this sandbox (unlike `binaries.prisma.sh`), and an
  intentionally invalid key produces a genuine 401 that the code
  correctly turns into a friendly, non-retryable error — so the
  request/response wiring and the error-handling path are confirmed
  against real infrastructure, not simulated. What's unverified is
  actual model behavior (does it really follow the hint-ladder
  instruction, does it really avoid revealing solutions early) —
  that needs a real key, on a real deployment, to confirm.
- **Prisma swap-back: re-checked this phase too, still blocked, same
  reason as Phase 8's finding** — `npx prisma generate` still 403s
  fetching from `binaries.prisma.sh`. Schema now has an 11th table,
  which only makes the eventual swap slightly bigger, not any
  different in kind.
- `prisma` CLI's bundled `mysql2`/`deepmerge-ts` vulnerability
  remains (inert — no MySQL in this app).
- This sandbox's local Postgres process still isn't fully stable
  across tool calls (a `service postgresql start` was needed a
  couple of times again this phase) — confirmed, again, that this
  never affects correctness: every integration suite, `test:mentor`
  included, passes cleanly on a fresh DB run start-to-finish.
  Sandbox-only, not present in normal deployment.

## Next Recommended Step
The conversation-length cap for `mentor_messages` (see Pending) is
the most natural immediate follow-up to this phase specifically —
small, self-contained, same shape as Phase 7's revision-cap fix.
Beyond that, Phase 10 is most likely weekly/monthly reports, which
can now draw on mastery history, revision history, the roadmap, and
the mentor's own conversation history all at once. The Prisma
swap-back stays parked until this project is on a machine that can
reach `binaries.prisma.sh`.
