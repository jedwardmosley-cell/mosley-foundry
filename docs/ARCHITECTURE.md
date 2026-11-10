# Both Hands on the Wheel: Architecture, Data Model and Build Plan

Created by Jason Mosley, Mosley Foundry. Lead yourself. Develop others. Build a life by design.

## 1. Architecture

| Layer | Choice | Why |
|---|---|---|
| App | Next.js 15 (App Router, React Server Components, Server Actions), TypeScript | One deployable unit. Pages render on the server, so private data is never shipped to the browser unless a page renders it. Forms work without JavaScript. |
| Data | Prisma ORM on PostgreSQL (Neon in production) | Relational, typed queries. |
| Auth | Email and password. scrypt hashes with per-user salt. Random 256-bit session tokens in httpOnly, SameSite=Lax cookies; only a SHA-256 of the token is stored | No third-party identity dependency for the MVP. SSO (Google, Microsoft) can be added for organizations later. |
| Authorization | `src/lib/access.ts`, enforced in every page and server action | See section 4. |
| AI | Anthropic Claude (`claude-opus-5-5`, adaptive thinking, server-side refusal fallback) via `@anthropic-ai/sdk`, called only from the server | API key stays on the server. Retrieval over approved content only. |
| Styling | Tailwind CSS, system serif and sans stacks, no external fonts or images | Warm paper background, navy ink, brass accent. Mobile-first with a bottom tab bar; sidebar on desktop. |

```
Browser ──> Next.js server ──> access.ts (who may see what) ──> Prisma ──> Postgres/SQLite
                 │
                 ├─> content/ (licensed pack: book + workbook, gitignored)
                 └─> lib/ai.ts ──> retrieval over approved content ──> Claude API
```

## 2. Content model

Curriculum is data, not code, and is never invented in the app.

