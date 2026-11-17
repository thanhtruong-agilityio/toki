# Bootstrap endpoint design

Date: 2026-11-17 · Status: draft for review
Intent: docs/intents/bootstrap-endpoint.md (Thanh Truong)
Ticket: TOKI-031

## Goal
The app needs everything that draws its first screen in one answer: who the signed-in person is, the workspace name, the people, the person's own conversations with their star, mute and level, and the point in the event stream that this answer corresponds to. This work adds that request, `GET /api/v1/bootstrap`, reads all of it from one consistent view of the database, and leaves out whatever the person may not see. The client-core API client (TOKI-032) and the conversation list (TOKI-033) are built on its shape.

## Scope
- In:
  - The route `GET /api/v1/bootstrap` and the code that gathers its answer from the `workspace`, `members` and `conversations` modules (Design, "Where the code lives").
  - The response schemas in `packages/shared` (R2, R17).
  - One read added to `modules/members` and one to `modules/conversations` (R15).
  - The rule for which conversations and people come (R5, R6) and what each entry holds (R7, R8).
  - The event number field and the place where it is read (R11).
  - Server integration tests, including the size and the number of statements (R14, R20).
- Out (not now):
  - Unread counts, the "mention" dot and the New divider: the read pointer, TOKI-053, adds them to the conversation entries; the table has nothing to count from before messages exist (TOKI-028 Scope). The plan line of this ticket names "unread counts"; this spec moves them to TOKI-053 (Design, "Plan changes").
  - The latest message of a conversation, the order of direct messages by it (F09) and hiding a DM from the other person until its first message (F25): they need `messages` (TOKI-036). Which ticket builds them is open (concern 1).
  - The numbered event log and its number: TOKI-036 builds the log; this ticket returns the number through one function that returns 0 until then (R11).
  - Messages, threads, files, drafts, reactions, pins, Activity, Later, presence, job title, time zone, status text and the person's preferences: each belongs to its own ticket, which adds its field to this response when its data exists (R12).
  - The description of a conversation, its creator and creation date, the members of a channel and the list of channels to browse: TOKI-029 (the Details panel and Browse read them by their own requests; concern 2).
  - Saving a person's notification level, mute and star: not owned by any ticket in the plan (TOKI-028 concern 2). This ticket only returns them.
  - The WebSocket, the reconnect and the sync engine that use the event number: TOKI-038, TOKI-039, TOKI-040.
  - Screens and texts: none. The response holds names and values, no display text, so nothing goes through i18n.

