# DM and group DM API design

Date: 2026-11-17 · Status: draft for review
Intent: docs/intents/dm-api.md (Thanh Truong)
Ticket: TOKI-030

## Goal
A Member or an Admin needs to start a conversation with one other person, or with up to seven others, and to find the same conversation again whenever the same people ask for it. TOKI-028 gives the tables and the database rules (a key per set of people, member rows equal to the key, no delete). Nothing yet takes a list of people, applies the rules that need a person's role or status, and writes the rows. This ticket adds one request that does it, with stable error codes for the people picker of TOKI-034.
The rules that belong to this request and not to the tables are: only a Member or an Admin may open one (a guest may not, D-050), nobody opens one with themselves (F25), a group holds 8 people at most counting its creator (D-017, D-086), a new conversation cannot include a deactivated person (Design, "Decided in this spec"), and two requests for the same set at the same moment give one conversation.

## Scope
- In:
  - One route, `POST /api/v1/direct-conversations`, that opens a direct message (one other person) or a group (two to seven others) and returns it, created or already existing.
  - The pure rule that turns the list of people into the kind and the key, and the order of the checks.
  - The write of the conversation and its member rows in one transaction, safe against the same set arriving twice at once.
  - A read in the `members` module, `getAccountsByIds`, that returns the role, status and workspace of accounts by id, because this route must not read the `users` table.
  - The request and response schemas and the three new error codes, in `packages/shared`.
  - Tests of the route, the write and the read.
- Out (not now):
  - The tables, their constraints and triggers, the key builder `buildDmKey` and the five reads: TOKI-028. This ticket adds no migration and changes no table.
  - Listing conversations, including the rule that a direct message appears in the other person's list only after the first message (F25): TOKI-031 and TOKI-033, which need `messages` (TOKI-036) for that rule.
  - The people picker, the chips, the text of the refusals and the screen that opens the conversation: TOKI-034 and TOKI-033. The server sends codes and English developer messages only.
  - Sending, reading and loading messages, and refusing a message into a read-only direct message: TOKI-037 (Design, "Hand-offs").
  - Notification level, mute and star of a conversation: not here (TOKI-028 concern 2).
  - Add, remove, leave, archive and restore requests. A direct message or group has none, and the channel routes of TOKI-029 refuse a direct conversation (R14).
  - Guests as people: phase 5. This ticket refuses a guest as the caller and as a person to message (R4, R7); the phase 5 ticket adds the database-level test of D-050.
  - A limit on how many direct messages or groups one person may open: the log sets none.
  - Pushing an event when a direct message is opened: the other person sees it only after the first message (F25), and the event log (TOKI-036, TOKI-038) does not exist yet.

