# TOKI-029 Channel API: plan

Ticket: TOKI-029 (issue 119) · Tier L · Branch `feat/toki-029-channel-api`
Spec (source of truth, accepted in PRs 81 and 174): `docs/specs/2026-11-17-channel-api-design.md`. Requirement numbers `R1`..`R22` below are the spec's; each requirement's "Check" sentence is the list of cases its test file holds.

## Design

The spec fixes what each route does. This section says how it fits the server code that exists today, and where that code differs from what the spec assumed.

### Where the code goes

```
packages/shared/src/channels/
├─ limits.ts          CHANNEL_BROWSE_PAGE_DEFAULT, CHANNEL_BROWSE_PAGE_MAX, CHANNEL_MEMBERS_ADD_MAX, UUID_V7_PATTERN
├─ schemas.ts         Zod schemas of every request and response (R3 to R14, R22)
└─ index.ts           re-exports both; the package index adds `export * from "./channels/index.js"`
packages/shared/src/error.ts          five new codes appended (R17), and `selfTarget` if it is still absent
apps/server/src/modules/members/accounts.ts   getAccountsByIds (R19), exported from members/index.ts
apps/server/src/modules/conversations/
├─ channel-routes.ts  channelRoutes(deps): registers the twelve routes; handlers only parse, call and answer
├─ access.ts          the steps of R1: load facts, hide what must be hidden, call a permission function, map a refusal to a status (R2)
├─ channels.ts        the writes behind the routes, each in one transaction with the locks of R15; archivesWhenEmptied
├─ browse.ts          the browse query, the cursor, summaries, the active member count (R6, R7, R8)
├─ settings.ts        the settings write (R22)
├─ changes.ts         recordChange and the change types (R16)
└─ index.ts           adds `channelRoutes` to the exports
apps/server/src/app.ts                registers channelRoutes with db, clock and getAccountsByIds
apps/server/tests/conversations/      channels.*.db.test.ts, one file per group of routes, and channels.locks.db.test.ts
packages/shared/tests/channels/       schema boundary tests
```

### How a request runs

1. The session hook that exists (`registerAuthHooks`) has already put `request.account` on the request; a request with no session never reaches a handler.
2. The handler parses path, query and body with the shared Zod schemas inside the handler (`Schema.parse(...)`), as the auth routes do. Create is the exception of R1 step 1: `canCreateChannel(actor)` runs before any parsing, so a Member gets 403 with a valid, an invalid and an empty body. A `ZodError` already becomes 400 `validation_failed` in `registerErrorHandling`. A path id that is not a lower-case UUID of any version is refused here, so it never reaches Postgres as a cast error; only the `id` of Create must be version 7 (the test harness makes version-4 user ids).
3. `access.ts` has one function, `checkAccess(deps, client, actor, id, permission)`, used for the first pass and again inside the transaction: it reads the facts with `deps.getConversationFacts` (never the imported function, so a test can replace it), answers 404 for `null`, for a DM or group, and for a private channel the actor is not in (R1 step 3), then calls the permission function and turns a refusal into an `AppError` by the table of R2. The settings route (R22) does not use it: a DM or group is allowed there for a member, and it calls no permission function, so `settings.ts` has its own short check, which takes `deps` the same way.
4. A write opens `db.transaction`, locks the account rows with `getAccountsByIds(tx, ids, { lock: "share" })`, locks the conversation row with a single-table `select id ... for no key update` (the facts query is a left join and cannot carry the lock), then calls `checkAccess` again with `tx` and the locked actor (R1 step 5, R15; under `READ COMMITTED` that second statement sees what was committed while the lock waited). The actor passed to the permission function is `{ id, role }` with the role text of the locked row. Then it writes, calls `recordChange(tx, change)`, and commits.
5. Errors are thrown as `AppError(status, code, message)`; there is no send helper in this code base.

### Decisions where the code differs from the spec