## Requirements
- R1. `GET /api/v1/bootstrap` exists, takes no body and no query, and needs a valid session of any role (TOKI-022 R24): a Member and an Admin get the same shape. Without a session it answers 401 `unauthenticated`, with an ended session 401 `session_ended`, with a deactivated account 401 `account_deactivated`, as TOKI-022 R27 and R44 say, and the body holds no workspace data. A query string is ignored. Check: with a session of each role, status 200; with no cookie, an ended session and a deactivated account, the three 401 codes and a body that passes the error schema of TOKI-004 and contains neither the workspace name nor any display name.
- R2. A 200 answer is a JSON object with exactly these five keys: `user`, `workspace`, `members`, `conversations`, `eventNumber`. It passes the schema `BootstrapResponse` of R17, which rejects unknown keys at every level. Check: a test parses the body of a rich fixture with `BootstrapResponse` (strict) and it passes; the same body with one added key at the top level, in `workspace`, in a member and in a conversation entry fails to parse, for each.
- R3. `user` is the signed-in account in the `User` shape of TOKI-022 R32 (`id`, `email`, `displayName`, `role`, `language`) and is equal to the `user` of `GET /api/v1/auth/session` for the same session. It is the only place where an email address is returned. Check: both routes with one session give equal `user` objects; the body holds no other value of the form `x@y`.
- R4. `workspace` is `{ "id", "name" }` of the workspace of the signed-in account, read through the `workspace` module read that TOKI-022 uses for the sign-in card (Module boundaries of that spec). Check: after `createWorkspace` with the name `Test Workspace`, the answer holds that name and the id of the row.
- R5. `members` holds every account of the workspace, active and deactivated, the signed-in person included, as `{ "id", "displayName", "role", "status" }` and nothing else: `role` is `member` or `admin`, `status` is `active` or `deactivated` (TOKI-019 R9, R10). It holds no email address, no sign-in or session data. It is ordered as TOKI-024 R23 orders the list: by `lower(displayName)` compared with the collation `"C"`, then by id. Check: a fixture of five accounts (one deactivated, two Admins, names in upper and lower case) is returned complete, in that order, with exactly those four keys each; a search of the body for the five email addresses finds only the one of `user`; an account of a second workspace, inserted by SQL, is not returned.
- R6. `conversations` holds a conversation when, and only when, the signed-in person has a member row in it and it is not archived (`archived_at` is null). So it holds: every channel the person has joined (public or private), #general, every DM and every group the person is in, also with a deactivated person. It holds no public channel the person has not joined (D-116), no private channel, DM or group the person is not in, no archived conversation (F26), and nothing of another workspace. Check: a fixture with a joined public channel, a joined private channel, #general, a DM, a group, a DM with a deactivated person, an unjoined public channel, a private channel without the person, a DM of two other people, a joined channel that is archived and a conversation of a second workspace returns exactly the first six ids; after the person leaves one joined channel (its member row deleted) and after another is archived, a second call omits both.
- R7. Each entry of `conversations` is exactly `{ "id", "kind", "name", "topic", "isPrivate", "isGeneral", "notificationLevel", "isMuted", "isStarred", "memberIds" }`. `kind` is `channel`, `dm` or `group_dm`. `name` is the channel name, and null for `dm` and `group_dm`. `topic` is the topic or null (always null for `dm` and `group_dm`). `isPrivate` and `isGeneral` are the two flags of TOKI-028. `memberIds` is the list of user ids of the people in the conversation, the signed-in person included, ordered by id, for `dm` and `group_dm` (the client names a DM by the other person and a group by its people, F09, and the key never changes, TOKI-028 R21); it is null for a `channel`. The entries are ordered by `id`. The description, `createdBy`, `createdAt`, `archivedAt` and the key `dm_key` are not returned. Check: for each kind the entry has exactly these keys with these values, `memberIds` of a group of 8 holds 8 ids and equals the ids of its key, and a channel has `memberIds` null; the list of ids is in ascending order.
- R8. `notificationLevel` is the level that applies to the signed-in person, one of `all`, `mentions`, `none`: the stored value of the member row, or, when it is null, the default of the kind, which is the result of `effectiveNotificationLevel(kind, level)` of TOKI-028 R15 (`mentions` for a channel, `all` for a DM or group, D-046). `isMuted` and `isStarred` are the person's own booleans of the member row (D-103, D-143). Another member's values never appear. Check: two people in one channel, the first with `none`, muted and starred, the second with nothing set: each call returns its own values (`none`/true/true for the first, `mentions`/false/false for the second); a DM with a null level returns `all`; a stored `mentions` on a DM returns `mentions`; the body of the first call holds no value of the second person's row beyond what the second's own call returns.
- R9. There is no limit: every conversation that R6 selects comes in the one answer, in phase 1 (D-117). There is no pagination, no cursor and no `limit` query. Check: a fixture of 500 conversations (300 channels, 150 DMs, 50 groups) of one person returns all 500 and no `nextCursor` or similar key; the schema of R17 has no such key.
- R10. The five parts of the answer come from one consistent view. The handler reads `workspace`, `members`, `conversations`, the member lists of DMs and groups, and the event number inside one read-only transaction at isolation level `REPEATABLE READ`, so a change committed by another request while the handler runs shows in none of them. The account of `user` is the one the session check put on the request (TOKI-022 Design, step 6). Check: the builder has a test-only seam, an optional function called once after the members are read; a test passes one that, through a second connection, commits a new account, a new channel with the person as a member and a new member row, and the answer holds none of the three; a second call holds all three. A test reads `pg_stat_activity` or the statement log and finds that the statements of the handler run inside one transaction that was started `READ ONLY` at `REPEATABLE READ`.
- R11. `eventNumber` is a non-negative integer: the number of the last event of the log at the moment of the view of R10. It is read by the function `readEventNumber(tx)` of `apps/server/src/bootstrap/event-number.ts`, which takes the transaction of R10. Until TOKI-036 builds the log, the function returns `0`, meaning "no event yet", and reads nothing. TOKI-036 replaces the body so that it reads the last event number with the transaction it is given; it owns the numbering (the first event is numbered 1 or higher, so `0` stays "none") and the test of it against a concurrent writer. The client keeps this number and asks for the events after it (TOKI-039). Check: the answer holds `"eventNumber": 0` today; a test replaces `readEventNumber` by a fake that records its argument and returns 41, and the answer holds 41 and the recorded argument is the transaction object that the other reads used.
- R12. The answer holds no message, no unread count, no draft, no presence, no job title, time zone or status text, no preferences and no description of a conversation. A ticket that adds a field for a person or a conversation adds it to the schemas of R17, to the entry of R5 or R7, and to the tests of this ticket in its own change; the schema stays strict, so a field that is not in the schema is not returned. Check: the strict parse of R2 fails on every such key; a search of the body of the rich fixture finds none of the seeded description texts and none of the seeded display texts other than names.
- R13. The answer is sent with `Cache-Control: no-store` and `Content-Type: application/json`. The request changes nothing: after it, no row of any table has changed except `sessions.last_used_at` of the caller's session, which the session check sets (TOKI-022 R25), and the route is a `GET` that creates or ends no session (TOKI-022 R36). Check: the header values on a 200; a row count and a checksum of the rows of every table except `sessions` before and after a call are equal; the route-list test of TOKI-022 R36 passes with the route listed.
- R14. The number of SQL statements the handler sends does not grow with the size of the answer: at most 8, counting `BEGIN` and `COMMIT`, for a workspace of 3 conversations and for one of 500 conversations and 200 people. Check: the test wraps the database client so that every statement is counted, calls the route on both fixtures, and compares the counts: both are 8 or fewer and they are equal.
- R15. Two reads are added to the modules, each taking the open transaction as its first argument and returning plain values. `modules/members/index.ts` exports `listPeople(tx, workspaceId)`, which returns the rows of R5 in the order of R5. `modules/conversations/index.ts` exports `listConversationSummaries(tx, workspaceId, userId)`, which returns the rows of R6 and R7 and R8 (the stored level, not the one that applies, which the handler computes with the shared function), and in one further statement the member ids of the DMs and groups among them. The table definitions are not exported and no other module reads these tables. The test of the exact export list of `conversations` (TOKI-028 R18) is edited by this ticket to add `listConversationSummaries`; `listConversationIdsOfUser` stays exported for its other callers and this ticket does not use it (it returns archived conversations too and has no flags). Check: `pnpm lint` exits 0 with the boundary rules of TOKI-002; the export-list test lists the new name; database tests of each function on the fixtures of R5, R6 and R7, including a person with no conversation (an empty list) and a conversation whose member row was deleted.
- R16. The code that gathers the answer is in `apps/server/src/bootstrap/`, outside `modules/`, and imports only the `index.ts` files of `workspace`, `members` and `conversations` (TOKI-002 R17). The route is registered by `api/index.ts` under `/api/v1` (TOKI-004 R10). No module imports `bootstrap`. Check: `pnpm lint` exits 0; the route-list test of TOKI-004 R10 finds `GET /api/v1/bootstrap` and no path outside `/api/v1`; a search finds no import of `src/bootstrap` inside `modules/`.
- R17. `packages/shared/src/bootstrap/schemas.ts`, exported from the package index, exports the strict schemas `BootstrapPerson`, `BootstrapConversation` and `BootstrapResponse` (the shapes of R2, R5, R7, R8) and the inferred types, written with the schema library TOKI-022 R38 uses. The `User` schema is the one of TOKI-022, not a copy. The server builds its answer as a value of these types and the client of TOKI-032 parses with the same schema. Check: type check: the builder returns `BootstrapResponse`; unit tests parse a valid body, and reject a missing key, a wrong `kind`, a `notificationLevel` of `loud`, a `memberIds` holding a string that is not a UUID, a null `memberIds` for a `dm`, a non-null `memberIds` for a `channel`, a `name` that is not null for a `dm`, and an `eventNumber` of -1 or 1.5.
- R18. The signed-in person sees everything they must and nothing else: the answer of one person never contains the id, name or topic of a conversation that R6 leaves out, and never contains a member id of a private conversation the person is not in. Check: a fixture where a private channel named `secret-plan` with topic `hidden topic`, a DM of two other people and an unjoined public channel `open-room` exist; the full text of the body of the person who is in none of them contains none of the three names, the topic or the ids; the body of a member of the private channel contains the channel.
- R19. A deactivated person appears in `members` with status `deactivated`, and the entries of the DMs and groups that include them stay in `conversations` with their `memberIds`, so the client can show the old DM with the person's name and the "deactivated" state (F25, F41, D-094); nothing is hidden by the server. Whether People, pickers and mentions leave them out is a client rule (TOKI-032, TOKI-033). Check: with a deactivated account in a DM with the caller, the DM is in `conversations`, its `memberIds` holds the account, and `members` holds the account with `deactivated`; after the account is reactivated the status is `active`.
- R20. With 200 people and 500 conversations (R9, R14), the JSON body is smaller than 250 KB before compression. The bound is a regression guard chosen in this spec, not a product number (concern 6). Check: the fixture of R9 with 200 accounts; the test reads the byte length of the body and it is under 250,000.