## Requirements
- R1. `POST /api/v1/direct-conversations` is registered under the `/api/v1` prefix and needs a valid session: the session check of TOKI-022 (R24) answers 401 first, for no cookie or token, an ended session and a deactivated account. The route takes the actor's id and role from the account that the session check puts on the request, never from the body. Check: a request without a session returns 401 with the code of TOKI-022 and writes no row; the route list of the app contains this one `POST` path and no other path for direct conversations.
- R2. The body is `{ "userIds": string[] }`: the people to message, not counting the caller, who is added by the server (decided in this spec, Design). `userIds` has 1 or more items, each a UUID in any letter case, and no id twice once lower-cased. The schema is a Zod schema in `packages/shared`, and the route validates with it. A body that does not pass returns 400 `validation_failed` with `details.issues` as in TOKI-004 (no submitted value in it) and writes nothing. Check: tests send a missing body, `{}`, `{ "userIds": [] }`, `{ "userIds": "x" }`, a list with a number, a list with a value that is not a UUID, a list with the same id twice, and the same id in upper and lower case; each returns 400 `validation_failed` and the tables are unchanged. A list with 1 id and a list with 7 ids pass the schema.
- R3. Order of the checks, each stops the request: (1) session (R1); (2) permission (R4); (3) body schema (R2); (4) the caller's own id in the list (R5); (5) more than 7 ids (R5); (6) accounts (R6, R7); (7) existing conversation (R9); (8) deactivated people (R10); (9) create (R11). Steps 4 and 5 read nothing from the database. Check: a list of 8 ids that do not exist returns `group_too_large`, not `not_found`; a list that holds the caller's own id and an unknown id returns `direct_with_self`; a request for a set that already exists and holds a deactivated person returns 200 (R9) and not the 409 of R10.
- R4. Permission. The route calls `canCreateDirectConversation(actor)` of TOKI-027 (R8 there). `role_not_allowed` and `unknown_role` return 403 `forbidden`; `fact_missing` returns 500 `internal_error`. A role of `"guest"` (phase 5) therefore gets 403 and no row is written (D-050, BR-37, D-090). The route compares no role to a string itself (TOKI-027 R16). Check: a test calls the route's handler with an actor of role `member` and one of role `admin` (both pass this step) and with an actor of role `"guest"` and one of role `"owner"` (both 403, no row), and a search of the files of this change finds no comparison of a role to `"admin"`, `"member"` or `"guest"`.
- R5. People and size. The route builds the list `[actor.id, ...userIds]` and uses `buildDmKey` of TOKI-028 (R11 there) for the kind and the key. An id equal to the caller's own id, with other ids or alone, returns 400 `direct_with_self` (messaging yourself is not supported, F25). A list of 8 or more ids in `userIds` (9 or more people with the caller) returns 400 `group_too_large` with `details` `{ "max": 8 }` (D-017, D-086, BR-36). The 8 comes from `GROUP_DM_MAX_PEOPLE` of TOKI-028 (R15). One id gives kind `dm`, 2 to 7 ids give `group_dm`. Check: unit tests of the pure rule for 1, 2, 7 (accepted) and 8 and 200 (refused) ids, for the caller's id alone, first, last and in the middle of a list, and for the same ids in other orders (one key); the route test sends 8 ids and receives 400 `group_too_large` with `details.max` 8, and sends the caller's own id and receives 400 `direct_with_self`; both leave the tables unchanged.
- R6. Accounts. The route reads the accounts of the caller and of every id in `userIds` with `getAccountsByIds` (R15), in one call, and takes the workspace of the new conversation from the caller's account. An id that has no account, or an account of another workspace, returns 404 `not_found`, the same answer for both, with no `details` (BR-09: the answer does not tell whether the person exists elsewhere). Check: a test sends an id that is a UUID nobody has, and an id of an account in a second workspace (a row inserted by the helper of TOKI-019), and gets the same status, code and body for both, and no row is written.
- R7. A person whose role is not `member` or `admin` cannot be messaged: the route answers as for an unknown id (R6). In phase 1 `users.role` cannot hold another value (TOKI-019 R9), so the rule is proved with an account read that the test injects (Design, "How the route gets its dependencies"). Check: a route test injects a read that returns a role `"guest"` for one id and gets 404 `not_found` and no row; with the role `"member"` for the same id it gets 201.
- R8. A group is made only of accounts that exist and belong to the caller's workspace. Check: the same tests as R6 for a group (2 to 7 ids where one id is unknown or in another workspace); no row is written, not even for the valid ids.
- R9. Existing conversation. When a conversation of the caller's workspace has the key of R5, the route returns status 200 and that conversation, writes nothing, and does not look at the status of the people in it. Check: open `[b]` as `a` (201); open `[a]` as `b` returns 200 with the same `id`, and `created_at` and the member rows are the ones of the first request; after `b` is deactivated (a row update by SQL), `a` opens `[b]` again and gets 200 with the same `id`; the count of rows of both tables is the same after each call.
- R10. A new conversation with a deactivated person is refused: when no conversation has the key and one or more of the other people have status `deactivated`, the route returns 409 `person_deactivated` with `details` `{ "userIds": [...] }` holding those ids, lower case, sorted, and writes nothing (F25, F41, D-094). Check: a route test with one deactivated person in a DM and one among three in a group; each returns 409 with the right ids, and the tables are unchanged. A person who is Active again (a row update) can be opened in the same test.
- R11. Create. When no conversation has the key and the checks of R3 passed, the route inserts in one transaction the `conversations` row and one `conversation_members` row for each person in the key, and returns status 201 and the new conversation. The `conversations` row has: `kind` `dm` or `group_dm`; `name`, `topic`, `description` and `archived_at` null; `is_private` true; `is_general` false; `dm_key` the key of R5; `created_by` the caller; `workspace_id` of the caller's account; `created_at` from the injected clock (TOKI-008 R19), not from the database. Each member row has the same `workspace_id`, `created_at` from the clock, `notification_level` null, `is_muted` and `is_starred` false (D-046; the level that applies is `effectiveNotificationLevel` of TOKI-028). The member rows are written in the same transaction as the conversation, as TOKI-028 R21 requires. Check: a database test reads both tables after a DM and after a group of 8 and compares every column; a test passes an account read that reports an id for which `users` has no row, so the foreign key of `conversation_members.user_id` fails on the member insert; the request returns 500 `internal_error` and the `conversations` row is not there.
- R12. Same people, same conversation. For any set of people, every request that names the others of that set, from any member of it, in any order and in any letter case, returns the conversation with the same `id`. Check: a group of `a`, `b`, `c`: `a` opens `[b, c]`, `b` opens `[c, a]`, `c` opens `[A-in-upper-case, b]`; the first returns 201 and the other two 200 with one `id`; a fourth person `d` opening `[a, b, c]` gets a different conversation; `a` opening `[b]` gets a different one again.
- R13. Two requests at the same moment. When several requests for one set arrive together, one creates the conversation and the others return it: exactly one answers 201, the others 200 with the same `id`, the tables hold one `conversations` row and one member row for each person, and no request fails with a unique violation or an internal error. The insert uses `INSERT ... ON CONFLICT (workspace_id, dm_key) DO NOTHING` and then reads the row by the key (TOKI-028, Hand-offs). Check: a test sends the same DM from `a` and from `b` together, and a group of 4 from its four members together, and 10 requests of one person for one DM together, each on separate database connections; the counts above hold in every run, and the test repeats each case 20 times.
- R14. A group never gains or loses people. The only code in this ticket that writes `conversation_members` for a `dm` or `group_dm` is the insert of R11, and no route of this ticket adds, removes or changes a person. A request for a set that differs by one person gives another conversation and leaves the first unchanged. Check: open a group of `a`, `b`, `c`; then open `[b, c, d]` as `a` and `[b]` as `a`; the three conversations have three `id`s and the first still has exactly the member rows `a`, `b`, `c`; a search of the files of this change finds no `UPDATE` or `DELETE` on `conversation_members`. The refusal of "add people" and "remove people" for a direct conversation is in the channel routes (TOKI-029, Design, "Hand-offs"), which use the `not_a_channel` answer of TOKI-027 (R9).
- R15. The `members` module exports `getAccountsByIds(db, ids)`, a read that returns, for each id that has a row in `users`, `{ id, workspaceId, role, status }` with `status` `active` or `deactivated` (TOKI-022 and TOKI-024 R37 read accounts the same way), and nothing for an id with no row. It takes the database client or a transaction, writes nothing and returns no email address or display name. Whichever of this ticket, TOKI-029 (its R19 adds the same read with `{ id, status }`), TOKI-024 and TOKI-020 is built first adds the function; a later ticket extends it only when a field is missing, so there is one function with these four fields. Check: a database test with an active Admin, a deactivated Member and an unknown id returns two items with the right fields and no third; an empty list returns an empty list.
- R16. Module boundaries. The `conversations` module does not import the `members` module, because `members` already imports `conversations` for #general (TOKI-024 R20, TOKI-020), and a cycle would stop the server at start. The route plugin is a function `directRoutes({ db, clock, getAccountsByIds })` exported from `modules/conversations/index.ts` and registered in `apps/server/src/api/index.ts`, which imports the `index.ts` of both modules and passes the read in (TOKI-002 R17 allows this). No file of this change imports a table definition of another module. Check: `pnpm lint` exits 0; a test lists the names exported by `modules/conversations/index.ts` and finds those of TOKI-028 R18, `directRoutes` and the types of this ticket, and no others; a test starts the app through `buildApp` with the real `api/index.ts` and finds the route registered.
- R17. The shared schemas are in `packages/shared/src/direct-conversations.ts`, exported from the package index: the body of R2, the response of R18, and the constant `DIRECT_CONVERSATION_MAX_OTHERS` (7, written as `GROUP_DM_MAX_PEOPLE - 1`). The server and the web client use the same schemas. Check: a type test imports each name from `@toki/shared`; the route test parses every 200 and 201 body with the response schema.
- R18. Response. Status 200 or 201 with `{ "conversation": { "id": string, "kind": "dm" | "group_dm", "memberIds": string[], "createdBy": string, "createdAt": string } }`. `memberIds` are the ids of the people in the key, lower case, in key order (sorted), the caller included. `createdAt` is an ISO 8601 time in UTC. The body has no name, topic, last message or unread count: a direct message has no name (TOKI-028 R5) and the screens draw the title from the people (D-155 keeps the plus as the one entry, F25 gives the title). Check: the schema test of R17; for a DM and a group the `memberIds` equal the member rows read from the table, sorted; a field not in the schema is absent.
- R19. Error codes. This ticket adds to the registry of error codes in `packages/shared` (TOKI-004): `direct_with_self` (400), `group_too_large` (400) and `person_deactivated` (409), and uses `validation_failed`, `not_found` and `internal_error` of TOKI-004 and `forbidden` (403) of TOKI-024 R2; whichever of the two tickets is built first adds `forbidden`. Every error body passes the error schema of TOKI-004. Check: a test finds the three new codes in the registry; every refusal test above also parses its body with the error schema.
- R20. No other effect. A request writes no message, no event, no notification and no row outside `conversations` and `conversation_members`; it logs the usual request line and no list of people. Check: after each outcome the row counts of every other table are unchanged; the test log holds no id from `userIds`.
- R21. A refusal never changes data. For every status other than 200 and 201, both tables hold exactly what they held before the request. Check: every route test of a refusal compares the full contents of both tables before and after.