- Registration place. The spec says `apps/server/src/api/index.ts` registers the plugin. Today `registerApi` has no database or clock; every real registration happens in the callback inside `app.ts` (lines 112 to 122), where `db` and `clock` are in scope. `channelRoutes` is registered there, next to `registerAuthRoutes`. `app.ts` imports the `index.ts` of `members` and of `conversations` and passes `getAccountsByIds` in, which is the injection R18 asks for. The check of R18 ("the app built by `buildApp` has the twelve routes") is unchanged.
- Shape of the plugin. `channelRoutes(deps)` returns a `FastifyPluginAsync`, as R18 and the contract table say (TOKI-030 copies the shape), and is registered with `await scope.register(channelRoutes({ db, clock, getAccountsByIds }))`; it inherits the `/api/v1` prefix and the root session hook. `deps` is `{ db, clock, getAccountsByIds, recordChange?, getConversationFacts? }`; the two optional members default to the real functions. `BuildAppOptions` gains `channelDeps?` (a partial of the three functions) that `app.ts` spreads over the real ones, and `createHarness` gains the same option and passes it on. That is how a test injects a recording `recordChange` (R16), a `recordChange` that forces a constraint failure (R20), an account read that returns the role `guest` (`unknown_role`; the check constraint of `users` refuses it in the database) and a facts read that returns a broken fact (`fact_missing`). A second registration of the routes through `registerRoutes` is not possible: Fastify refuses a duplicate route.
- The empty JSON body. The spec gives `channelRoutes` its own JSON parser for an empty body. The server already has one (`modules/auth/register.ts`, lines 36 to 45): an empty body with the JSON type arrives as `undefined`. No second parser is added; the test of the three body forms on the four body-less routes stays.
- The module boundary. The spec's reason for the injection ("`members` already imports `conversations`") is not true today: neither module imports the other. The rule is kept anyway, because the test of TOKI-028 R18 (`tests/conversations/exports.test.ts`) scans the conversation files for an import of `members`. The new files of this ticket are added to that scan list, and `channelRoutes` to its list of exported names.
- Two database types. The conversation reads take `PostgresJsDatabase`; `members` takes `DbClient`. A transaction satisfies both, so the writes pass `tx` to both; no type is changed.
- `self_target`. R13 answers 409 `self_target` and the spec calls it a code of TOKI-024, which is not merged; the registry has no such code today. This ticket appends `selfTarget` with the five new codes. If TOKI-024 merges first, the rebase keeps one entry.
- A constraint error must not carry a channel name into the log (R20). The 500 handler logs the error object, and a Drizzle error message contains the query parameters. `channel-routes.ts` wraps every handler in a local guard (the pattern of auth's `guarded()`): an `AppError` or `ZodError` passes through; a Postgres unique or check violation on `conversations_workspace_id_name_key` or `conversations_general_name_check` becomes 409 `channel_name_taken`; anything else is rethrown as a new error that holds only the Postgres code and the constraint name. Drizzle wraps a failure in `DrizzleQueryError`, whose message holds the parameters; the code and the constraint name are read from its `cause`. No real request reaches a constraint error (`ON CONFLICT DO NOTHING`, the schemas and the `general` check come first), so the test of R20 forces one: it passes a `recordChange` that runs a conflicting insert, and checks the answer and the captured log.

### The active member count (R6, R7, R12)

`conversations` cannot read `users`. Two reads are added to this module: the row of a channel with the fields of `ChannelDetail` (name, topic, description, creator, creation time), and the pairs of a page. `browse.ts` selects the `(conversation_id, user_id)` pairs of the channels of one page in one statement, the route asks the injected `getAccountsByIds` once for the distinct ids (no lock), and the count of a channel is its pairs whose account is `active`. The leave uses the same two reads inside its transaction, after the lock on the conversation row.

### Tests

- Integration tests on the real Postgres with `createHarness` (`tests/auth/test-harness.ts`): `addUser(email, { role })`, `signIn`, `withCookie`. A small local helper makes a signed-in Admin and Member, since none exists.
- Concurrency tests take the second connection from the harness's own database (`postgres(h.config.database.url)`, closed in the test), so it sees the rows the app sees, and wait on `pg_stat_activity` for a lock wait, as `tests/conversations/general.db.test.ts` does; no sleeping. `createMigratedDb().connect()` opens another throwaway database and is used only in S2, which tests `getAccountsByIds` with no app. TOKI-024 is not merged, so a demotion or a deactivation is a raw `update users` in an open transaction on the second connection.
- Three checks of R15 are set up in the only order that can happen: the second connection changes the actor's (or the added person's) `users` row first and holds it; the request then waits on its `FOR SHARE` read, and after the commit it answers 403 `forbidden`, 401 `account_deactivated` or 400 `invalid_member`. The spec words the first as "the archive waits on the conversation lock while another request demotes them"; once the archive holds its share lock on the actor the demotion is the one that waits, so that wording cannot be produced and the test covers the rule of R1 step 5 instead.
- The log check of R20 reads `h.logText()`.
- The worktree has no `node_modules`: `corepack pnpm install` under Node 22 comes first.
- Commands: `pnpm --filter @toki/server exec vitest run --config vitest.db.config.ts tests/conversations/<file>`, then `pnpm --filter @toki/server test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, all under Node 22.

### Risks

- TOKI-024 is being built on another branch and touches `packages/shared/src/error.ts`, `packages/shared/src/index.ts`, `apps/server/tests/test-rows.ts` and `modules/members/`. This ticket only appends to those files, so a conflict is textual; whichever merges second rebases.
- The riskiest part is R15: the lock order (account rows, then the conversation row, then member rows) and the repeat of the permission check with the locked actor. Each write route gets its two-connection case in the step that builds it.
- The ticket is large (twelve routes). It is built in slices that each end green: shared schemas and codes; `getAccountsByIds`; the access steps; create; browse, details and members; edit; join and add; leave and remove; archive and restore; settings; locks; the seam and the log check.

## AC to step to test

Server test files are in `apps/server/tests/conversations/`; shared ones in `packages/shared/tests/channels/`.

| Req | Step | Test |
|---|---|---|
| R17 | S1 | `schemas.test.ts`: each request and response schema accepts and refuses its boundaries (name 80/81, topic 250/251, description 500/501, `memberIds` 200/201, `limit` 1/100/101, `search` 80/81, version-4 and upper-case `id`, unknown key on PATCH, settings with no key, level `loud`); `registry.test.ts`: the six codes are present once and no value is repeated |
| R19 | S2 | `tests/members/accounts-by-ids.db.test.ts`: fields returned, nothing for an unknown id, no email or name, `role` as stored text, id order, `lock: "share"` blocks an `update users` on a second connection until commit |
| R18 | S3 | `exports.test.ts` (names list gains `channelRoutes`, scan list gains the new source files; a test file that imports `modules/members` stays out of that list); `channels.routes.db.test.ts`: the app from `buildApp` has the twelve routes; each answers 401 without a session |
| R3, R4, R5, R21 | S4 | `channels.create.db.test.ts`: the cases of R3 to R5 and of Testing, "Create", incl. a Member refused 403 with a valid, an invalid and an empty body (R1 step 1) and the two two-connection cases; the migration folder is unchanged (`git status` check in S12) |
| R6, R7, R8 | S5 | `channels.browse.db.test.ts`: who sees what, paging of 120, `search` cases, `COLLATE "C"` order, `memberCount` without a deactivated person, summary only for a non-member, the member list pages (120 members with `limit` 100 take 2 requests) and refuses a non-member |
| R9 | S6 | `channels.edit.db.test.ts`: both roles, non-member 403, archived 409, topic 250/251 and emoji, description 500/501, emptied topic null, extra key refused, the two-field concurrent edit keeps both |
| R10, R11 | S7 | `channels.membership.db.test.ts`: join cases incl. `settings` (the member row is removed with SQL here; the leave-then-join case is in S8), add cases incl. `invalid_member`, repeats and order of the answer |
| R12, R13 | S8 | `channels.leave.db.test.ts`: leave public then join again (with and without `settings`), leave private, twice, #general by a member (409) and by a person outside it (`changed` false, answered before `channel_is_general`), last member of a private and of a public channel, last active member with a deactivated one left; remove by an Admin member, by a Member, by an Admin outside the channel (TS-095), in #general, oneself, a non-member |
| R14 | S9 | `channels.archive.db.test.ts`: both roles, #general, twice, archive by an Admin who is not a member of a public channel (403) and of a private one (404), restore of an active channel, restore by an Admin who is not a member (public: member row and two changes; private: 404) |
| R22 | S10 | `channels.settings.db.test.ts`: the Check of R22 |
| R1, R2 | S3, then each route's step; checked whole in S11 | `channels.access.db.test.ts`, started in S3 with the reasons that need no route of a later step (through `channelDeps` and a probe of `checkAccess`) and grown with each route: table test of every reachable reason through a route and of the others through `channelDeps` (a facts read and an account read given by the test); private channel and DM ids are 404 on every channel route; a positive case per route |
| R15 | S4, S7 to S9, S11 | `channels.locks.db.test.ts`, grown with the routes: create with a person being deactivated (S4); join against archive, and a join whose actor is deactivated (S7); two last members leaving, a leave against an add (S8); an edit against an archive, an archive whose actor is demoted (S9); no deadlock with `addMemberToGeneral` (S11). Set up as Design, "Tests" says |
| R16 | each route's step; checked whole in S12 | `channels.seam.db.test.ts`, grown with each write route: a recording `recordChange` counts one call per effective write, two for the emptying leave and the restore by a non-member, none per no-op; a rollback after the call leaves nothing |
| R20 | S12 | `channels.safety.db.test.ts`: a forced constraint failure answers 409 or 500 and the captured log holds no channel name, topic, description or id list; the three body forms and `{"x":1}` on the four body-less routes |

## Steps (test first)

Each step writes its test file first, runs it and sees it fail for the stated reason, then writes the code, then runs the file green and commits. A test that passes before its code exists is fixed before going on. S11 and S12 are the exception: they are check steps over code that S3 to S10 already built and tested case by case, so their runs are expected to be green the first time; a red run there is a defect to fix, not the start of a cycle.

1. **S1 Shared package.** `packages/shared/src/channels/{limits,schemas,index}.ts`, `packages/shared/src/index.ts` (one export line), `packages/shared/src/error.ts` (append `channelNameTaken`, `channelIdInUse`, `channelArchived`, `channelIsGeneral`, `invalidMember`, `selfTarget`). Schemas are strict objects (`z.strictObject`), so an unknown key fails. Fails first: module not found.
2. **S2 Account read.** `apps/server/src/modules/members/accounts.ts` gains `getAccountsByIds(client, ids, options?)` with `inArray`, `orderBy(users.id)` and `.for("share")` when asked; exported from `members/index.ts`. An empty `ids` returns `[]` without a query. Fails first: no such export.
3. **S3 Skeleton.** `changes.ts` (the change union and a `recordChange` that does nothing), `access.ts` (`checkAccess`, the reason-to-`AppError` table of R2), `channel-routes.ts` (the plugin, the guard, twelve handlers that throw 500 `internal_error` until their step), `conversations/index.ts`, `app.ts` (registration and `channelDeps`), `tests/auth/test-harness.ts` (the `channelDeps` option), `tests/conversations/exports.test.ts`, and a helper `tests/conversations/channel-helpers.ts` (a signed-in Admin and Member, a second connection on the harness's database, the wait for a lock). Fails first: the route list is empty.
4. **S4 Create.** `channels.ts`: `createChannel` (locks the account rows, checks `invalid_member`, the `general` name, `ON CONFLICT DO NOTHING`, the repeat rule of R5), and the detail read in `browse.ts`. Fails first: 500 from the skeleton.
5. **S5 Browse, details, members.** `browse.ts`: the page query with `COLLATE "C"`, the opaque cursor (base64url of the last name; of `joinedAt` and `userId` for members), the pairs read and the active count; the three GET handlers.
6. **S6 Edit.** `channels.ts`: `editChannelDetails` with the trim-to-null rule and an update of the given fields only.
7. **S7 Join and add.** `channels.ts`: `joinChannel` (optional `settings`), `addMembers`.
8. **S8 Leave and remove.** `channels.ts`: `leaveChannel` with `archivesWhenEmptied` and the active count, `removeMember`.
9. **S9 Archive and restore.** `channels.ts`: `archiveChannel`, `restoreChannel` (inserts the member row of an Admin who is not a member).
10. **S10 Settings.** `settings.ts` and its handler.
11. **S11 Check: access table and the last lock case.** Read the access table against R2 row by row and add any reason or route still missing; add the `addMemberToGeneral` case to the lock file. The other access, seam and lock cases were written with their routes in S3 to S10.
12. **S12 Check: seam, safety, the whole run.** Read the seam file against R16 (one call per effective write of every route, none per no-op) and write the safety file of R20; then `pnpm --filter @toki/server test`, the root `pnpm test` (which runs the tests of `packages/shared`; that package has no script of its own, and one folder is run with `pnpm exec vitest run packages/shared/tests/channels`), `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `git status apps/server/migrations` shows no change (R21).

