# TOKI-031 Bootstrap endpoint: plan

Ticket: TOKI-031 (issue 117) · Tier L · Branch `feat/toki-031-bootstrap-endpoint`
Spec (source of truth, accepted in PR 170): `docs/specs/2026-11-17-bootstrap-endpoint-design.md`. Requirement numbers `R1`..`R20` below are the spec's; each requirement's "Check" sentence is the list of cases its test holds.

## Design

The spec fixes behaviour. This section says how it fits the server as it is now, after TOKI-029 and TOKI-030 (both on `main`).

### Where the code goes

```
packages/shared/src/bootstrap/schemas.ts      BootstrapUser, BootstrapWorkspace, BootstrapPerson, BootstrapChannelEntry, BootstrapConversation, BootstrapResponse (+ types); exported from the package index
packages/shared/src/direct-conversations.ts   memberIds of DirectConversationEntrySchema: each id must have the shape of a UUID (see "How it differs")
apps/server/src/modules/members/people.ts     listPeople(tx, workspaceId); exported by index.ts
apps/server/src/modules/conversations/summaries.ts   listConversationSummaries(tx, workspaceId, userId); exported by index.ts
apps/server/src/bootstrap/
├─ index.ts           bootstrapRoutes(deps): FastifyPluginAsync
├─ routes.ts          GET /bootstrap and its headers
├─ build.ts           buildBootstrap(db, account, deps?): the steps of the spec
└─ event-number.ts    readEventNumber(tx): returns 0 until TOKI-036
apps/server/src/app.ts                        registers bootstrapRoutes next to channelRoutes
apps/server/tests/bootstrap/                  the route, build and statement-count tests
apps/server/tests/members/list-people.db.test.ts, apps/server/tests/conversations/summaries.db.test.ts
packages/shared/tests/bootstrap-schemas.test.ts
```

### How it differs from the spec's text

- Registration is in `app.ts`, next to `channelRoutes` and `directRoutes`, not in `api/index.ts`: `registerApi` has no database (decided in TOKI-029). `bootstrap/` imports the `index.ts` of `workspace`, `members` and `conversations` only (R16); `app.ts` imports `bootstrap/index.ts`. No module imports `bootstrap`.
- Tests live in `apps/server/tests/` (`bootstrap/`, `members/`, `conversations/`), where every test of these areas is; the spec's Layout shows them beside the code. Route tests use `createHarness` (a real session by the code flow), not a token.
- R17 asks that a `memberIds` entry that is not a UUID is rejected, but `DirectConversationEntrySchema` of TOKI-030 takes any string. The check is added to that schema, where the entry is written once (R7: "adopts, not a copy"), with the same any-case UUID shape the other schemas of the file use. The server writes ids from a `uuid` column, so nothing that TOKI-030 returns today changes; TOKI-030's own tests are run again.
- `getAccountById` already returns `workspaceId`, so the second read of R4 (`getAccountsByIds`) repeats one fact. It is kept, as the spec decides: it is the seam that proves the check of R4, it matches TOKI-029 and TOKI-030, and it is one of the 7 statements the spec counts.

### One request

1. The session hook has put `request.account`; the route calls `buildBootstrap(db, request.account, deps)` and sends the result with `Cache-Control: no-store`.
2. `buildBootstrap` opens the transaction with the driver, `db.$client.begin("isolation level repeatable read read only", (sql) => fn(handleOf(sql)))`, so the mode is in the `begin` statement itself. `handleOf` is one small function in `bootstrap/read-tx.ts` that builds the drizzle handle with `new PostgresJsDatabase(dialect, new PostgresJsSession(sql, dialect, undefined), undefined)` (both exported by `drizzle-orm/postgres-js`), because `drizzle(sql)` throws on the scoped client (it has no `options`) and its type rejects `TransactionSql`. This is the only place that knows the driver; it holds the one cast to `Tx`. Drizzle's own `db.transaction(fn, config)` sends `set transaction ...` as a separate statement, which makes the count 8 today and breaks R14's "7 or fewer". The functions take a `DbClient`, so the handle works for them. It reads, in this order, with that transaction: the account (`getAccountById`), `deps.afterAccount?.(tx)` (the test seam of R10), `getAccountsByIds(tx, [id])` for `workspaceId` (no `lock`), `getWorkspace`, `listPeople`, `listConversationSummaries`, `readEventNumber(tx)`.
3. A missing account row is 401 `unauthenticated`; `deactivated` is 401 `account_deactivated` (R10). A workspace id that differs from `getWorkspace`'s is a plain `Error` (500 `internal_error`, R4). The seam is called only when the account is active, once.
4. `notificationLevel` per conversation is `effectiveNotificationLevel(kind, storedLevel)` of `@toki/shared`; the entry is built as a `BootstrapConversation` (channel: `memberIds: null`).
5. The answer is a value of `BootstrapResponse` (a type, not a runtime filter); the tests parse the real body with the strict schema.