## Design
### API
| Method | Path | Session | Purpose |
|---|---|---|---|
| POST | `/api/v1/direct-conversations` | required | Open the direct message or group made of the caller and `userIds`; create it if it does not exist |

The path names the thing that is opened and is separate from the channel routes of TOKI-029. A `POST` that finds the existing conversation answers 200 and one that creates answers 201, so a client can tell them apart without a field; both bodies are the same (R18).

Body and response shapes are in R2 and R18.

### Outcomes
| Status | `error.code` | `details` | Meaning | The client is expected to |
|---|---|---|---|---|
| 201 | none | none | Created; body `conversation` | Open it; it is empty |
| 200 | none | none | The same people already had it; body `conversation` | Open it with its history |
| 400 | `validation_failed` | `issues` (TOKI-004) | Body not valid (R2) | Not reachable from a correct screen |
| 400 | `direct_with_self` | none | The caller's own id is in the list (R5) | Not reachable from a correct screen; the caller is never offered |
| 400 | `group_too_large` | `max` (8) | 8 or more others (R5) | Show the limit message of F25 |
| 401 | `unauthenticated`, `session_ended`, `account_deactivated` | none | TOKI-022 | As TOKI-023 and TOKI-099 |
| 403 | `forbidden` | none | Role not allowed (R4) | Show the shared no-access page (D-131) |
| 404 | `not_found` | none | An id is unknown, in another workspace or not a Member or Admin (R6, R7) | Refresh the people list (D-131) |
| 409 | `person_deactivated` | `userIds` | A person in a new conversation is deactivated (R10) | Refresh the people list and let the person choose again (D-131: 409 means a fresh copy) |
| 500 | `internal_error` | `requestId` | Server failure, or a permission function answered `fact_missing` (R4) | Retry with the error ID (D-131) |