## What can break, and the riskiest step

- **Riskiest: the locks of R15, in every write step.** A wrong order deadlocks only under two connections. The lock helper is one function in `channels.ts` (`lockForWrite(deps, tx, actorId, otherIds, conversationId?)`; Create passes no conversation id, because it locks no conversation row) used by every write, so the order is written once, and each write route gets its two-connection case in the step that builds it, starting with Create in S4.
- **The 404 that hides a private channel (R1 step 3).** One forgotten route leaks existence as 403. The access test loops over every channel route with one private id and one DM id.
- **`changed` false paths.** Each no-op must write nothing and call `recordChange` zero times; the seam test counts them per route.
- **The cursor.** Names sort by bytes; the test uses names with `-` and digits across a page edge.
- **Local Postgres.** The database tests need `TEST_DATABASE_URL` from the root `.env`, which this session cannot read. They are run in the user's Terminal panel, with their yes, and their output is read from there. Shared-package tests, typecheck and lint run in the session.
- **TOKI-024 in parallel.** Appends only, in `error.ts`, the shared index, `members/index.ts`; rebase when it merges.
- **Size.** Twelve routes in one pull request. Each step is its own commit so the review can go step by step.

## Decisions from the review of this plan

The advisor (Opus) grilled this plan in two rounds; the second found three points and nothing else; these changes follow from it.

1. **The second connection** of a concurrency test comes from the harness's database, not from `createMigratedDb()`, which opens another database.
2. **`channelDeps`** on `buildApp` and on the harness is the one way a test replaces `recordChange`, the account read or the facts read; without it the tests of R2 (unreachable reasons), R16 and R20 cannot be written.
3. **Create checks the role before it parses** (R1 step 1), with its three Member cases in the create test.
4. **The lock cases are written with their routes**, not in one late step.
5. **The leave-then-join case** moved to S8, where the leave route exists.
6. **Shared tests** run through the root `pnpm test`.
7. **`deps` reaches the code that uses it:** `checkAccess`, `lockForWrite` and the settings check take `deps` first, so an injected facts read or account read is the one that runs (round two).
8. **S11 and S12 are check steps.** The access table and the seam counts are written with each route; the two last steps are expected green on the first run (round two).
9. **Four cases added** to the table: remove by an Admin outside the channel, archive by an Admin who is not a member, a leave of #general by a person outside it, the member list with `limit` 100.
