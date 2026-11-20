# TOKI-030 DM and group DM API: plan

Ticket: TOKI-030 (issue 118) · Tier M · Branch `feat/toki-030-dm-api`
Spec (source of truth, accepted in PRs 80 and 178): `docs/specs/2026-11-17-dm-api-design.md`. Requirement numbers `R1`..`R22` below are the spec's; each requirement's "Check" sentence is the list of cases its test holds.

## Design

The spec fixes behaviour. This section says how it fits the server as it is now, after TOKI-029 (which is on `main`).

### Where the code goes

```
packages/shared/src/direct-conversations.ts   OpenDirectBodySchema, DirectConversationEntrySchema (+ type), OpenDirectResponseSchema, DIRECT_CONVERSATION_MAX_OTHERS; exported from the package index
packages/shared/src/error.ts                  appends directWithSelf, groupTooLarge, personDeactivated
apps/server/src/modules/conversations/
├─ direct.ts          planDirectConversation, checkPeople (pure, no database, compares no role)
├─ direct-open.ts     the transaction: lock, re-check, find or create, answer
├─ direct-routes.ts   handleOpenDirect(deps, account, body) and directRoutes(deps)
└─ index.ts           adds directRoutes and the DirectDeps type
apps/server/src/app.ts                        registers directRoutes next to channelRoutes
apps/server/tests/conversations/              direct.test.ts, direct-open.db.test.ts, direct-routes.db.test.ts
packages/shared/tests/direct-conversations.test.ts
```

### How it differs from the spec's text

- Registration is in `app.ts`, next to `channelRoutes`, not in `api/index.ts`: `registerApi` has no database or clock (decided in TOKI-029). `app.ts` imports the `index.ts` of `conversations` and of `members` and passes `getAccountsByIds` in, so the module still imports nothing of `members` (R16).
- Tests live in `apps/server/tests/conversations/`, where every test of this module is; the spec's Layout shows them beside the code.
- The route test uses `createHarness` (a real session by the code flow, `h.signIn`, a cookie), not a token and `buildApp({ registerRoutes })`. The handler tests call `handleOpenDirect` directly, as the spec's seam says.
- `directRoutes` returns a `FastifyPluginAsync` and is registered with `scope.register`, as `channelRoutes` is.
- The export-list test of TOKI-028 is already one constant of names (`EXPORTED_NAMES`), extended by TOKI-029; this ticket adds `directRoutes` to it and the new files to the R24 scan list.

### One request

1. The session hook has put `request.account`. The plugin calls `handleOpenDirect(deps, account, request.body)` and turns its result into a status and a body.
2. `handleOpenDirect`: `canCreateDirectConversation({ id, role })` on the account (R3 step 2), then `OpenDirectBodySchema.parse(body ?? {})`, then `planDirectConversation(actor.id, userIds)`, which refuses the caller's own id and more than 7 others and calls `buildDmKey` (R5).
3. One transaction at `READ COMMITTED`, set in the code (`db.transaction(fn, { isolationLevel: "read committed" })`; R22), with the clock read once at its start. First statement: `deps.getAccountsByIds(tx, [actor.id, ...userIds], { lock: "share" })`.
4. The caller's row decides: no row is 401 `unauthenticated`, `deactivated` is 401 `account_deactivated`, and the permission function runs again with the locked role (R4).
5. `checkPeople(caller, rows, ids, canTakePart)` (pure): a missing id, another workspace and a person the function refuses are one `not_found` (R6, R7); `unknown_role` and `fact_missing` are a server failure; otherwise the ids of the deactivated people.
6. Find the conversation by `(workspace_id, dm_key)` with the caller's member row: found is 200 (R9), whatever the status of the others. Not found with deactivated people is 409 `person_deactivated` (R10). Otherwise `insert ... on conflict (workspace_id, dm_key) do nothing returning`: a row came back, so insert one member row per person and answer 201; none came back, so another request made it between the read and the insert, so read it by the key and answer 200 (R13).
7. The entry (R18): `memberIds` is the key split, `notificationLevel` is `effectiveNotificationLevel(kind, stored)`, `isMuted` and `isStarred` the caller's stored values.