The texts a person reads, for example "Up to 8 people, counting you" in flow F25, are written by the screen ticket (TOKI-034). The prototype does not contain them, so per D-139 they are proposals, and no text is sent by this ticket.

### How a request runs
1. The session check (TOKI-022) puts the account on the request. The route takes `id` and `role` from it.
2. `canCreateDirectConversation(actor)` (R4), then the body schema (R2).
3. The pure rule `planDirectConversation(actorId, userIds)` in `direct.ts` lower-cases the ids, refuses the caller's id (`direct_with_self`) and a list that makes more than 8 people (`group_too_large`), and calls `buildDmKey`. It reads nothing. Its result is `{ kind, key, memberIds }` or the name of the refusal (R5).
4. One call to `getAccountsByIds` for the caller and the others. The pure rule `checkPeople(callerRow, rows, ids)` in `direct.ts` returns `not_found` for a missing id, another workspace or a role that is not `member` or `admin` (R6, R7), and otherwise the ids of the deactivated people.
5. One transaction, with the clock read once at its start:
   1. Look for the conversation: `SELECT ... WHERE workspace_id = $1 AND dm_key = $2`. Found: answer 200 (R9), whatever the status of the people in it.
   2. Not found and one or more people are deactivated: answer 409 (R10) and write nothing.
   3. Not found and nobody is deactivated: `INSERT INTO conversations (...) ON CONFLICT (workspace_id, dm_key) DO NOTHING RETURNING id`. A row came back: this request made it, so insert one member row for each person of the key and commit; the deferred trigger of TOKI-028 (R21 there) checks at commit that the member rows match the key; answer 201. No row came back: another request made the same conversation between 5.1 and 5.3 (the insert waited for it to commit), so read it by the key and answer 200 (R13).