## Design
### API
| Method | Path | Session | Purpose |
|---|---|---|---|
| GET | `/api/v1/bootstrap` | required, any role | The first load: the signed-in person, the workspace, the people, the person's conversations, the event number |

Shape (JSON). The example values are made up.
```
{
  "user": { "id", "email", "displayName", "role", "language" },
  "workspace": { "id", "name" },
  "members": [ { "id", "displayName", "role": "member" | "admin", "status": "active" | "deactivated" } ],
  "conversations": [ {
    "id", "kind": "channel" | "dm" | "group_dm",
    "name": string | null, "topic": string | null,
    "isPrivate": boolean, "isGeneral": boolean,
    "notificationLevel": "all" | "mentions" | "none",
    "isMuted": boolean, "isStarred": boolean,
    "memberIds": string[] | null
  } ],
  "eventNumber": 0
}
```
Decided in this spec: the key is `members` (the plan's word), the ids are strings, times are not returned (nothing in the first screen needs one), and the entry of a conversation has the same keys for every kind so the client reads one type.

### Where the code lives
`apps/server/src/bootstrap/` is a folder outside `modules/`, like `first-admin.ts` of TOKI-020. Reason: the answer needs `workspace`, `members` and `conversations`, and `members` already imports `workspace`; a module that called all three could make an import cycle, which fails at start-up when an export is used while a module loads. A file outside `modules/` may import each module's `index.ts` only (TOKI-002 R17), so no module reaches into another and nothing imports `bootstrap`. Decided in this spec.

### How an answer is built
1. The session check has already run and put the account on the request. The handler opens one transaction, `READ ONLY` at `REPEATABLE READ` (R10).
2. It reads the workspace (R4), then `listPeople` (R5), then `listConversationSummaries` (R6 to R8), then `readEventNumber` (R11), all with that transaction.
3. It computes `notificationLevel` for each conversation with `effectiveNotificationLevel` of `packages/shared` (R8) and builds the value of `BootstrapResponse` (R17). The schema is a strict type, not a runtime filter: the test parses the real body (R2).
4. It commits and sends the answer with the headers of R13.

Statements: `BEGIN`, the workspace, the people, the conversations of the person, the member ids of the DMs and groups (one statement for all of them, `where conversation_id in (…)`), the event number (none while it returns 0), `COMMIT`: 6 today, 7 once the log is read (R14 allows 8).

Why `REPEATABLE READ` and not separate reads: the client applies the events after `eventNumber` to the lists it got. If a channel were created between the read of conversations and the read of the number, the client would hold a number that already includes an event for a channel it never received. One snapshot makes the answer and the number agree. Decided in this spec.

Why every person and every conversation come at once: D-117 for conversations (revisit past 500); for people, the app needs a name for every author, DM partner and mention, NFR-04 caps the first version at about 200 people, and a body of about 30 KB for them is cheaper than a request per name. Decided in this spec.

### What each part returns, and why
- Others' email addresses are not returned: the prototype's People card and profile panel show name, title, presence, local time and time zone and no address, and no decision shows an address to other members. The Admin page reads addresses through TOKI-024. Decided in this spec.
- `notificationLevel` is the level that applies, not the stored value (null means the kind's default, TOKI-028 R14): the client needs one meaning, and nothing in phase 1 needs to tell "chose the default" from "never chose". When the request that saves the level is built (TOKI-028 concern 2), it sends one of the three values. Decided in this spec.
- Archived channels are not returned (F26: they leave everyone's list). A member can still read one (F10); how the app opens it is concern 2.
- DMs of a person include every DM and group the person has a member row in, from the moment it is opened (TOKI-028 concern 6). Hiding one from the other person until its first message is concern 1.

### Errors
- No session, an ended session, a deactivated account: 401 with the codes of TOKI-022 (R1).
- A failure of the database: the 500 `internal_error` of TOKI-004; the transaction is rolled back; the body holds no partial answer.
- There is no 403 and no 404: every signed-in person is allowed, and the route has no id.

### Layout
```
apps/server/src/
├─ api/index.ts                  registers the bootstrap route
├─ bootstrap/
│  ├─ index.ts                   registerBootstrapRoutes
│  ├─ routes.ts                  the GET route and its headers
│  ├─ build.ts                   buildBootstrap(db, account, { afterMembers? }): the steps above
│  ├─ event-number.ts            readEventNumber(tx): returns 0 until TOKI-036
│  └─ bootstrap.db.test.ts       R1 to R14, R18 to R20 on the real database
└─ modules/
   ├─ members/       people.ts          listPeople (exported by index.ts)
   └─ conversations/ summaries.ts       listConversationSummaries (exported by index.ts)
packages/shared/src/bootstrap/
├─ schemas.ts                    BootstrapPerson, BootstrapConversation, BootstrapResponse
└─ schemas.test.ts               R17
```

### Plan changes
This ticket edits no other spec; the plan needs these changes.
- The line of TOKI-031 in the plan says it returns "unread counts". Until the read pointer exists nothing can be counted (TOKI-028 Scope). TOKI-053 adds the unread count to the conversation entries of this response, with the tests of R2 and R7 updated in its change. TOKI-053 needs TOKI-031 for that.
- TOKI-036 replaces the body of `readEventNumber` (R11). TOKI-036 needs TOKI-031 for it, or the function is edited by whichever ticket arrives second.
- TOKI-031 needs TOKI-022 (session check, `User`, workspace read), TOKI-024 (the order of R5 and the members module) and TOKI-028 (tables and `effectiveNotificationLevel`) besides TOKI-029 and TOKI-030; through them it needs TOKI-019 and TOKI-027.
- TOKI-032 and TOKI-033 read this response. TOKI-032 builds the grouping into Starred, Channels and Direct messages and the order (channels alphabetical, F09) from these entries.

## Testing
- Written test-first, as server integration tests with Vitest against the real Postgres of TOKI-008 (`.db.test.ts`), the test clock and fake data only. The app is built with `buildApp`; requests go through `app.inject`. Sessions are made with the function `createSession` exported by the `auth` module (TOKI-022 R29), so the session check of R1 runs for real. Rows of `workspaces` and `users` come from `apps/server/src/db/test-rows.ts` (TOKI-019 R26); rows of `conversations` and `conversation_members` are inserted by SQL text with the helper functions of the test file, because a file outside `modules/` imports no table (TOKI-002 R17). Each file starts with empty tables (TOKI-008 R6).
- R1 to R9 and R18 to R19: the fixtures named in each requirement, each asserting the exact set of ids, the exact keys and the order. Every "must not come" row is checked together with the "must come" row next to it that proves the data was valid otherwise (an archived channel next to the same channel before it was archived).
- R10: the seam and the second connection; the statement log shows the transaction mode. R11: the fake `readEventNumber`. R13: the checksum before and after, the header values. R14 and R20: the statement counter and the byte length on the 500-conversation fixture.
- Unit tests, no database: the schemas of R17 (valid and each rejected case) in `packages/shared`.
- Database tests of the two reads (R15) in their modules, with the module's own helpers and the SQL text fixtures.
- Hand check once, output in the pull request: after `dev:reset:db` and the first-Admin step, sign in as the Admin and read `GET /api/v1/bootstrap`: one workspace, one member, #general, `eventNumber` 0.

## Data safety
- The answer is personal: it holds the caller's email address and every person's name and role. It is sent with `Cache-Control: no-store` (R13) and only to a valid session (R1).
- Membership decides what comes (R6, R18): the reads filter on the caller's member row in the query itself, so no later change of the handler can return a conversation the caller is not in. Private channel names and topics are returned only to their members (TOKI-028 Data safety).
- No other person's email address, session, device or invitation is returned (R5).
- No log line holds a name, an email address or a topic: the handler logs nothing about the content; the request log of TOKI-004 holds the route and the status only. Tests use made-up names and addresses of the form `sam@example.com`.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| All conversations come in phase 1, no limit; revisit past 500 (D-117) | R9, R20; Design, "What each part returns" |
| Endpoint name and shape fixed in this ticket's spec (D-125) | API table and shape in Design; R2, R17 |
| No content of a channel not joined, no private channel or DM of others (D-116, BR-09) | R6, R18; Data safety |
| An archived channel leaves everyone's list (F26, D-029) | R6; how the app opens one is concern 2 |
| A DM shows for the other person only after the first message; a DM with a deactivated person stays (F25, F41, D-091, D-094) | R19 for the deactivated person; the first-message rule needs messages and is concern 1 |
| Starred, Channels, Direct messages; level defaults; mute and star personal (F09, D-046, D-103, D-143) | R7, R8; the grouping is built by TOKI-032 from these fields |
| Initials, no email in People (D-118, prototype) | R5; the response holds no picture and no other person's address |
| Reconnect works from the last event number (technical design) | R10, R11 |
| Every route needs a session (TOKI-022, BR-01) | R1 |
| First load under 2 seconds on 4G with 200 people (NFR-13, D-113, NFR-04) | R14, R20 bound the work and the size; the time on a real network is not measured by this ticket (concern 6) |
| Server modules call each other only through public interfaces | R15, R16 |
| Milestone M2; size M; needs TOKI-029, TOKI-030; needed by TOKI-032 | One route, two reads and one schema file; Plan changes names the other needs |

## Open questions from the intent
- Does the response carry unread counts, before messages and the read pointer exist? Answered: no. TOKI-028 decided that this response carries no unread field until TOKI-053; R12 and Plan changes say so. Evidence: TOKI-028 Scope, "Out"; the read pointer is TOKI-053.
- What is the event number before the events table exists? Answered: 0, from one function that TOKI-036 replaces (R11). Evidence: plan, TOKI-036 "a numbered event log"; technical design, Reconnect.
- Which people come with it: only active ones, or deactivated ones too? Answered: all of them, with their status (R5, R19). Evidence: F25 and F41 keep a DM with a deactivated person with its history; FR-42 AC-116 gives a deactivated person no People card, which is the client's filter.
- Does an archived channel come with it? Answered: no (R6). Evidence: F26 "the channel leaves everyone's list". How a member opens one is concern 2.
- Which conversation settings come with it, and as stored or as they apply? Answered: level, mute and star, with the level that applies (R7, R8). Evidence: F09 and F10 (star, mute, bold, grouping), D-046, D-103, D-143; TOKI-028 concern 2 names this ticket as the one that returns them.
- Which ticket makes a new DM appear in the other person's list only after the first message, and orders DMs by latest message? Not answered. Carried forward as concern 1.

## Areas of concern
1. Which ticket hides a DM from the other person until the first message is sent (F25) and returns the latest message time so the client can order DMs by it (F09). Not decided. Both are rules the journeys state and D-091 accepts, but they need the `messages` table (TOKI-036), so this ticket cannot build them: today a DM comes to both people as soon as it is opened (TOKI-028 concern 6), and the order of DMs is left to the client. No ticket in the plan names the work. TOKI-028's hand-off says the hiding belongs to TOKI-031 and TOKI-033; the plan lists TOKI-033 as a screen and TOKI-031 cannot test it before messages exist. Proposal only, not a decision: TOKI-037 (the message API), whose first send is the moment a DM appears for the other person, edits this response (a filter on `created_by` and the existence of a message, and a `lastMessageAt` field) and sends the same event; TOKI-033 orders by the field. Owner: Thanh Truong (product owner, plan).
2. How a member opens an archived channel they belong to, now that the list omits it. Not decided. F10 says an archived channel is readable and F26 says it leaves the list; the person gets there from Browse channels (with its "Archived" label) or from a link, which are TOKI-034 and TOKI-029 requests, and the log does not say whether a member's archived channel is also reachable from the sidebar. This ticket follows F26. Proposal only, not a decision: no sidebar entry; Browse and links open it. Owner: Thanh Truong (product owner).
3. The shape of the response, the key names, one snapshot, the file placement and what is left out. Decided in this spec: `members` and not `people`; the strict schemas of R17; `REPEATABLE READ` and read-only (R10); the folder outside `modules/` (Design, "Where the code lives"); everyone of the workspace, active and deactivated, and no email for others (R5); the level that applies (R8); no description or creator in the entries (R7); `Cache-Control: no-store` (R13). Reason for each is in Design. Owner: Thanh Truong.
4. The event number before the log exists. Decided in this spec: `readEventNumber(tx)` returns 0 and TOKI-036 replaces it (R11). Reason: this ticket (M2) comes before the log (M3), and a field that is absent now and added later would change the shape the client is built on. A client that starts from 0 loses nothing, because no event exists before TOKI-036. Owner: Thanh Truong.
5. Settings of a conversation: who saves them. Decided here only for the part this ticket owns: returning level, mute and star (R7, R8), which the plan does not name for any ticket and TOKI-028 proposed for this one. The request that saves them is TOKI-028 concern 2 and stays with it; until it is built the app can show the values and cannot change them. Owner: Thanh Truong.
6. Size and time. Decided in this spec: the 250 KB bound and the 8-statement bound (R14, R20) are regression guards for 200 people and 500 conversations, chosen here because the log gives the people figure (NFR-04) and the conversation figure (D-117) and sets no byte or statement limit. The 2-second first load on 4G (NFR-13, D-113) is measured on a real network by the web app tickets, not by this one. Past 500 conversations the choice of D-117 is revisited by the product owner. Owner: Thanh Truong.