### Dependencies and seams

`DirectDeps = { db, clock, getAccountsByIds, canCreateDirectConversation? }`. The last member defaults to the function of `@toki/shared`; a handler test replaces it (R4, R7). A handler test also passes its own `getAccountsByIds`, which must call the real read: to give a role the database cannot hold, to report an id with no `users` row (the foreign-key rollback of R11), and to look at the transaction it receives (R22). The ids given to it and to `checkPeople` are the lower-cased ones of the plan (R12), never the raw `userIds`. The error-level log line of R4 for `unknown_role` and `fact_missing` is the line the shared handler writes for any plain error, so a route-level test cannot reach it (no real request gives a role the database cannot hold) and the handler test asserts that the handler throws a plain `Error` and not an `AppError`; the log of that handler is tested in TOKI-004. Nothing is added to `buildApp` or the harness for this ticket.

### Errors

Business refusals are `AppError`s (`direct_with_self` 400, `group_too_large` 400 with `details { max: 8, maxOthers: 7 }`, `person_deactivated` 409 with `details { userIds }`, `not_found` 404 with no details, `forbidden` 403, 401s). `unknown_role` and `fact_missing` are a plain `Error`, which the shared handler logs at error level and answers as 500. `directRoutes` wraps the handler in `toSafeError` of this module (TOKI-029), as `channelRoutes` does, so a failed insert (the foreign key of R11) logs a Postgres code and a constraint name and no id (R20). `handleOpenDirect` itself does not wrap, so a handler test sees the raw error; the route-level safety test reads the log. The message of `toSafeError` says "channel"; it is not a text a person reads and it is left as it is.

### Tests

- Unit (`direct.test.ts`, no database): the pure rules with the sets of R5, a stubbed permission function and an injected role `"guest"`.
- Database tests on the real Postgres with `createHarness`; handler tests open concurrent calls on separate connections: one `postgres(h.config.database.url, { max: 12 })` pool wrapped by drizzle per case, ended after the case (20 repetitions of up to 10 new pools would exhaust `max_connections`). Lock cases use the pattern of `channels.locks.db.test.ts` (the second connection changes a `users` row and holds it first).
- Commands (Node 22): `pnpm --filter @toki/server exec vitest run --config vitest.db.config.ts tests/conversations/direct-open.db.test.ts` with `TEST_DATABASE_URL` set to the ticket's test Postgres (a container on a free loopback port, URL given in the shell, never written to `.env`); `pnpm exec vitest run packages/shared/tests`; `pnpm typecheck`; `pnpm lint`; `pnpm format:check`.

## AC to step to test