Why the existing conversation wins over a deactivated person: F25 says an existing direct message with a deactivated person keeps its history, and F41 says it becomes read-only, so the caller must still be able to open it.

### Decided in this spec
These are technical choices the Blueprint leaves to the builder.
- The path is `POST /api/v1/direct-conversations`. Reason: a direct message and a group are not channels, and TOKI-029 owns the channel routes.
- `userIds` are the other people, and the server adds the caller. Reason: the caller's id is already known from the session, so a client cannot name a different caller, and "up to 8 counting you" becomes 7 others (R5).
- 201 for created and 200 for existing, same body. Reason: D-111 asks the server to ignore a repeat of the same request. The natural key (the set of people) does that, so no `Idempotency-Key` header is needed here; a repeat returns the same conversation.
- The caller's id inside `userIds` is refused (`direct_with_self`), not ignored. Reason: F25 says messaging yourself is not supported; a request that names oneself is a mistake of the client, and ignoring it would turn a request for `[self]` into an empty list.
- A guest, and an id that is not a Member or an Admin, give 404 `not_found` as an unknown id does. Reason: D-050 keeps a guest inside one channel, so the existence of a guest is not shown outside it.
- A guest as the caller gives 403, also for `unknown_role` (TOKI-024 R1 sends `unknown_role` to 500 for its own Admin routes). Reason: D-050 says the server refuses a guest's start-DM request (AC-059, TS-092); a refusal is 403 (D-131).
- A deactivated person in a new conversation gives 409. Reason: F25 says a deactivated person is not listed, so only a stale list or a hand-made request can name one; D-131 maps 409 to "fresh copy". This is a builder's rule; the log does not state a status for it.
- The route takes its account read as a parameter (R16). Reason: the dependency `members` to `conversations` already exists, and the other direction would be a cycle.
- No lock on the `users` rows. A person deactivated at the very moment a conversation with them is created may end up in it. The conversation is then read-only for the other person (F41); nothing else is wrong, and the lock design of TOKI-024 (R39) is not widened for this. Reason: the cost of the race is a read-only conversation, which is the state a deactivation creates anyway.
- The route reads accounts through `getAccountsByIds` and not through the session's account, because it needs the status and workspace of other people. The caller is read again in the same call so that its workspace is the one the target accounts are compared with.
- The key, kind and member rule come from TOKI-028 (`buildDmKey`, constraints and triggers); this ticket repeats none of them in SQL or in a second sorting function.

### Layout
```
apps/server/src/modules/conversations/
├─ direct.ts               planDirectConversation, checkPeople (pure)
├─ direct-open.ts          the transaction of "How a request runs" step 5
├─ direct-routes.ts        directRoutes({ db, clock, getAccountsByIds })
├─ index.ts                TOKI-028 exports + directRoutes and the types
├─ direct.test.ts          pure rules (R5, R6, R7, R10 unit part)
├─ direct-open.db.test.ts  create, existing, concurrent, rollback (R9, R11 to R14, R21)
└─ direct-routes.test.ts   route outcomes, order, permission (R1 to R4, R6 to R10, R18 to R21)
apps/server/src/modules/members/
├─ account-reads.ts        getAccountsByIds
├─ account-reads.db.test.ts
└─ index.ts                + getAccountsByIds
apps/server/src/api/index.ts   registers directRoutes with the read of members
packages/shared/src/direct-conversations.ts   schemas, constant; exported from the package index
```