| Source | Location | Status |
|---|---|---|
| Both Hands on the Wheel manuscript (Ch. 1 to 10: Refuel, Reflect, Road Test; Ch. 9 rules; Ch. 10 Design Inventory, Who's Checking, leading others) | `src/content/licensed/pack.json` (gitignored), built by `scripts/build-content-pack.py` | Source |
| Personal Application Workbook v3 (anchors, score interpretation, profiles, Ed's Lessons, Jay's Journey, Action Plan, 30-Day Plan, Name Your People) | same pack | Source |
| FORGE Worksheet for Entrepreneurs + FORGE Ahead session deck | `src/content/licensed/entrepreneur.json` (gitignored) | Source |
| Program structure: pathways, 10 Blueprint areas, six segments, delivery formats, Name It / Interrupt It / Replace It / Sustain It phases | `src/content/program.ts` (committed) | From the build brief |
| Segment practice exercises | `src/content/program.ts` | **Draft, marked in the UI for author review** |
| Public fallback (FORGE names and one-line rules only, draft assessment) | `src/content/public-pack.ts` (committed) | Used only when the licensed pack is absent; labeled Draft everywhere |

The repository is public, so book and workbook text is kept out of git. On a live site the pack is uploaded once at `/setup` (protected by `SETUP_TOKEN`) and stored in the `ContentPack` table. Locally, files in `src/content/licensed/` take precedence. To rebuild the pack, export the manuscript and workbook as text and run:

```
npm run content:build -- <folder-with-manuscript.txt-and-workbook.txt> src/content/licensed/pack.json
```

Typography: em dashes are converted, following the author's own edit notes in the FORGE Ahead facilitator package.

## 3. Database design

`prisma/schema.prisma` is authoritative. Entities:

- **Identity:** `Organization`, `User` (role PARTICIPANT, COACH, ADMIN), `Session`.
- **Personal development:** `Profile` (pathway, destination, why, FORGE Statement, priority pillar, reminder and AI retention preferences), `Assessment` (five scores, revised scores, reflections, one word per pillar, instrument, a `isSecondOpinion` flag reserved for observer ratings), `DevelopmentGoal` (Action Plan rows: where now, where I want to be, one move; optional segment link), `Commitment` (Blueprint items by area and cadence).
- **Accountability network:** `Relationship` (name, role, purpose, cadence, next check-in, optional linked account and invitation token), `RelationshipCheckIn` (happened, lessons, agreed actions).
- **30-day cycles:** `DevelopmentCycle` (template, pillar, focus behavior, week notes and status, final review, Day 30 decision), `DailyCheckIn` (Done, Partial, Not yet; note; reflection; per-entry `shared`), `WeeklyReflection`.
- **Private:** `JournalEntry` (no sharing path exists in code).
- **Sharing and coaching:** `ShareGrant` (participant to coach, per scope), `CoachAssignment`, `CoachingSession` (agenda, coach-private notes, agreed commitments, participant prep), `AssignedExercise` (reference to approved content, response, `responseShared`), `EqiPriority` (participant's words, practice, coach interpretation, participant approval).
- **Programs:** `Cohort` (delivery format, start date, reinforcement days), `CohortMember` (participant or facilitator), `TrainingSession` (segment, date and time, facilitator, location), `Attendance`.
- **AI:** `AiConversation` (mode, expiry), `AiMessage` (citations).
- **Audit:** `AuditEvent` (every coach read of participant data).

## 4. Privacy and access control

1. A participant owns their records; every query and update is filtered by the signed-in user's id inside the query (no fetch-then-check), which also blocks guessed-id access.
2. A coach assignment grants nothing except the participant's name. The participant turns on scopes: goals and statement, FORGE scores, practice completion, reflections, Blueprint, network, approved EQ-i items.
3. Free-text reflections require both the scope and the individual entry marked shared.
4. Journal entries and AI conversations have no sharing path. The AI companion does not read the journal.
5. Admins and sponsors see enrollment, schedules, attendance and aggregate percentages. Percentages are hidden for groups under 5. They cannot open participant development records.
6. EQ-i: manual entry of the participant's own priorities only; a coach interpretation returns to the participant for approval before it is visible again.
7. Coach reads are audited. Accepted invitations link accounts but share nothing.

**Production hardening (next step):** on PostgreSQL, add row-level security policies mirroring `access.ts` (owner-only on development tables; coach read through `share_grant`; no policy at all for `journal_entry` other than owner) and connect with a role that cannot bypass RLS. Add rate limiting on sign-in, email verification, password reset, and CSRF origin checks beyond Next.js defaults.

## 5. Key screens

Participant: Today (where am I going, what am I working on, what must I do today, who is helping me, how am I progressing, plus a two-minute check-in), FORGE Assessment and Score Profile (anchors, revision, total band, lowest-pillar guidance, closest workbook profile, entrepreneur pattern), FORGE Plan, Blueprint, People (relationship map, list, health review, check-in log, invitations), 30-Day Cycle, Weekly Reflection, My Pathway (segments, cohort schedule, EQ-i, entrepreneur building view), Road Library, AI Companion, Coaching, Private Journal, History and Export, Sharing, Settings.

Coach: participant list with concise summaries and attention flags, participant summary (focus, evidence of practice, FORGE reading if shared, upcoming accountability, approved reflections, Blueprint, EQ-i), exercise assignment from approved content, session scheduling with prep, agreed commitments and private notes, cohort view.

Admin: cohorts, six-segment schedule editing (three-day or three-week format), enrollment, facilitator assignment, attendance grid, coach assignment, aggregate reports.

## 6. Build phases

| Phase | Scope | Status in this build |
|---|---|---|
| 1. Core MVP | Auth, dashboard, FORGE assessment, goals, Blueprint, 30-day cycle, daily check-ins, basic coach dashboard, persistence | Done and tested end to end |
| 2. Manager program | Six segments, configurable schedules, EQ-i priority entry, segment goals and commitments, cohorts, coach-assigned exercises | Done. Segment practices are drafts awaiting author review; segment-specific 30-day assignments pending source |
| 3. AI and expanded accountability | Grounded companion (coaching, conversation practice, session prep), invitations, permission-based sharing, aggregate reporting | Done. Companion requires `ANTHROPIC_API_KEY`; retrieval is keyword-based (swap for embeddings later) |
| Later | Reminder delivery (email or push provider), second-opinion feedback flow, secure EQ-i report upload once licensed, PostgreSQL RLS, SSO | Schema hooks in place |

## 7. Missing source materials and open decisions

These were not invented. Each is marked in the product where it applies.

1. **FORGE Application Workbook for entrepreneurs** (five-pillar behaviorally anchored assessment, entrepreneurial patterns beyond High R / Low F and O, second-opinion feedback, and the 30-day Name It, Interrupt It, Replace It, Sustain It daily assignments). Not found in Drive. The app uses the FORGE Worksheet for Entrepreneurs for scoring and the brief's phase descriptions for the cycle, labeled "assignments pending source."
2. **Six-segment manager program curriculum.** Only the segment summaries from the brief were available. Practice exercises are drafts for review. Segment-specific reinforcement assignments are needed.
3. **Assignments for the Leading Others 30-day cycle** (the brief asks for separately reviewed assignments).
4. **Licensing: EQ-i 2.0** (MHS). Report upload, storage, content reproduction and AI interpretation are intentionally not built until licensing and safeguards are confirmed.
5. **Licensing: book and workbook content in a public repository.** Kept out of git. Decide whether the repo should be private, and how the content pack is deployed (secret storage or private package).
6. **AI data handling.** Default retention is 90 days, participant-adjustable. Confirm the retention policy, the Anthropic data-use terms that apply to the account, and whether employer-sponsored cohorts may use the companion.
7. **Validation language.** FORGE is presented as a self-rated development tool, not a validated psychometric instrument. Confirm wording.