- R10's refused `update` is a test of its own, apart from the seam test with the four changes (it aborts the transaction).
- `toUser` lives in the auth module and `bootstrap/` imports no other module than `workspace`, `members` and `conversations` (R16), so `build.ts` maps `Account` to the five fields of `BootstrapUser` itself; R3's test compares it with `GET /auth/session`.
- The route-list tests of R13 and R16 do not exist as lists: the route tests assert the route with `hasRoute` / `printRoutes` as `direct-routes.db.test.ts` does.
- A `getWorkspace` that returns null is a plain `Error` (500), like the id mismatch.

### The two reads (R15)

- `listPeople(tx, workspaceId)`: one `select id, display_name, role, status from users where workspace_id = $1 order by lower(display_name) collate "C", id::text collate "C"`. No email column is selected.
- `listConversationSummaries(tx, workspaceId, userId)`: one statement, `from conversations c join conversation_members m on m.conversation_id = c.id and m.user_id = $user`, `where c.workspace_id = $1 and c.archived_at is null`, ordered `c.id::text collate "C"`. It selects the flags, name, topic, the caller's stored level, mute and star, and for a DM or group `string_to_array(c.dm_key, ',')` as `memberIds` (null for a channel). The member row's own `workspace_id` is also compared with `$1`.
- Both take the open transaction (a `DbClient`) first and return plain values. Neither table is exported.

### Seams

`buildBootstrap(db, account, deps = {})` with `deps = { afterAccount?, getAccountsByIds?, readEventNumber? }`, each defaulting to the real function. The route passes none. `afterAccount` carries the test of R10 (a second connection commits changes while the snapshot is open; `show transaction_isolation` and `show transaction_read_only` run on the transaction it receives). The refused `update` (SQLSTATE `25006`) is a separate test: it aborts the transaction (`25P02` for every later statement), so it cannot share a run with the check of the four changes; `getAccountsByIds` carries R4's 500; `readEventNumber` carries R11's fake. Nothing is added to `buildApp`.

### Statement count (R14)

The harness already records the text of each statement (`debug`) but drops the connection id; it is extended to keep the id (the transaction is the statements between `begin` and `commit` on one connection), and the test uses it. `debug` fires for `begin` and `commit`. The `debug` callback records the text of each statement with the connection that ran it; the transaction's statements are those from `begin` to `commit` on one connection. The first step of the build is to run one request and read what is recorded, so that the assertion (7 or fewer, equal on both fixtures, totals equal) is written against what the driver reports.

### Errors, logging, safety

401s come from the session hook (`unauthenticated`, `session_ended`, `account_deactivated`); the in-snapshot check adds the second `account_deactivated`. Nothing else is refused: no 403 and no 404. A database failure is a plain `Error`, answered as 500 by the shared handler; the parameters of these statements are ids only. The route and the build log nothing.

### Tests

- Unit: the schemas (`packages/shared/tests/bootstrap-schemas.test.ts`).
- Database tests of the two reads on two workspaces, in their own folders.
- Route and build tests on the real Postgres with `createHarness` (R1 to R14, R18 to R20); the 500-conversation fixtures are inserted by SQL in a few statements.
- Commands (Node 22): `pnpm --filter @toki/server exec vitest run --config vitest.db.config.ts tests/bootstrap` with `TEST_DATABASE_URL` set to the ticket's test Postgres (a container on a free loopback port, URL given in the shell, never written to `.env`); `pnpm exec vitest run packages/shared/tests`; `pnpm typecheck`; `pnpm lint`; `pnpm format:check`.