### How the route gets its dependencies
`api/index.ts` is a file outside `modules/`, so it may import the `index.ts` of both `conversations` and `members` and join them: `directRoutes({ db, clock, getAccountsByIds })`. The route test registers the plugin through `buildApp({ config, registerRoutes })` (TOKI-004 R16) with the real read, and another test with a read that returns a role `"guest"` (R7). A test signs in a person with the session function of TOKI-022 (R29, token transport) on rows from the helper of TOKI-019 and sends the `Authorization` header.

### Hand-offs
- TOKI-029 (channel API): its add, remove, join, leave, archive and restore routes answer the id of a direct message or group as "not a channel" through the permission functions of TOKI-027 (R9 there), so the request of AC-058 and TS-091 ("send an add-member request for the group") is refused there. The status and code are TOKI-029's. This ticket has no such route.
- TOKI-031 (bootstrap): builds its own read of conversations and members (`listConversationSummaries`, its R15), so this ticket exports no read of direct conversations; TOKI-029 expects one from this ticket (its Hand-offs) and does not need it. The rule that a new direct message is absent from the other person's list until the first message (F25) belongs to TOKI-031 and TOKI-033 and needs `messages` (TOKI-036); both member rows exist from the moment of opening (TOKI-028 concern 6). The people picker takes its candidates from the members of the bootstrap call (no route of this ticket lists people, and `GET /members` of TOKI-024 is for Admins).
- TOKI-034 (picker): sends `userIds`, opens the returned conversation (D-076), and turns `group_too_large`, `person_deactivated` and `not_found` into its messages. It enforces the 8 limit on the chips too, with `GROUP_DM_MAX_PEOPLE`.
- TOKI-037 (messages): refuses a message into a direct message whose other person is deactivated (F41, D-091: "DMs with them become read-only"). It reads the members with `listMemberIds` (TOKI-028) and the status with `getAccountsByIds` (this ticket). For a group with a deactivated member see concern 1. The first message must reach the other person's client together with the conversation; TOKI-037 and TOKI-038 own that.
- TOKI-028: its export test lists the exports exactly. This ticket adds `directRoutes` and its types to that list in the same change, and TOKI-029 and TOKI-020 do the same for theirs (concern 3).

## Testing
- Written test-first, as the Blueprint asks for backend work. Fake data only: generated ids, made-up names, no real addresses.
- Unit tests, no database: `planDirectConversation` and `checkPeople` (R5, R6, R7, R10), with the injected guest role of R7 and the sets of R5; `GROUP_DM_MAX_PEOPLE - 1` against `DIRECT_CONVERSATION_MAX_OTHERS` (R17).
- Database tests (`*.db.test.ts`, the database project of TOKI-008; each file starts with empty tables): the transaction of R11 to R14 and R21, including the concurrent cases of R13 on separate connections, repeated 20 times, and the rollback case. Rows of `workspaces` and `users` come from the helper `apps/server/src/db/test-rows.ts` of TOKI-019; a second workspace for R6 and R8 is a second helper row. Conversation rows are read by SQL text, so the tests do not import another module's table.
- Route tests: the app is built with `buildApp`, a person is signed in by the session function of TOKI-022 and the request is sent with `app.inject`. Each outcome of the table is covered with the exact status, `error.code` and `details`; every body is parsed with the error or response schema; every refusal compares both tables before and after (R21). R3's order is tested with the three mixed cases it names.
- `getAccountsByIds` has its own database test (R15).
- R16: `pnpm lint`, the export-list test and the `buildApp` route-list test.
- Not covered here, by design: a guest account in the database (phase 5, Scope), and the screens.