| Req | Step | Test |
|---|---|---|
| R17, R19 | S1 | `packages/shared/tests/direct-conversations.test.ts`: the body schema (the invalid bodies of R2, 1 and 7 ids pass, same id in two cases fails), the entry schema (strict, ten keys, rejects an added key, a missing key, `kind` channel, a name, `isPrivate` false, level `loud`), `DIRECT_CONVERSATION_MAX_OTHERS` is `GROUP_DM_MAX_PEOPLE - 1`; the three codes are in the registry once; a type test imports every name of R17 from `@toki/shared` (R17) |
| R5, R6, R7, R10 (rules) | S2 | `direct.test.ts`: 1, 2, 7 accepted and 8 and 200 refused; the caller's id alone, first, last and in the middle; the same ids in other orders give one key; `checkPeople` for a missing id, another workspace, a refused person, an unknown role, deactivated people sorted |
| R3, R4, R6 to R12, R14, R18, R21 | S3 | `direct-open.db.test.ts`: create a DM and a group of 8 and compare every column of both tables; existing returns 200 with the first request's rows and levels; open `[b]` as a and `[a]` as b; deactivated person in an existing conversation still 200; a person who is active again can be opened (R10); the deactivated cases (DM, one of three) 409 with sorted ids; not_found for unknown id and for another workspace with one body; a group with a bad id writes nothing; the order cases of R3; the guest and owner roles 500; stubbed `role_not_allowed` 403, stubbed target refusal 404, stubbed `fact_missing` 500; the same set from three members in other orders and cases is one id; a set that differs by one person is another conversation; no `update` or `delete` on `conversation_members` in the files of the change; a refusal leaves both tables equal |
| R11 | S3 | the foreign-key rollback: a read that reports an id with no `users` row makes the member insert fail, the answer is 500 and no `conversations` row is left |
| R4 (no role string) | S6 | the search of R4 and the search of R14 over the non-test files of the change find no line |
| R1, R2, R19, R20 | S4 | `direct-routes.db.test.ts`: 401 without a session and with an ended session; a positive request reaches the handler; no body gives 400; a form body 415; a foreign `Origin` 403; every invalid body 400 with the tables unchanged; the route list holds this one path; every error body parses with the error schema, every 200 and 201 body with the response schema; the log holds no id from `userIds`; the row counts of every other table are unchanged |
| R13 | S5 | `direct-open.db.test.ts`: a DM from a and from b together, a group of 4 from its four members together, and 10 requests of one person together, on separate connections, 20 repetitions each; exactly one 201, the rest 200 with one id, one `conversations` row, one row per person, no 500 |
| R22 | S5 | a deactivation holding a person's row while a create waits gives 409 after the commit; a caller deactivated while waiting gives 401; a create and a person route of TOKI-024 style (`for no key update` on one `users` row, then an update of it, in an open transaction) started together finish without a deadlock; the isolation is proved by making the default of the test connection `repeatable read` (`default_transaction_isolation`) and reading `show transaction_isolation` inside the transaction through the stub, which must say `read committed`, so the code's own `SET` is what is read |
| R16 | S4 | `exports.test.ts` (names list gains `directRoutes`, a function; types are checked by typecheck; the R24 scan list gains the new source files and `direct.test.ts`, not the database tests, which import the harness and the real read); the app from `buildApp` has the route |

## Steps (test first)

Each step writes its test first, sees it fail for the stated reason, writes the code, runs the file green and commits. S6 is a check step expected to be green the first time.

1. **S1 Shared.** `direct-conversations.ts`, the index line, three codes in `error.ts`. Fails first: module not found.
2. **S2 Pure rules.** `direct.ts` with `planDirectConversation` and `checkPeople`. Fails first: module not found.
3. **S3 Handler and transaction.** `direct-open.ts`, `direct-routes.ts` (`handleOpenDirect` only), `index.ts` export of the types. Fails first: no such export.
4. **S4 Route.** `directRoutes`, `app.ts`, `exports.test.ts`. Fails first: the route is not registered (404, or 401 for an unknown path).
5. **S5 Concurrency and locks.** The concurrent and lock cases against the finished handler; code changes only where a case shows a gap.
6. **S6 Check.** Read the AC table against the tests; run the two searches of R4 and R14 over the non-test files; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, the whole test run; `git status apps/server/migrations` is clean.

## What can break, and the riskiest step

- **Riskiest: the create and the same-set race (S3, S5).** `on conflict do nothing` only helps at `READ COMMITTED`; a snapshot isolation would turn the loser into a 500. The isolation is set in the code and read back in a test; the repeat-20 cases on separate connections are the proof.
- **The deferred trigger of TOKI-028 R21** checks the member rows at commit, so the conversation and its members must be in one transaction; a failed member insert must leave no conversation row (the rollback test).
- **The 404 that hides who exists.** A missing id, another workspace and a refused person must give one body; the test compares the bodies.
- **A parameter in the log.** A failed insert carries ids in the Drizzle message; `toSafeError` keeps them out and the safety test reads the log.
- **Needs an install.** The new worktree has no `node_modules`: `corepack pnpm install` under Node 22 comes first.
- **Local Postgres.** The database tests need a `TEST_DATABASE_URL`. This session may not read `.env`, so it runs a container of its own (`toki-029-test-pg` on port 55435 is still up) and passes the URL in the shell.
- **Size.** One route, but the spec is long; each step is its own commit.