## Steps (test first, each step ends with its tests green)

1. **Schemas** (`packages/shared`): `bootstrap/schemas.ts`, `memberIds` UUID check in `direct-conversations.ts`, index export. Unit tests first (R2, R3, R7, R17 cases).
2. **`listPeople`** (`members/people.ts`, export). Database test on two workspaces (R5, R15), in `tests/members/list-people.db.test.ts` (`list-people.db.test.ts` already exists).
3. **`listConversationSummaries`** (`conversations/summaries.ts`, export, `EXPORTED_NAMES` of the export-list test). Database test on two workspaces (R6, R7, R15).
4. **Statement recorder in the harness** (connection id kept) and `read-tx.ts`. First test: open the transaction with the exact wrapper, run one `getAccountById` through it, read the recorded statements (begin with the mode, the select, commit) and run `pnpm typecheck`. This shows the driver problem before any R10 work.
5. **`buildBootstrap` and `readEventNumber`**: the transaction opened with `db.$client.begin(...)`; seams `afterAccount`, `getAccountsByIds`, `readEventNumber`. Tests of R3, R4, R10, R11 and R19 call it directly.
6. **Route and registration** (`bootstrap/routes.ts`, `index.ts`, `app.ts`): R1, R13, R16 (route listed, no path outside `/api/v1`, no import of `bootstrap` inside `modules/`).
7. **Fixtures and bounds**: R2 (strict parse and added keys), R5, R6, R7, R8, R9, R12, R14, R18, R20 on the route.
8. Hand check once (R: Testing, last bullet), whole-repository `pnpm test`, lint, typecheck, format.

## AC to step to test

| Req | Step | Test |
|---|---|---|
| R1 session of each role, three 401 codes, no workspace data in them | 6 | `tests/bootstrap/route.db.test.ts` |
| R2 five keys, strict parse, one added key at each level | 1, 7 | `bootstrap-schemas.test.ts`; `route.db.test.ts` |
| R3 `user` equals `/auth/session`, only email in the body | 5, 6 | `build.db.test.ts`; `route.db.test.ts` |
| R4 workspace name and id; a different `workspaceId` is 500; null workspace is 500 | 5 | `build.db.test.ts` (seam) |
| R5 people complete, order, four keys, no emails | 2, 7 | `list-people.db.test.ts`; `route.db.test.ts` |
| R6 which conversations come and which do not; leaving and archiving | 3, 7 | `summaries.db.test.ts`; `route.db.test.ts` |
| R7 channel and dm entries, exact keys, order in byte collation, `memberIds` of 8 | 1, 3, 7 | `bootstrap-schemas.test.ts`; `summaries.db.test.ts`; `route.db.test.ts` |
| R8 own level, mute, star; defaults per kind; no other person's values | 3, 5, 7 | `summaries.db.test.ts`; `route.db.test.ts` |
| R9 500 conversations, no cursor | 7 | `bounds.db.test.ts` |
| R10 snapshot with four concurrent changes; isolation, read-only, refused `update` (own test); deactivated inside the snapshot is 401 | 5 | `build.db.test.ts` |
| R11 0 today; fake returning 41 gets the same transaction | 5 | `build.db.test.ts` |
| R12 no key outside the schema, no seeded text | 1, 7 | `bootstrap-schemas.test.ts`; `route.db.test.ts` |
| R13 `no-store`, media type, no row changed, route listed | 6 | `route.db.test.ts` |
| R14 7 or fewer statements, equal on both fixtures, equal totals | 4, 7 | `bounds.db.test.ts` |
| R15 two reads, two workspaces, empty list, deleted member row, export list, lint | 2, 3 | `list-people.db.test.ts`; `summaries.db.test.ts`; `exports.test.ts`; `pnpm lint` |
| R16 folder, imports, no module imports `bootstrap` | 6 | `route.db.test.ts`; `pnpm lint` |
| R17 schemas, each rejected case | 1 | `bootstrap-schemas.test.ts` |
| R18 nothing of a conversation left out, no ids of private conversations | 7 | `route.db.test.ts` |
| R19 deactivated person stays; reactivated | 7 | `route.db.test.ts` |
| R20 body under 250,000 and 400,000 bytes | 7 | `bounds.db.test.ts` |