## Data safety
- Membership is the access rule (TOKI-028): a direct message is visible only to the people in its key, and the route returns a conversation only to someone who is in its key, because the caller is always in the list it builds (R5). The route never returns a conversation the caller is not in.
- The answer for an unknown id, an id of another workspace and a guest is one answer (R6, R7), so the route cannot be used to find out who exists or who is a guest.
- The route reads no email address or display name (R15) and logs no ids of people (R20).
- Tests use fake data and never touch the development database (TOKI-008).

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Milestone M2, size M, needs TOKI-028 | Planning fact; the scope is one route, two pure rules, one read and the shared schemas. It also needs TOKI-027, TOKI-022 and TOKI-019 (Plan changes below) |
| A group holds up to 8 people counting its creator; people cannot be added or removed (D-017, D-045, D-086, BR-36) | R5 (limit), R14 (no route changes people), TOKI-028 R10 and R21 (key and member rows fixed) |
| The same set of people always leads to the same conversation; no messaging yourself (F25) | R5, R12, R13 |
| Every Member and Admin may start; guests may not (BR-37, D-050, D-090) | R4, R7 |
| Permission is checked on the server; direct messages visible to members only (BR-09, D-077) | R1, R4, Data safety |
| A deactivated person is not listed; an existing direct message keeps its history (F25, F41, D-094) | R9 (existing opens), R10 (no new one with them) |
| The tables, rules and key come from TOKI-028 and are not changed | Scope Out; R5 uses `buildDmKey`; R11 and R13 use the tables as they are; no migration |
| One error format; D-131 status mapping | R19 and the Outcomes table |
| Modules never read each other's tables | R15, R16 |
| English is the default; the screens translate | Outcomes: codes and English developer messages only; the texts are TOKI-034's |

## Open questions from the intent
- Can a new direct message or group be opened with a person who is deactivated? Answered: no, 409 `person_deactivated`, while an existing conversation with them still opens (R9, R10). The log gives the flows that such a person is not listed (F25) and that direct messages with them become read-only (F41), accepted as the baseline in D-091, and gives no status for the request; the status is a builder's choice (Design, "Decided in this spec"). Evidence: Blueprint flows F25 and F41; D-094; D-131.
- When one member of a group is deactivated, does the whole group become read-only? Not answered. Carried forward as concern 1.
- Which ticket stops a message being sent into a direct message with a deactivated person? Answered: TOKI-037, which writes the message and reads the status (Hand-offs). This is for a direct message of two people; for a group see concern 1. Evidence: F41; TOKI-028, Hand-offs.

## Areas of concern
1. Whether a group direct message becomes read-only when one of its members is deactivated. Not decided. Flow F41 says "DMs with them become read-only" and F25 says an existing direct message with a deactivated person keeps its history with the composer replaced; neither names groups, and D-094 is about invitations. The tables and this ticket work either way. Proposal only, not a decision: only a direct message of two people is read-only; a group stays writable for its other members, and the deactivated member keeps the label "Deactivated" (F41). TOKI-037 builds the refusal and needs the answer. Owner: Thanh Truong (product owner).
2. The status and code for a new conversation that names a deactivated person, and for a guest as the person to message. Decided in this spec: 409 `person_deactivated` and 404 `not_found` (Design, "Decided in this spec"). The log decides neither; if the product owner prefers another status, only R6, R7, R10 and the Outcomes table change. Owner: Thanh Truong.
3. The export list of the `conversations` module. Decided in this spec: this ticket adds `directRoutes` and its types to the list that the test of TOKI-028 R18 checks, in the same change, and does not rewrite the test otherwise. TOKI-028 says the list is "exactly" five names, and TOKI-020 asks for two more (`createGeneralChannel`, `addMemberToGeneral`) and TOKI-029 will add more, so the test must be changed by each ticket that adds an export. Request to TOKI-028: word R18's export test as "the names listed in one constant, which each ticket extends". Owner: Thanh Truong.
4. Spelling of the validation code. Decided in this spec: this route uses `validation_failed`, the code of the registry in TOKI-004 (concern 14 there) and of TOKI-024. TOKI-022 writes `validation_error` in R7 and R20; its owner changes that spelling. Owner: Thanh Truong.
5. Plan changes. Decided in this spec: TOKI-030 needs TOKI-027 (the permission function), TOKI-022 (the session check and the account on the request) and TOKI-019 (the `users` table behind the account read), besides TOKI-028; the plan lists only TOKI-028. This ticket edits no other spec. Owner: Thanh Truong.