## What can break, and the riskiest step

- **Step 5, the transaction.** `db.$client.begin("isolation level repeatable read read only", ...)` hands the code a `drizzle(sql)` handle; if the `$client` of a `Db` built by `createDb` is not the postgres-js client, or the handle does not take part in the open transaction, the reads run on other connections and R10 fails silently. The R10 test (a second connection commits during the snapshot) and the `show transaction_*` checks prove it; they are written before the code.
- The R7 byte-order test first asserts that its id pair orders differently under the default collation of the test database; if the container is C/POSIX it builds the pair for a database created with another collation, or the test says so and is not counted as proof.
- R11's test captures the transaction in the seam (`afterAccount`) and compares it with the one the fake received.
- R4's 500 and R10's deactivated 401 are also checked as a route answer: a test builds the app with a `bootstrapDeps` option of `bootstrapRoutes` (`getAccountsByIds`) and reads status and body; the 401 case deactivates the caller from the seam on a second connection before the account is re-read, so the route test needs the seam through the route as well. `bootstrapRoutes(deps)` therefore takes the same optional deps as `buildBootstrap` (nothing is added to `buildApp`; the route test registers the plugin itself with `registerRoutes`).
- The checks that "nothing is there" (R16 no import of `bootstrap` in `modules/`, R13 unchanged rows, R9 no `nextCursor`) each sit in the same test as their positive twin (the import found in `app.ts`; a row that does change, `sessions.last_used_at`; the 500 ids present).
- A statement count that the recorder reads wrong would pass R14 for the wrong reason: step 4 tests the recorder first and the count test also asserts the exact statement texts it sees.
- `string_to_array` of `dm_key` returns text, not uuid: the test of R7 compares it with the key order.
- The harness change (connection id) must not break the tests that use it: the full suite is run after step 4.

## Files added during the build

Not named above, needed by the steps:

- `apps/server/src/bootstrap/read-tx.ts` and `tests/bootstrap/read-tx.db.test.ts`: the snapshot helper of the design, with its own test (step 4).
- `BootstrapDeps` also holds `getAccountById` and `getWorkspace` (replaceable by a test), and `buildApp` gets a `bootstrapDeps` option next to `channelDeps`, so the route tests can show the body of the 500 (R4) and of the in-snapshot 401 (R10). The test harness passes it through and keeps `statementLog` (the statements with their connection id) beside `statements`.
- `tests/bootstrap/{build,route,bounds}.db.test.ts`: build and seam tests; route tests; size, count and statement tests (R9, R14, R20). `tests/conversations/summaries.db.test.ts` and `tests/members/list-people.db.test.ts` hold the tests of the two reads.
- R7's "a pair of ids whose byte order differs from the default collation" cannot exist for lower-case hex UUID text (digits sort before letters and the hyphens sit at fixed places in every collation). The statement orders `collate "C"` as the spec says and the test pins the byte order of mixed ids; the collation of the names in `listPeople` is proved to matter (a mutation without `collate "C"` fails its test).
- The hand check of the spec (`dev:reset:db`, first Admin, sign in, read the endpoint) is not done here: it needs the local `.env`. It is left to the person who merges, with the expected answer (one workspace, one member, #general, `eventNumber` 0).
- `packages/shared/src/bootstrap/index.ts` (one export line) and the export in the package index.
- R15's "a conversation and a member row of the second workspace are not returned": the database holds no state in which one person has a member row in a conversation of another workspace (the composite foreign key ties the row's workspace to the conversation's), so the two `workspace_id` conditions of `listConversationSummaries` cannot be shown to matter by any reachable data. The test asks for the other workspace and for a person with no rows there and expects nothing; the conditions stay as a second guard.
- The harness workspace is named `Acme`, not `Test Workspace`; the tests assert the name that the fixture holds.
- `docs/plans/TOKI-031.state.json` is the workflow state of the ticket, kept in the branch as in earlier tickets.
